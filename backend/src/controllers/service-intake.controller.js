'use strict';

const pool = require('../db/pool');
const { randomUUID } = require('crypto');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_CLASSIFICATIONS = new Set(['diagnostic', 'specific']);
const VALID_BILLING = new Set(['prepaid', 'postpaid']);
const VALID_PRIORITIES = new Set(['baja', 'normal', 'alta', 'urgente']);
const VALID_CHANNELS = new Set(['whatsapp', 'email', 'phone', 'in_person', 'other']);
const VALID_PAYMENT_METHODS = new Set([
  'cash',
  'card',
  'transfer',
  'credit',
  'other',
]);

function getRole(req) {
  return req.user?.role?.name || req.user?.rol || null;
}

function isAdmin(req) {
  return getRole(req) === 'admin';
}

function isTechnician(req) {
  return getRole(req) === 'tecnico';
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function cleanText(value, max = 5000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function parseMoney(value) {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

function parsePositiveInt(value) {
  if (value === '' || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
}

function normalizeDate(value) {
  const text = cleanText(value, 20);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTime(value) {
  const text = cleanText(value, 20);
  if (!text) return null;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(text) ? text : null;
}

async function addEvent(client, {
  serviceOrderId = null,
  intakeId = null,
  eventType,
  actorUserId = null,
  metadata = null,
}) {
  await client.query(
    `
      INSERT INTO service_order_events (
        id,
        service_order_id,
        intake_id,
        event_type,
        actor_user_id,
        metadata,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())
    `,
    [
      randomUUID(),
      serviceOrderId,
      intakeId,
      eventType,
      actorUserId,
      JSON.stringify(metadata || {}),
    ]
  );
}

async function getIntake(client, id, lock = false) {
  const result = await client.query(
    `
      SELECT
        i.*,
        CASE
          WHEN c.tipo_persona = 'juridica' THEN c.razon_social
          ELSE CONCAT_WS(' ', c.primer_nombre, c.primer_apellido)
        END AS client_name,
        c.documento AS client_document,
        c.telefono AS client_phone,
        c.email AS client_email,
        c.direccion AS client_address,
        c.ciudad AS client_city,
        creator.nombre1 AS created_by_name,
        creator.apellidos AS created_by_lastname,
        verifier.nombre1 AS payment_verified_by_name,
        verifier.apellidos AS payment_verified_by_lastname
      FROM service_order_intakes i
      JOIN clients c ON c.id = i.client_id
      LEFT JOIN usuarios creator ON creator.id = i.created_by
      LEFT JOIN usuarios verifier ON verifier.id = i.payment_verified_by
      WHERE i.id = $1
      LIMIT 1
      ${lock ? 'FOR UPDATE OF i' : ''}
    `,
    [id]
  );

  return result.rows[0] || null;
}

function canAccessIntake(req, intake) {
  if (!intake) return false;
  if (isAdmin(req)) return true;
  return isTechnician(req) && intake.created_by === req.user?.id;
}

function validateCorePayload(body, { partial = false } = {}) {
  const errors = [];

  const clientId = cleanText(body?.client_id, 100);
  const requestDescription = cleanText(body?.request_description, 5000);
  const classification = cleanText(body?.classification, 30);
  const serviceTypeName = cleanText(body?.service_type_name, 180);
  const billingMode = cleanText(body?.billing_mode, 20) || 'prepaid';
  const priority = cleanText(body?.priority, 20) || 'normal';

  if (!partial || clientId !== null) {
    if (!clientId || !isUuid(clientId)) errors.push('Cliente no válido');
  }

  if (!partial || requestDescription !== null) {
    if (!requestDescription) errors.push('Describe la necesidad del cliente');
  }

  if (classification && !VALID_CLASSIFICATIONS.has(classification)) {
    errors.push('Clasificación no válida');
  }

  if (classification && !serviceTypeName) {
    errors.push('Selecciona o identifica el tipo de servicio');
  }

  if (!VALID_BILLING.has(billingMode)) {
    errors.push('Modalidad de facturación no válida');
  }

  if (!VALID_PRIORITIES.has(priority)) {
    errors.push('Prioridad no válida');
  }

  const baseValue = parseMoney(body?.base_value);
  const estimatedMinutes = parsePositiveInt(body?.estimated_minutes);
  const estimatedDuration = parsePositiveInt(body?.estimated_duration);

  if (Number.isNaN(baseValue)) errors.push('Valor base no válido');
  if (Number.isNaN(estimatedMinutes)) errors.push('Tiempo estimado no válido');
  if (Number.isNaN(estimatedDuration)) errors.push('Duración programada no válida');

  return {
    errors,
    values: {
      clientId,
      sourceType:
        cleanText(body?.source_type, 30) ||
        (body?.created_from_technician ? 'technician' : 'customer'),
      sourceReference: cleanText(body?.source_reference, 180),
      requestDescription,
      classification,
      serviceTypeId: cleanText(body?.service_type_id, 120),
      serviceTypeName,
      serviceTypeCategory: cleanText(body?.service_type_category, 120),
      baseValue,
      estimatedMinutes,
      scopeText: cleanText(body?.scope_text, 5000),
      conditionsText: cleanText(body?.conditions_text, 8000),
      additionalCostsNotice: cleanText(body?.additional_costs_notice, 4000),
      clientAcceptance: Boolean(body?.client_acceptance),
      clientAcceptanceName: cleanText(body?.client_acceptance_name, 180),
      clientAcceptanceDocument: cleanText(body?.client_acceptance_document, 80),
      clientAcceptanceChannel: cleanText(body?.client_acceptance_channel, 40),
      clientAcceptanceReference: cleanText(body?.client_acceptance_reference, 4000),
      billingMode,
      invoiceReference: cleanText(body?.invoice_reference, 180),
      postpaidReason: cleanText(body?.postpaid_reason, 4000),
      priority,
      scheduledDate: normalizeDate(body?.scheduled_date),
      scheduledTime: normalizeTime(body?.scheduled_time),
      estimatedDuration,
    },
  };
}

function evaluateReadiness(intake) {
  const missing = [];

  if (!intake.client_id) missing.push('cliente');
  if (!String(intake.request_description || '').trim()) missing.push('solicitud');
  if (!VALID_CLASSIFICATIONS.has(intake.classification)) missing.push('clasificacion');
  if (!String(intake.service_type_name || '').trim()) missing.push('tipo_servicio');
  if (!String(intake.scope_text || '').trim()) missing.push('alcance');
  if (!String(intake.conditions_text || '').trim()) missing.push('condiciones');

  if (!intake.client_acceptance) {
    missing.push('aceptacion_cliente');
  } else {
    if (!String(intake.client_acceptance_name || '').trim()) missing.push('nombre_aceptante');
    if (!String(intake.client_acceptance_channel || '').trim()) missing.push('canal_aceptacion');
  }

  if (intake.billing_mode === 'prepaid') {
    if (!String(intake.invoice_reference || '').trim()) missing.push('factura');
    if (intake.payment_status !== 'verified') missing.push('pago_verificado');
  }

  if (intake.billing_mode === 'postpaid') {
    if (!String(intake.postpaid_reason || '').trim()) missing.push('motivo_pospago');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

exports.list = async (req, res) => {
  try {
    const role = getRole(req);

    if (!['admin', 'tecnico'].includes(role)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const {
      status = '',
      search = '',
      page = 1,
      limit = 50,
    } = req.query;

    const params = [];
    const where = [];
    let index = 1;

    if (role === 'tecnico') {
      where.push(`i.created_by = $${index++}`);
      params.push(req.user.id);
    }

    if (status) {
      where.push(`i.status = $${index++}`);
      params.push(status);
    }

    if (search) {
      where.push(`
        (
          COALESCE(c.razon_social, '') ILIKE $${index}
          OR CONCAT_WS(' ', c.primer_nombre, c.primer_apellido) ILIKE $${index}
          OR COALESCE(c.documento, '') ILIKE $${index}
          OR COALESCE(i.invoice_reference, '') ILIKE $${index}
          OR COALESCE(i.service_type_name, '') ILIKE $${index}
          OR COALESCE(i.request_description, '') ILIKE $${index}
        )
      `);
      params.push(`%${search}%`);
      index += 1;
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `
        SELECT
          i.*,
          CASE
            WHEN c.tipo_persona = 'juridica' THEN c.razon_social
            ELSE CONCAT_WS(' ', c.primer_nombre, c.primer_apellido)
          END AS client_name,
          c.documento AS client_document,
          creator.nombre1 AS created_by_name,
          creator.apellidos AS created_by_lastname,
          so.codigo_os
        FROM service_order_intakes i
        JOIN clients c ON c.id = i.client_id
        LEFT JOIN usuarios creator ON creator.id = i.created_by
        LEFT JOIN service_orders so ON so.id = i.service_order_id
        ${whereSql}
        ORDER BY i.created_at DESC
        LIMIT $${index++}
        OFFSET $${index++}
      `,
      [...params, safeLimit, offset]
    );

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM service_order_intakes i
        JOIN clients c ON c.id = i.client_id
        ${whereSql}
      `,
      params
    );

    return res.json({
      success: true,
      data: result.rows.map((item) => ({
        ...item,
        readiness: evaluateReadiness(item),
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: countResult.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('Error listing service intakes:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V9_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V9 de creación de servicios',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al listar solicitudes previas',
    });
  }
};

exports.getById = async (req, res) => {
  const client = await pool.connect();

  try {
    const intake = await getIntake(client, req.params.intakeId);

    if (!intake) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (!canAccessIntake(req, intake)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    return res.json({
      success: true,
      data: {
        ...intake,
        readiness: evaluateReadiness(intake),
      },
    });
  } catch (error) {
    console.error('Error reading service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al consultar solicitud previa',
    });
  } finally {
    client.release();
  }
};

exports.create = async (req, res) => {
  const client = await pool.connect();

  try {
    const role = getRole(req);

    if (!['admin', 'tecnico'].includes(role)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const validation = validateCorePayload(req.body || {});

    if (validation.errors.length) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('. '),
      });
    }

    const v = validation.values;

    const clientCheck = await client.query(
      `SELECT id FROM clients WHERE id = $1 AND activo = true LIMIT 1`,
      [v.clientId]
    );

    if (!clientCheck.rows[0]) {
      return res.status(400).json({
        success: false,
        message: 'El cliente no existe o está inactivo',
      });
    }

    if (
      v.clientAcceptanceChannel &&
      !VALID_CHANNELS.has(v.clientAcceptanceChannel)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Canal de aceptación no válido',
      });
    }

    if (v.billingMode === 'postpaid' && !isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          'La modalidad pospago solo puede ser autorizada por administración',
      });
    }

    const id = randomUUID();

    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO service_order_intakes (
          id,
          client_id,
          created_by,
          source_type,
          source_reference,
          request_description,
          classification,
          service_type_id,
          service_type_name,
          service_type_category,
          base_value,
          estimated_minutes,
          scope_text,
          conditions_text,
          additional_costs_notice,
          client_acceptance,
          client_acceptance_name,
          client_acceptance_document,
          client_acceptance_channel,
          client_acceptance_reference,
          client_accepted_at,
          billing_mode,
          invoice_reference,
          payment_status,
          postpaid_reason,
          priority,
          scheduled_date,
          scheduled_time,
          estimated_duration,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,
          CASE WHEN $16::boolean THEN NOW() ELSE NULL END,
          $21,$22,
          CASE WHEN $21 = 'postpaid' THEN 'not_required' ELSE 'pending' END,
          $23,$24,$25,$26,$27,
          'draft',NOW(),NOW()
        )
        RETURNING *
      `,
      [
        id,
        v.clientId,
        req.user.id,
        isTechnician(req) ? 'technician' : v.sourceType,
        v.sourceReference,
        v.requestDescription,
        v.classification,
        v.serviceTypeId,
        v.serviceTypeName,
        v.serviceTypeCategory,
        v.baseValue,
        v.estimatedMinutes,
        v.scopeText,
        v.conditionsText,
        v.additionalCostsNotice,
        v.clientAcceptance,
        v.clientAcceptanceName,
        v.clientAcceptanceDocument,
        v.clientAcceptanceChannel,
        v.clientAcceptanceReference,
        v.billingMode,
        v.invoiceReference,
        v.postpaidReason,
        v.priority,
        v.scheduledDate,
        v.scheduledTime,
        v.estimatedDuration,
      ]
    );

    await addEvent(client, {
      intakeId: id,
      eventType: 'intake_created',
      actorUserId: req.user.id,
      metadata: {
        source_type: isTechnician(req) ? 'technician' : v.sourceType,
        classification: v.classification,
        billing_mode: v.billingMode,
      },
    });

    await client.query('COMMIT');

    const intake = result.rows[0];

    return res.status(201).json({
      success: true,
      message: isTechnician(req)
        ? 'Solicitud registrada. Administración debe completar la validación y activarla como OS.'
        : 'Solicitud previa registrada.',
      data: {
        ...intake,
        readiness: evaluateReadiness(intake),
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error creating service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al registrar la solicitud del servicio',
    });
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  const client = await pool.connect();

  try {
    const intake = await getIntake(client, req.params.intakeId, true);

    if (!intake) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (!canAccessIntake(req, intake)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    if (['activated', 'cancelled'].includes(intake.status)) {
      return res.status(409).json({
        success: false,
        message: 'Una solicitud activada o cancelada ya no puede editarse',
      });
    }

    const validation = validateCorePayload(req.body || {}, { partial: true });

    if (validation.errors.length) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('. '),
      });
    }

    const v = validation.values;

    const mergedBillingMode =
      req.body?.billing_mode !== undefined
        ? v.billingMode
        : intake.billing_mode;

    if (mergedBillingMode === 'postpaid' && !isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede autorizar pospago',
      });
    }

    if (
      req.body?.client_acceptance_channel &&
      !VALID_CHANNELS.has(v.clientAcceptanceChannel)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Canal de aceptación no válido',
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE service_order_intakes
        SET
          request_description = COALESCE($1, request_description),
          classification = COALESCE($2, classification),
          service_type_id = COALESCE($3, service_type_id),
          service_type_name = COALESCE($4, service_type_name),
          service_type_category = COALESCE($5, service_type_category),
          base_value = COALESCE($6, base_value),
          estimated_minutes = COALESCE($7, estimated_minutes),
          scope_text = COALESCE($8, scope_text),
          conditions_text = COALESCE($9, conditions_text),
          additional_costs_notice = COALESCE($10, additional_costs_notice),

          client_acceptance =
            CASE
              WHEN $11::boolean IS TRUE THEN TRUE
              ELSE client_acceptance
            END,
          client_acceptance_name =
            COALESCE($12, client_acceptance_name),
          client_acceptance_document =
            COALESCE($13, client_acceptance_document),
          client_acceptance_channel =
            COALESCE($14, client_acceptance_channel),
          client_acceptance_reference =
            COALESCE($15, client_acceptance_reference),
          client_accepted_at =
            CASE
              WHEN $11::boolean IS TRUE AND client_accepted_at IS NULL
              THEN NOW()
              ELSE client_accepted_at
            END,

          billing_mode = COALESCE($16, billing_mode),
          invoice_reference = COALESCE($17, invoice_reference),
          postpaid_reason = COALESCE($18, postpaid_reason),
          payment_status =
            CASE
              WHEN COALESCE($16, billing_mode) = 'postpaid'
              THEN 'not_required'
              WHEN COALESCE($16, billing_mode) = 'prepaid'
                   AND payment_status = 'not_required'
              THEN 'pending'
              ELSE payment_status
            END,

          priority = COALESCE($19, priority),
          scheduled_date = COALESCE($20, scheduled_date),
          scheduled_time = COALESCE($21, scheduled_time),
          estimated_duration = COALESCE($22, estimated_duration),
          updated_at = NOW()
        WHERE id = $23
        RETURNING *
      `,
      [
        req.body?.request_description !== undefined ? v.requestDescription : null,
        req.body?.classification !== undefined ? v.classification : null,
        req.body?.service_type_id !== undefined ? v.serviceTypeId : null,
        req.body?.service_type_name !== undefined ? v.serviceTypeName : null,
        req.body?.service_type_category !== undefined ? v.serviceTypeCategory : null,
        req.body?.base_value !== undefined ? v.baseValue : null,
        req.body?.estimated_minutes !== undefined ? v.estimatedMinutes : null,
        req.body?.scope_text !== undefined ? v.scopeText : null,
        req.body?.conditions_text !== undefined ? v.conditionsText : null,
        req.body?.additional_costs_notice !== undefined ? v.additionalCostsNotice : null,
        req.body?.client_acceptance === true,
        req.body?.client_acceptance_name !== undefined ? v.clientAcceptanceName : null,
        req.body?.client_acceptance_document !== undefined ? v.clientAcceptanceDocument : null,
        req.body?.client_acceptance_channel !== undefined ? v.clientAcceptanceChannel : null,
        req.body?.client_acceptance_reference !== undefined ? v.clientAcceptanceReference : null,
        req.body?.billing_mode !== undefined ? v.billingMode : null,
        req.body?.invoice_reference !== undefined ? v.invoiceReference : null,
        req.body?.postpaid_reason !== undefined ? v.postpaidReason : null,
        req.body?.priority !== undefined ? v.priority : null,
        req.body?.scheduled_date !== undefined ? v.scheduledDate : null,
        req.body?.scheduled_time !== undefined ? v.scheduledTime : null,
        req.body?.estimated_duration !== undefined ? v.estimatedDuration : null,
        intake.id,
      ]
    );

    await addEvent(client, {
      intakeId: intake.id,
      eventType: 'intake_updated',
      actorUserId: req.user.id,
      metadata: {
        fields: Object.keys(req.body || {}).sort(),
      },
    });

    await client.query('COMMIT');

    const updated = result.rows[0];

    return res.json({
      success: true,
      message: 'Solicitud actualizada',
      data: {
        ...updated,
        readiness: evaluateReadiness(updated),
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error updating service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar solicitud',
    });
  } finally {
    client.release();
  }
};

exports.verifyPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede verificar el pago',
      });
    }

    const intake = await getIntake(client, req.params.intakeId, true);

    if (!intake) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (intake.status !== 'draft' && intake.status !== 'ready') {
      return res.status(409).json({
        success: false,
        message: 'Esta solicitud ya no admite verificación de pago',
      });
    }

    if (intake.billing_mode !== 'prepaid') {
      return res.status(409).json({
        success: false,
        message: 'La solicitud no está configurada como prepago',
      });
    }

    const invoiceReference =
      cleanText(req.body?.invoice_reference, 180) ||
      intake.invoice_reference;
    const paymentReference = cleanText(req.body?.payment_reference, 220);
    const paymentMethod = cleanText(req.body?.payment_method, 60);

    if (!invoiceReference) {
      return res.status(400).json({
        success: false,
        message: 'La referencia de factura es obligatoria',
      });
    }

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: 'Registra una referencia o soporte de pago',
      });
    }

    if (paymentMethod && !VALID_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Método de pago no válido',
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE service_order_intakes
        SET invoice_reference = $1,
            payment_status = 'verified',
            payment_method = $2,
            payment_reference = $3,
            payment_verified_by = $4,
            payment_verified_at = NOW(),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        invoiceReference,
        paymentMethod,
        paymentReference,
        req.user.id,
        intake.id,
      ]
    );

    await addEvent(client, {
      intakeId: intake.id,
      eventType: 'payment_verified',
      actorUserId: req.user.id,
      metadata: {
        invoice_reference: invoiceReference,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
      },
    });

    await client.query('COMMIT');

    const updated = result.rows[0];

    return res.json({
      success: true,
      message: 'Pago verificado',
      data: {
        ...updated,
        readiness: evaluateReadiness(updated),
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error verifying service payment:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al verificar pago',
    });
  } finally {
    client.release();
  }
};

exports.activate = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede activar una solicitud como OS',
      });
    }

    if (!isUuid(req.params.intakeId)) {
      return res.status(400).json({
        success: false,
        message: 'Identificador no válido',
      });
    }

    await client.query('BEGIN');

    const intake = await getIntake(client, req.params.intakeId, true);

    if (!intake) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada',
      });
    }

    if (intake.status === 'activated') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'INTAKE_ALREADY_ACTIVATED',
        message: 'Esta solicitud ya generó una orden de servicio',
        service_order_id: intake.service_order_id,
      });
    }

    if (intake.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Una solicitud cancelada no puede activarse',
      });
    }

    const readiness = evaluateReadiness(intake);

    if (!readiness.ready) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'INTAKE_NOT_READY',
        message: 'Faltan requisitos antes de crear la OS',
        missing: readiness.missing,
      });
    }

    const year = new Date().getFullYear();

    const counterResult = await client.query(
      `
        INSERT INTO service_order_number_counters (
          year,
          last_number,
          updated_at
        )
        VALUES ($1, 1, NOW())
        ON CONFLICT (year)
        DO UPDATE
        SET last_number =
              service_order_number_counters.last_number + 1,
            updated_at = NOW()
        RETURNING last_number
      `,
      [year]
    );

    const nextNumber = Number(counterResult.rows[0].last_number);
    const codigoOs =
      `OS-${year}-${String(nextNumber).padStart(4, '0')}`;

    const serviceOrderId = randomUUID();

    const orderResult = await client.query(
      `
        INSERT INTO service_orders (
          id,
          codigo_os,
          client_id,
          origen_tipo,
          origen_id,
          descripcion_inicial,
          prioridad,
          tecnico_id,
          fecha_agendada,
          hora_inicio_agendada,
          duracion_estimada,
          observaciones,
          notas_internas,
          estado,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1,$2,$3,'intake',$4,$5,$6,NULL,$7,$8,$9,$10,$11,
          'pendiente',NOW(),NOW()
        )
        RETURNING *
      `,
      [
        serviceOrderId,
        codigoOs,
        intake.client_id,
        intake.id,
        intake.request_description,
        intake.priority || 'normal',
        intake.scheduled_date,
        intake.scheduled_time,
        intake.estimated_duration || intake.estimated_minutes || 60,
        intake.scope_text,
        [
          `Clasificación: ${intake.classification || ''}`,
          `Tipo: ${intake.service_type_name || ''}`,
          `Condiciones informadas: ${intake.conditions_text || ''}`,
          `Costos adicionales informados: ${intake.additional_costs_notice || ''}`,
          `Modalidad: ${intake.billing_mode}`,
          `Factura: ${intake.invoice_reference || 'N/A'}`,
        ].join('\n'),
      ]
    );

    try {
      await client.query(
        `
          INSERT INTO service_order_services (
            service_order_id,
            tipo_servicio_id,
            tipo_servicio_nombre,
            descripcion_problema,
            observaciones,
            precio_estimado,
            equipo_relacionado,
            requiere_diagnostico,
            requiere_repuestos,
            repuestos_necesarios,
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,NULL,$7,FALSE,NULL,NOW(),NOW()
          )
        `,
        [
          serviceOrderId,
          intake.service_type_id || null,
          intake.service_type_name,
          intake.request_description,
          intake.scope_text,
          intake.base_value,
          intake.classification === 'diagnostic',
        ]
      );
    } catch (serviceItemError) {
      if (serviceItemError?.code !== '42P01') {
        throw serviceItemError;
      }
    }

    await client.query(
      `
        UPDATE service_order_intakes
        SET status = 'activated',
            service_order_id = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [serviceOrderId, intake.id]
    );

    await addEvent(client, {
      serviceOrderId,
      intakeId: intake.id,
      eventType: 'service_order_created',
      actorUserId: req.user.id,
      metadata: {
        codigo_os: codigoOs,
        billing_mode: intake.billing_mode,
        invoice_reference: intake.invoice_reference,
        payment_status: intake.payment_status,
      },
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Orden ${codigoOs} creada. Ya puede pasar por aprobación y asignación.`,
      data: orderResult.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error activating intake as service order:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al crear la orden de servicio desde la solicitud',
    });
  } finally {
    client.release();
  }
};

exports.cancel = async (req, res) => {
  const client = await pool.connect();

  try {
    const intake = await getIntake(client, req.params.intakeId, true);

    if (!intake) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (!canAccessIntake(req, intake)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    if (intake.status === 'activated') {
      return res.status(409).json({
        success: false,
        message: 'La solicitud ya generó una OS y no puede cancelarse',
      });
    }

    if (intake.status === 'cancelled') {
      return res.json({
        success: true,
        message: 'La solicitud ya estaba cancelada',
      });
    }

    const reason = cleanText(req.body?.reason, 3000);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Indica el motivo de cancelación',
      });
    }

    await client.query('BEGIN');

    await client.query(
      `
        UPDATE service_order_intakes
        SET status = 'cancelled',
            cancelled_reason = $1,
            cancelled_by = $2,
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `,
      [reason, req.user.id, intake.id]
    );

    await addEvent(client, {
      intakeId: intake.id,
      eventType: 'intake_cancelled',
      actorUserId: req.user.id,
      metadata: { reason },
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Solicitud cancelada',
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error cancelling service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cancelar solicitud',
    });
  } finally {
    client.release();
  }
};
