'use strict';

const pool = require('../db/pool');
const { randomUUID } = require('crypto');
const fsp = require('fs/promises');
const path = require('path');

const {
  enqueueNotification,
} = require('../services/service-notification-outbox.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE_DIR = path.resolve(
  process.env.SERVICE_EVIDENCE_DIR ||
  path.resolve(__dirname, '../../uploads/service-orders')
);
const MAX_BYTES = Math.max(262144, Number(process.env.SERVICE_EVIDENCE_MAX_BYTES || 8388608));
const FILE_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const CHANNELS = new Set(['whatsapp','email','phone','sms','in_person','other']);
const CATEGORIES = new Set(['third_party_authorization','identity','other']);

const clean = (value, max = 5000) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};
const role = (req) => req.user?.role?.name || req.user?.rol || null;
const isAdmin = (req) => role(req) === 'admin';
const isTech = (req) => role(req) === 'tecnico';
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

async function rollback(client) {
  try { await client.query('ROLLBACK'); } catch (_) {}
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      const e = new Error('Archivo demasiado grande');
      e.code = 'FILE_TOO_LARGE';
      throw e;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function getOrder(client, id, lock = false) {
  const r = await client.query(`
    SELECT
      so.id, so.codigo_os, so.estado::text AS estado, so.tecnico_id,
      so.fecha_inicio, so.fecha_fin, so.client_id,
      CASE WHEN c.tipo_persona = 'juridica'
        THEN c.razon_social
        ELSE CONCAT_WS(' ', c.primer_nombre, c.primer_apellido)
      END AS client_name,
      c.documento AS client_document,
      c.telefono AS client_phone,
      c.email AS client_email
    FROM service_orders so
    LEFT JOIN clients c ON c.id = so.client_id
    WHERE so.id = $1
    ${lock ? 'FOR UPDATE OF so' : ''}
  `, [id]);
  return r.rows[0] || null;
}

async function canRead(client, req, order) {
  if (isAdmin(req)) return true;
  if (!isTech(req)) return false;
  if (order.tecnico_id === req.user.id) return true;
  const r = await client.query(`
    SELECT 1 FROM service_order_team_members
    WHERE service_order_id = $1
      AND technician_id = $2
      AND member_status <> 'removed'
    LIMIT 1
  `, [order.id, req.user.id]);
  return Boolean(r.rows[0]);
}

async function getClosure(client, id) {
  const r = await client.query(
    `SELECT * FROM service_order_closures WHERE service_order_id = $1 LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function getDelivery(client, id, lock = false) {
  const r = await client.query(`
    SELECT * FROM service_order_deliveries
    WHERE service_order_id = $1
    ${lock ? 'FOR UPDATE' : ''}
  `, [id]);
  return r.rows[0] || null;
}

async function ensureDraft(client, id) {
  const r = await client.query(`
    INSERT INTO service_order_deliveries (service_order_id,status,created_at,updated_at)
    VALUES ($1,'draft',NOW(),NOW())
    ON CONFLICT (service_order_id)
    DO UPDATE SET updated_at = service_order_deliveries.updated_at
    RETURNING *
  `, [id]);
  return r.rows[0];
}

async function getNotifications(client, id) {
  return (await client.query(`
    SELECT n.*, u.nombre1 AS notified_by_name, u.apellidos AS notified_by_lastname
    FROM service_order_client_notifications n
    LEFT JOIN usuarios u ON u.id = n.notified_by
    WHERE n.service_order_id = $1
    ORDER BY n.notified_at DESC
  `, [id])).rows;
}

async function getEvidences(client, id) {
  return (await client.query(`
    SELECT id,category,uploaded_by,original_name,mime_type,size_bytes,note,created_at
    FROM service_order_delivery_evidences
    WHERE service_order_id = $1
    ORDER BY created_at DESC
  `, [id])).rows;
}

async function getSatisfaction(client, id) {
  const r = await client.query(
    `SELECT * FROM service_order_satisfaction WHERE service_order_id = $1 LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function getCustody(client, id) {
  const r = await client.query(
    `SELECT * FROM service_order_current_custody WHERE service_order_id = $1 LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function getFinancialControlState(client, id) {
  const controlResult = await client.query(
    `
      SELECT *
      FROM service_order_financial_controls
      WHERE service_order_id = $1
      LIMIT 1
    `,
    [id]
  );

  const control = controlResult.rows[0] || null;

  if (!control) {
    return {
      control: null,
      verification_count: 0,
      ready: null,
      mode: 'legacy',
    };
  }

  const verificationResult = await client.query(
    `
      SELECT COUNT(*)::int AS total
      FROM service_order_financial_verifications
      WHERE service_order_id = $1
    `,
    [id]
  );

  const verificationCount =
    Number(verificationResult.rows[0]?.total || 0);

  const ready =
    control.verification_required === false ||
    control.clearance_status === 'not_required' ||
    (
      control.clearance_status === 'cleared' &&
      (
        verificationCount > 0 ||
        control.last_verified_at
      )
    );

  return {
    control,
    verification_count: verificationCount,
    ready: Boolean(ready),
    mode: 'v17',
  };
}

async function event(client, id, type, actor, metadata = {}) {
  await client.query(`
    INSERT INTO service_order_delivery_events
      (id,service_order_id,event_type,actor_user_id,metadata,created_at)
    VALUES ($1,$2,$3,$4,$5::jsonb,NOW())
  `, [randomUUID(), id, type, actor || null, JSON.stringify(metadata)]);
}

function safePath(relative) {
  const absolute = path.resolve(EVIDENCE_DIR, relative);
  if (!absolute.startsWith(`${EVIDENCE_DIR}${path.sep}`)) {
    throw new Error('Ruta de almacenamiento inválida');
  }
  return absolute;
}

exports.getDelivery = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ success:false, message:'ID de orden no válido' });
    }
    const order = await getOrder(client, req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Orden no encontrada' });
    if (!(await canRead(client, req, order))) {
      return res.status(403).json({ success:false, message:'No autorizado para consultar la entrega' });
    }
    const [closure, delivery, notifications, evidences, satisfaction, custody] = await Promise.all([
      getClosure(client, order.id),
      getDelivery(client, order.id),
      getNotifications(client, order.id),
      getEvidences(client, order.id),
      getSatisfaction(client, order.id),
      getCustody(client, order.id),
    ]);
    return res.json({
      success:true,
      data:{
        order,
        closure,
        delivery: delivery || { service_order_id:order.id, status:'draft' },
        notifications,
        evidences,
        satisfaction,
        current_custody_holder: custody?.holder_user_id || null,
      },
    });
  } catch (error) {
    console.error('Error loading final delivery:', error);
    if (error?.code === '42P01') {
      return res.status(409).json({
        success:false,
        code:'V13_TABLES_NOT_INSTALLED',
        message:'Faltan las tablas V13 de entrega final',
      });
    }
    return res.status(500).json({ success:false, message:'Error al cargar la entrega final' });
  } finally {
    client.release();
  }
};

exports.recordNotification = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede registrar la notificación' });
    const channel = clean(req.body?.channel, 30);
    if (!CHANNELS.has(channel)) return res.status(400).json({ success:false, message:'Canal no válido' });

    await client.query('BEGIN');
    const order = await getOrder(client, req.params.id, true);
    if (!order) { await rollback(client); return res.status(404).json({ success:false, message:'Orden no encontrada' }); }
    const closure = await getClosure(client, order.id);
    if (closure?.status !== 'validated') {
      await rollback(client);
      return res.status(409).json({ success:false, message:'Dirección Técnica debe validar primero el cierre' });
    }

    const r = await client.query(`
      INSERT INTO service_order_client_notifications
        (id,service_order_id,channel,recipient_name,recipient_contact,reference,note,notified_by,notified_at,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
      RETURNING *
    `, [
      randomUUID(), order.id, channel,
      clean(req.body?.recipient_name,180) || order.client_name,
      clean(req.body?.recipient_contact,180) ||
        (channel === 'email' ? order.client_email : order.client_phone),
      clean(req.body?.reference,2000),
      clean(req.body?.note,4000),
      req.user.id,
    ]);

    await event(client, order.id, 'client_notified', req.user.id, { channel });
    await client.query('COMMIT');
    return res.status(201).json({ success:true, message:'Notificación registrada', data:r.rows[0] });
  } catch (error) {
    await rollback(client);
    console.error('Error recording client notification:', error);
    return res.status(500).json({ success:false, message:'Error al registrar notificación' });
  } finally {
    client.release();
  }
};

exports.saveDraft = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede preparar la entrega' });
    const receiverType = clean(req.body?.receiver_type,20);
    if (!['client','third_party'].includes(receiverType)) {
      return res.status(400).json({ success:false, message:'Selecciona quién recibe' });
    }

    await client.query('BEGIN');
    const order = await getOrder(client, req.params.id, true);
    if (!order) { await rollback(client); return res.status(404).json({ success:false, message:'Orden no encontrada' }); }
    const closure = await getClosure(client, order.id);
    if (closure?.status !== 'validated') {
      await rollback(client);
      return res.status(409).json({ success:false, message:'Dirección Técnica debe validar primero el cierre' });
    }
    const existing = await getDelivery(client, order.id, true);
    if (existing?.status === 'delivered') {
      await rollback(client);
      return res.status(409).json({ success:false, message:'La entrega final ya fue confirmada' });
    }

    await ensureDraft(client, order.id);

    const r = await client.query(`
      UPDATE service_order_deliveries
      SET receiver_type=$1, receiver_name=$2, receiver_document=$3,
          receiver_phone=$4, receiver_relationship=$5,
          identity_verified=$6, final_condition_verified=$7,
          accessories_verified=$8, financial_clearance=$9,
          financial_note=$10, third_party_authorization_note=$11,
          delivery_note=$12, updated_at=NOW()
      WHERE service_order_id=$13
      RETURNING *
    `, [
      receiverType,
      clean(req.body?.receiver_name,180) || (receiverType === 'client' ? order.client_name : null),
      clean(req.body?.receiver_document,80) || (receiverType === 'client' ? order.client_document : null),
      clean(req.body?.receiver_phone,80) || (receiverType === 'client' ? order.client_phone : null),
      clean(req.body?.receiver_relationship,120),
      Boolean(req.body?.identity_verified),
      Boolean(req.body?.final_condition_verified),
      Boolean(req.body?.accessories_verified),
      Boolean(req.body?.financial_clearance),
      clean(req.body?.financial_note,5000),
      clean(req.body?.third_party_authorization_note,5000),
      clean(req.body?.delivery_note,5000),
      order.id,
    ]);

    await event(client, order.id, 'delivery_draft_saved', req.user.id, { receiver_type:receiverType });
    await client.query('COMMIT');
    return res.json({ success:true, message:'Datos de entrega guardados', data:r.rows[0] });
  } catch (error) {
    await rollback(client);
    console.error('Error saving delivery draft:', error);
    return res.status(500).json({ success:false, message:'Error al guardar datos de entrega' });
  } finally {
    client.release();
  }
};

exports.uploadEvidence = async (req, res) => {
  const client = await pool.connect();
  let absolute = null;
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede adjuntar soportes' });
    const category = clean(req.query?.category,40) || 'other';
    if (!CATEGORIES.has(category)) return res.status(400).json({ success:false, message:'Categoría no válida' });

    const order = await getOrder(client, req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Orden no encontrada' });
    const delivery = await getDelivery(client, order.id);
    if (delivery?.status === 'delivered') return res.status(409).json({ success:false, message:'La entrega ya fue confirmada' });

    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const ext = FILE_MIME[mime];
    if (!ext) return res.status(415).json({ success:false, message:'Usa JPG, PNG, WEBP o PDF' });

    const buffer = await readBody(req);
    if (!buffer.length) return res.status(400).json({ success:false, message:'Archivo vacío' });

    const evidenceId = randomUUID();
    const relative = path.join(order.id,'delivery',`${evidenceId}${ext}`);
    absolute = safePath(relative);
    await fsp.mkdir(path.dirname(absolute), { recursive:true });
    await fsp.writeFile(absolute, buffer, { flag:'wx' });
    await ensureDraft(client, order.id);

    const r = await client.query(`
      INSERT INTO service_order_delivery_evidences
        (id,service_order_id,category,uploaded_by,original_name,mime_type,size_bytes,storage_path,note,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      RETURNING id,category,uploaded_by,original_name,mime_type,size_bytes,note,created_at
    `, [
      evidenceId, order.id, category, req.user.id,
      clean(req.query?.name,255) || `soporte-entrega${ext}`,
      mime, buffer.length, relative, clean(req.query?.note,1500),
    ]);

    await event(client, order.id, 'delivery_evidence_added', req.user.id, { evidence_id:evidenceId, category });
    return res.status(201).json({ success:true, message:'Soporte registrado', data:r.rows[0] });
  } catch (error) {
    if (absolute) { try { await fsp.unlink(absolute); } catch (_) {} }
    console.error('Error uploading delivery evidence:', error);
    if (error?.code === 'FILE_TOO_LARGE') return res.status(413).json({ success:false, message:'Archivo demasiado grande' });
    return res.status(500).json({ success:false, message:'Error al cargar soporte' });
  } finally {
    client.release();
  }
};

exports.getEvidenceFile = async (req, res) => {
  const client = await pool.connect();
  try {
    const order = await getOrder(client, req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Orden no encontrada' });
    if (!(await canRead(client, req, order))) return res.status(403).json({ success:false, message:'No autorizado' });

    const r = await client.query(`
      SELECT storage_path,mime_type FROM service_order_delivery_evidences
      WHERE id=$1 AND service_order_id=$2 LIMIT 1
    `, [req.params.evidenceId, order.id]);
    if (!r.rows[0]) return res.status(404).json({ success:false, message:'Soporte no encontrado' });

    const absolute = safePath(r.rows[0].storage_path);
    await fsp.access(absolute);
    res.setHeader('Content-Type', r.rows[0].mime_type);
    return res.sendFile(absolute);
  } catch (error) {
    console.error('Error opening delivery evidence:', error);
    return res.status(500).json({ success:false, message:'Error al abrir soporte' });
  } finally {
    client.release();
  }
};

exports.saveSignature = async (req, res) => {
  const client = await pool.connect();
  let absolute = null;
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede registrar la firma' });
    const order = await getOrder(client, req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Orden no encontrada' });

    const current = await getDelivery(client, order.id);
    if (current?.status === 'delivered') return res.status(409).json({ success:false, message:'La entrega ya fue confirmada' });

    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['image/png','image/jpeg','image/webp'].includes(mime)) {
      return res.status(415).json({ success:false, message:'Firma debe ser PNG, JPG o WEBP' });
    }
    const buffer = await readBody(req);
    if (!buffer.length) return res.status(400).json({ success:false, message:'Firma vacía' });

    await ensureDraft(client, order.id);
    const existing = await getDelivery(client, order.id, true);
    const ext = FILE_MIME[mime];
    const relative = path.join(order.id,'delivery',`signature-${randomUUID()}${ext}`);
    absolute = safePath(relative);
    await fsp.mkdir(path.dirname(absolute), { recursive:true });
    await fsp.writeFile(absolute, buffer, { flag:'wx' });

    const r = await client.query(`
      UPDATE service_order_deliveries
      SET signature_mime_type=$1, signature_storage_path=$2,
          signature_captured_at=NOW(), updated_at=NOW()
      WHERE service_order_id=$3
      RETURNING *
    `, [mime, relative, order.id]);

    if (existing?.signature_storage_path) {
      const old = safePath(existing.signature_storage_path);
      try { await fsp.unlink(old); } catch (_) {}
    }

    await event(client, order.id, 'delivery_signature_captured', req.user.id);
    return res.json({ success:true, message:'Firma registrada', data:r.rows[0] });
  } catch (error) {
    if (absolute) { try { await fsp.unlink(absolute); } catch (_) {} }
    console.error('Error saving delivery signature:', error);
    return res.status(500).json({ success:false, message:'Error al guardar firma' });
  } finally {
    client.release();
  }
};

exports.getSignature = async (req, res) => {
  const client = await pool.connect();
  try {
    const order = await getOrder(client, req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Orden no encontrada' });
    if (!(await canRead(client, req, order))) return res.status(403).json({ success:false, message:'No autorizado' });

    const delivery = await getDelivery(client, order.id);
    if (!delivery?.signature_storage_path) return res.status(404).json({ success:false, message:'No hay firma' });

    const absolute = safePath(delivery.signature_storage_path);
    await fsp.access(absolute);
    res.setHeader('Content-Type', delivery.signature_mime_type || 'image/png');
    return res.sendFile(absolute);
  } catch (error) {
    console.error('Error opening delivery signature:', error);
    return res.status(500).json({ success:false, message:'Error al abrir firma' });
  } finally {
    client.release();
  }
};

exports.confirmDelivery = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede confirmar la entrega' });
    await client.query('BEGIN');

    const order = await getOrder(client, req.params.id, true);
    if (!order) { await rollback(client); return res.status(404).json({ success:false, message:'Orden no encontrada' }); }
    if (order.estado === 'cerrada') { await rollback(client); return res.status(409).json({ success:false, message:'La orden ya está cerrada' }); }

    const closure = await getClosure(client, order.id);
    if (closure?.status !== 'validated') {
      await rollback(client);
      return res.status(409).json({ success:false, message:'Dirección Técnica debe validar primero el cierre' });
    }

    const delivery = await getDelivery(client, order.id, true);
    if (!delivery) { await rollback(client); return res.status(409).json({ success:false, message:'Guarda primero los datos de entrega' }); }
    if (delivery.status === 'delivered') { await rollback(client); return res.status(409).json({ success:false, message:'La entrega ya fue confirmada' }); }

    const notifications = await getNotifications(client, order.id);
    if (!notifications.length) {
      await rollback(client);
      return res.status(409).json({ success:false, code:'CLIENT_NOTIFICATION_REQUIRED', message:'Registra al menos una notificación al cliente' });
    }

    if (!delivery.receiver_type || !delivery.receiver_name || !delivery.receiver_document || !delivery.signature_storage_path) {
      await rollback(client);
      return res.status(409).json({ success:false, code:'DELIVERY_DATA_INCOMPLETE', message:'Completa receptor, documento y firma' });
    }

    const checks = [
      ['identity_verified','Verifica la identidad del receptor'],
      ['final_condition_verified','Verifica el estado final del equipo'],
      ['accessories_verified','Verifica los accesorios'],
    ];
    const failed = checks.find(([key]) => delivery[key] !== true);
    if (failed) {
      await rollback(client);
      return res.status(409).json({ success:false, code:'DELIVERY_CHECKS_INCOMPLETE', message:failed[1] });
    }

    let financialState;

    try {
      financialState = await getFinancialControlState(
        client,
        order.id
      );
    } catch (financialError) {
      if (financialError?.code !== '42P01') {
        throw financialError;
      }

      financialState = {
        control: null,
        verification_count: 0,
        ready: null,
        mode: 'legacy',
      };
    }

    if (financialState.mode === 'v17') {
      if (!financialState.ready) {
        await rollback(client);
        return res.status(409).json({
          success:false,
          code:'FINANCIAL_CLEARANCE_REQUIRED',
          message:
            financialState.control?.clearance_status === 'blocked'
              ? 'La entrega está bloqueada por control financiero.'
              : 'Falta una liberación financiera válida antes de entregar.',
          financial_status:
            financialState.control?.clearance_status || 'pending',
        });
      }

      if (delivery.financial_clearance !== true) {
        await client.query(
          `
            UPDATE service_order_deliveries
            SET financial_clearance = TRUE,
                financial_note =
                  CASE
                    WHEN financial_note IS NULL OR BTRIM(financial_note) = ''
                    THEN $1
                    ELSE financial_note
                  END,
                updated_at = NOW()
            WHERE service_order_id = $2
          `,
          [
            `Liberación validada por Control Financiero V17: ${financialState.control.clearance_status}.`,
            order.id,
          ]
        );

        delivery.financial_clearance = true;
      }
    } else if (delivery.financial_clearance !== true) {
      await rollback(client);
      return res.status(409).json({
        success:false,
        code:'FINANCIAL_CLEARANCE_REQUIRED',
        message:'Confirma la liberación financiera antes de entregar.',
      });
    }

    if (delivery.receiver_type === 'third_party') {
      if (!delivery.receiver_relationship || !delivery.third_party_authorization_note) {
        await rollback(client);
        return res.status(409).json({ success:false, message:'Completa relación y referencia de autorización del tercero' });
      }
      const auth = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM service_order_delivery_evidences
        WHERE service_order_id=$1 AND category='third_party_authorization'
      `, [order.id]);
      if (Number(auth.rows[0]?.total || 0) < 1) {
        await rollback(client);
        return res.status(409).json({ success:false, code:'THIRD_PARTY_AUTHORIZATION_REQUIRED', message:'Adjunta autorización escrita del tercero' });
      }
    }

    const custody = await getCustody(client, order.id);
    if (!custody) {
      await rollback(client);
      return res.status(409).json({ success:false, code:'FINAL_CUSTODY_REQUIRED', message:'No existe custodia activa para liberar' });
    }
    if (custody.holder_user_id !== req.user.id) {
      await rollback(client);
      return res.status(409).json({
        success:false,
        code:'CURRENT_CUSTODIAN_REQUIRED',
        message:'La entrega debe confirmarla el usuario que tiene la custodia',
        custody_holder_user_id:custody.holder_user_id,
      });
    }

    const r = await client.query(`
      UPDATE service_order_deliveries
      SET status='delivered', delivered_by=$1, delivered_at=NOW(), updated_at=NOW()
      WHERE service_order_id=$2
      RETURNING *
    `, [req.user.id, order.id]);

    await client.query(`
      INSERT INTO service_order_custody_events
        (id,service_order_id,action,from_user_id,to_user_id,performed_by,note,created_at)
      VALUES ($1,$2,'liberada',$3,NULL,$4,$5,NOW())
    `, [
      randomUUID(), order.id, custody.holder_user_id, req.user.id,
      `Entrega final a ${delivery.receiver_type === 'third_party' ? 'tercero autorizado' : 'cliente'}: ${delivery.receiver_name}`,
    ]);

    await client.query(
      `DELETE FROM service_order_current_custody WHERE service_order_id=$1`,
      [order.id]
    );

    await client.query(`
      UPDATE service_order_schedule_blocks
      SET status='completed', updated_at=NOW()
      WHERE service_order_id=$1 AND status='active'
    `, [order.id]);

    await client.query(`
      UPDATE service_orders SET estado='cerrada', "updatedAt"=NOW()
      WHERE id=$1
    `, [order.id]);

    await event(client, order.id, 'final_delivery_confirmed', req.user.id, {
      receiver_type:delivery.receiver_type,
      receiver_name:delivery.receiver_name,
      receiver_document:delivery.receiver_document,
    });

    await enqueueNotification(
      client,
      {
        serviceOrderId:
          order.id,
        eventType:
          'delivery_completed',
        payload: {
          codigo_os:
            order.codigo_os,
          receiver_type:
            delivery.receiver_type,
          receiver_name:
            delivery.receiver_name,
          receiver_document:
            delivery.receiver_document,
        },
      }
    );

    await client.query('COMMIT');
    return res.json({
      success:true,
      message:'Entrega final confirmada. Custodia liberada y orden cerrada.',
      data:r.rows[0],
    });
  } catch (error) {
    await rollback(client);
    console.error('Error confirming final delivery:', error);
    return res.status(500).json({ success:false, message:'Error al confirmar entrega final' });
  } finally {
    client.release();
  }
};

exports.saveSatisfaction = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Solo administración puede registrar la encuesta' });
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success:false, message:'Calificación debe estar entre 1 y 5' });
    }

    await client.query('BEGIN');
    const order = await getOrder(client, req.params.id, true);
    if (!order) { await rollback(client); return res.status(404).json({ success:false, message:'Orden no encontrada' }); }
    const delivery = await getDelivery(client, order.id);
    if (delivery?.status !== 'delivered') {
      await rollback(client);
      return res.status(409).json({ success:false, message:'La satisfacción se registra después de la entrega' });
    }

    const r = await client.query(`
      INSERT INTO service_order_satisfaction
        (service_order_id,rating,would_recommend,comment,captured_by,captured_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (service_order_id)
      DO UPDATE SET rating=EXCLUDED.rating,
                    would_recommend=EXCLUDED.would_recommend,
                    comment=EXCLUDED.comment,
                    captured_by=EXCLUDED.captured_by,
                    updated_at=NOW()
      RETURNING *
    `, [
      order.id, rating,
      req.body?.would_recommend === undefined ? null : Boolean(req.body?.would_recommend),
      clean(req.body?.comment,5000),
      req.user.id,
    ]);

    await event(client, order.id, 'satisfaction_recorded', req.user.id, {
      rating,
      would_recommend:req.body?.would_recommend === undefined ? null : Boolean(req.body?.would_recommend),
    });

    await client.query('COMMIT');
    return res.json({ success:true, message:'Satisfacción registrada', data:r.rows[0] });
  } catch (error) {
    await rollback(client);
    console.error('Error saving satisfaction:', error);
    return res.status(500).json({ success:false, message:'Error al registrar satisfacción' });
  } finally {
    client.release();
  }
};
