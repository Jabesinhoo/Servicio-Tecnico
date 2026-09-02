'use strict';

const pool = require('../db/pool');
const { randomUUID } = require('crypto');
const fsp = require('fs/promises');
const path = require('path');

const {
  scheduleOrderAutomatically,
} = require('../services/service-scheduling.service');

const {
  enqueueNotification,
} = require('../services/service-notification-outbox.service');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVIDENCE_DIR = path.resolve(
  process.env.SERVICE_EVIDENCE_DIR ||
    path.resolve(
      __dirname,
      '../../uploads/service-orders'
    )
);

const MAX_BYTES = Math.max(
  256 * 1024,
  Number(
    process.env.SERVICE_EVIDENCE_MAX_BYTES ||
      8 * 1024 * 1024
  )
);

const ALLOWED_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
});

const REQUIRED_CHECKS = [
  'tests_completed',
  'functional_verified',
  'accessories_checked',
  'cleaning_done',
];

function isUuid(value) {
  return typeof value === 'string' &&
    UUID_RE.test(value);
}

function getRole(req) {
  return req.user?.role?.name ||
    req.user?.rol ||
    null;
}

function isAdmin(req) {
  return getRole(req) === 'admin';
}

function isTechnician(req) {
  return getRole(req) === 'tecnico';
}

function cleanText(value, max = 5000) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text = String(value).trim();
  return text
    ? text.slice(0, max)
    : null;
}

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {}
}

async function getOrder(
  client,
  orderId,
  lock = false
) {
  const result = await client.query(
    `
      SELECT
        id,
        codigo_os,
        estado::text AS estado,
        tecnico_id,
        fecha_inicio,
        fecha_fin
      FROM service_orders
      WHERE id = $1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function getPrimary(
  client,
  order
) {
  const result = await client.query(
    `
      SELECT technician_id
      FROM service_order_team_members
      WHERE service_order_id = $1
        AND member_role = 'primary'
        AND member_status <> 'removed'
      ORDER BY added_at DESC
      LIMIT 1
    `,
    [order.id]
  );

  return result.rows[0]?.technician_id ||
    order.tecnico_id ||
    null;
}

async function isTeamMember(
  client,
  orderId,
  userId
) {
  const result = await client.query(
    `
      SELECT member_role
      FROM service_order_team_members
      WHERE service_order_id = $1
        AND technician_id = $2
        AND member_status <> 'removed'
      LIMIT 1
    `,
    [orderId, userId]
  );

  return result.rows[0] || null;
}

async function assertAccess(
  client,
  req,
  order
) {
  if (isAdmin(req)) return;

  if (!isTechnician(req)) {
    const error = new Error('No autorizado');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const member = await isTeamMember(
    client,
    order.id,
    req.user.id
  );

  if (
    !member &&
    order.tecnico_id !== req.user.id
  ) {
    const error = new Error(
      'No perteneces al equipo de esta orden'
    );
    error.code = 'FORBIDDEN';
    throw error;
  }
}

async function assertPrimary(
  client,
  req,
  order
) {
  if (!isTechnician(req)) {
    const error = new Error(
      'Esta acción corresponde al técnico responsable'
    );
    error.code = 'PRIMARY_REQUIRED';
    throw error;
  }

  const primary = await getPrimary(
    client,
    order
  );

  if (
    !primary ||
    primary !== req.user.id
  ) {
    const error = new Error(
      'Solo el técnico responsable principal puede completar esta etapa'
    );
    error.code = 'PRIMARY_REQUIRED';
    throw error;
  }

  return primary;
}

async function getClosure(
  client,
  orderId,
  lock = false
) {
  const result = await client.query(
    `
      SELECT *
      FROM service_order_closures
      WHERE service_order_id = $1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function getEvidenceRows(
  client,
  orderId
) {
  const result = await client.query(
    `
      SELECT
        id,
        uploaded_by,
        original_name,
        mime_type,
        size_bytes,
        note,
        created_at
      FROM service_order_final_evidences
      WHERE service_order_id = $1
      ORDER BY created_at DESC
    `,
    [orderId]
  );

  return result.rows;
}

async function addClosureEvent(
  client,
  {
    orderId,
    eventType,
    actorUserId,
    previousStatus = null,
    newStatus = null,
    metadata = null,
  }
) {
  await client.query(
    `
      INSERT INTO service_order_closure_events (
        id,
        service_order_id,
        event_type,
        actor_user_id,
        previous_status,
        new_status,
        metadata,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,NOW()
      )
    `,
    [
      randomUUID(),
      orderId,
      eventType,
      actorUserId || null,
      previousStatus,
      newStatus,
      JSON.stringify(metadata || {}),
    ]
  );
}

async function readBinaryRequest(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > MAX_BYTES) {
      const error = new Error(
        'Archivo demasiado grande'
      );
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function currentCustody(
  client,
  orderId
) {
  const result = await client.query(
    `
      SELECT *
      FROM service_order_current_custody
      WHERE service_order_id = $1
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function transferCustody(
  client,
  {
    orderId,
    fromUserId,
    toUserId,
    performedBy,
    note,
  }
) {
  await client.query(
    `
      UPDATE service_order_current_custody
      SET holder_user_id = $1,
          custody_since = NOW(),
          updated_by = $2,
          updated_at = NOW()
      WHERE service_order_id = $3
    `,
    [
      toUserId,
      performedBy || null,
      orderId,
    ]
  );

  await client.query(
    `
      INSERT INTO service_order_custody_events (
        id,
        service_order_id,
        action,
        from_user_id,
        to_user_id,
        performed_by,
        note,
        created_at
      )
      VALUES (
        $1,$2,'transferida',$3,$4,$5,$6,NOW()
      )
    `,
    [
      randomUUID(),
      orderId,
      fromUserId || null,
      toUserId || null,
      performedBy || null,
      note || null,
    ]
  );
}

function normalizeChecklist(value) {
  const input =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
      ? value
      : {};

  return {
    tests_completed:
      input.tests_completed === true,
    functional_verified:
      input.functional_verified === true,
    accessories_checked:
      input.accessories_checked === true,
    cleaning_done:
      input.cleaning_done === true,
    protective_packaging:
      input.protective_packaging === true,
    safety_checked:
      input.safety_checked === true,
  };
}

exports.getClosure = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden no válido',
      });
    }

    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertAccess(
      client,
      req,
      order
    );

    const [
      closure,
      evidences,
      primary,
      custody,
    ] = await Promise.all([
      getClosure(client, order.id),
      getEvidenceRows(client, order.id),
      getPrimary(client, order),
      currentCustody(client, order.id),
    ]);

    return res.json({
      success: true,
      data: {
        service_order_id: order.id,
        order_state: order.estado,
        primary_technician_id: primary,
        current_custody_holder:
          custody?.holder_user_id || null,
        closure: closure || {
          service_order_id: order.id,
          status: 'draft',
          checklist: {},
          final_result: null,
          final_notes: null,
        },
        evidences,
      },
    });
  } catch (error) {
    console.error(
      'Error loading technical closure:',
      error
    );

    if (
      [
        'FORBIDDEN',
        'PRIMARY_REQUIRED',
      ].includes(error?.code)
    ) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V12_TABLES_NOT_INSTALLED',
        message:
          'Faltan las tablas V12 de cierre técnico',
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al cargar el cierre técnico',
    });
  } finally {
    client.release();
  }
};

exports.saveChecklist = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertPrimary(
      client,
      req,
      order
    );

    if (order.estado !== 'en_ejecucion') {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code: 'SERVICE_NOT_IN_EXECUTION',
        message:
          'El checklist de cierre solo se edita mientras el servicio está en ejecución',
      });
    }

    const existing = await getClosure(
      client,
      order.id,
      true
    );

    if (
      existing &&
      ![
        'draft',
        'rework_required',
      ].includes(existing.status)
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'El cierre técnico ya fue confirmado y no puede editarse',
      });
    }

    const checklist = normalizeChecklist(
      req.body?.checklist
    );

    const finalResult = cleanText(
      req.body?.final_result,
      6000
    );

    const finalNotes = cleanText(
      req.body?.final_notes,
      6000
    );

    const result = await client.query(
      `
        INSERT INTO service_order_closures (
          service_order_id,
          status,
          checklist,
          final_result,
          final_notes,
          last_checklist_saved_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          COALESCE($5,'draft'),
          $2::jsonb,
          $3,
          $4,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (service_order_id)
        DO UPDATE SET
          checklist = EXCLUDED.checklist,
          final_result = EXCLUDED.final_result,
          final_notes = EXCLUDED.final_notes,
          last_checklist_saved_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `,
      [
        order.id,
        JSON.stringify(checklist),
        finalResult,
        finalNotes,
        existing?.status || 'draft',
      ]
    );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'closing_checklist_saved',
        actorUserId: req.user.id,
        previousStatus:
          existing?.status || 'draft',
        newStatus:
          existing?.status || 'draft',
        metadata: {
          checklist,
        },
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Checklist de cierre guardado',
      data: result.rows[0],
    });
  } catch (error) {
    await rollback(client);

    console.error(
      'Error saving closing checklist:',
      error
    );

    if (
      error?.code === 'PRIMARY_REQUIRED'
    ) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al guardar checklist de cierre',
    });
  } finally {
    client.release();
  }
};

exports.uploadEvidence = async (req, res) => {
  const client = await pool.connect();
  let absolutePath = null;

  try {
    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertPrimary(
      client,
      req,
      order
    );

    if (order.estado !== 'en_ejecucion') {
      return res.status(409).json({
        success: false,
        message:
          'Las evidencias finales solo se cargan durante la ejecución',
      });
    }

    const closure = await getClosure(
      client,
      order.id
    );

    if (
      closure &&
      ![
        'draft',
        'rework_required',
      ].includes(closure.status)
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Las evidencias de un cierre confirmado ya no pueden modificarse',
      });
    }

    const mimeType = String(
      req.headers['content-type'] || ''
    )
      .split(';')[0]
      .trim()
      .toLowerCase();

    const extension =
      ALLOWED_MIME[mimeType];

    if (!extension) {
      return res.status(415).json({
        success: false,
        message:
          'Formato no permitido. Usa JPG, PNG, WEBP o PDF',
      });
    }

    const buffer =
      await readBinaryRequest(req);

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        message: 'El archivo está vacío',
      });
    }

    const evidenceId = randomUUID();

    const relativePath = path.join(
      order.id,
      'final',
      `${evidenceId}${extension}`
    );

    absolutePath = path.resolve(
      EVIDENCE_DIR,
      relativePath
    );

    if (
      !absolutePath.startsWith(
        `${EVIDENCE_DIR}${path.sep}`
      )
    ) {
      throw new Error(
        'Ruta de evidencia inválida'
      );
    }

    await fsp.mkdir(
      path.dirname(absolutePath),
      { recursive: true }
    );

    await fsp.writeFile(
      absolutePath,
      buffer,
      { flag: 'wx' }
    );

    const result = await client.query(
      `
        INSERT INTO service_order_final_evidences (
          id,
          service_order_id,
          uploaded_by,
          original_name,
          mime_type,
          size_bytes,
          storage_path,
          note,
          created_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,NOW()
        )
        RETURNING
          id,
          uploaded_by,
          original_name,
          mime_type,
          size_bytes,
          note,
          created_at
      `,
      [
        evidenceId,
        order.id,
        req.user.id,
        cleanText(
          req.query?.name,
          255
        ) || `evidencia-final${extension}`,
        mimeType,
        buffer.length,
        relativePath,
        cleanText(
          req.query?.note,
          1500
        ),
      ]
    );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'final_evidence_added',
        actorUserId: req.user.id,
        previousStatus:
          closure?.status || 'draft',
        newStatus:
          closure?.status || 'draft',
        metadata: {
          evidence_id: evidenceId,
          mime_type: mimeType,
        },
      }
    );

    return res.status(201).json({
      success: true,
      message:
        'Evidencia final registrada',
      data: result.rows[0],
    });
  } catch (error) {
    if (absolutePath) {
      try {
        await fsp.unlink(absolutePath);
      } catch (_) {}
    }

    console.error(
      'Error uploading final evidence:',
      error
    );

    if (
      error?.code === 'FILE_TOO_LARGE'
    ) {
      return res.status(413).json({
        success: false,
        message:
          `El archivo supera ${Math.round(
            MAX_BYTES / 1024 / 1024
          )} MB`,
      });
    }

    if (
      error?.code === 'PRIMARY_REQUIRED'
    ) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al cargar evidencia final',
    });
  } finally {
    client.release();
  }
};

exports.getEvidenceFile = async (
  req,
  res
) => {
  const client = await pool.connect();

  try {
    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertAccess(
      client,
      req,
      order
    );

    const result = await client.query(
      `
        SELECT
          storage_path,
          mime_type,
          original_name
        FROM service_order_final_evidences
        WHERE id = $1
          AND service_order_id = $2
        LIMIT 1
      `,
      [
        req.params.evidenceId,
        order.id,
      ]
    );

    const evidence = result.rows[0];

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidencia no encontrada',
      });
    }

    const absolutePath = path.resolve(
      EVIDENCE_DIR,
      evidence.storage_path
    );

    if (
      !absolutePath.startsWith(
        `${EVIDENCE_DIR}${path.sep}`
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Ruta de evidencia inválida',
      });
    }

    await fsp.access(absolutePath);

    res.setHeader(
      'Content-Type',
      evidence.mime_type
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error(
      'Error opening final evidence:',
      error
    );

    if (error?.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message:
          'El archivo no existe en almacenamiento',
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al abrir evidencia final',
    });
  } finally {
    client.release();
  }
};

exports.technicalClose = async (
  req,
  res
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertPrimary(
      client,
      req,
      order
    );

    if (order.estado !== 'en_ejecucion') {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'El servicio debe estar en ejecución para realizar el cierre técnico',
      });
    }

    const closure = await getClosure(
      client,
      order.id,
      true
    );

    if (!closure) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'Primero completa y guarda el checklist de cierre',
      });
    }

    if (
      ![
        'draft',
        'rework_required',
      ].includes(closure.status)
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'Esta etapa ya fue cerrada',
      });
    }

    const checklist =
      closure.checklist || {};

    const missingChecks =
      REQUIRED_CHECKS.filter(
        (key) => checklist[key] !== true
      );

    if (missingChecks.length) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code:
          'CLOSING_CHECKLIST_INCOMPLETE',
        message:
          'Completa todas las verificaciones obligatorias del cierre',
        missing: missingChecks,
      });
    }

    if (
      !String(
        closure.final_result || ''
      ).trim()
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'Registra el resultado final del servicio',
      });
    }

    const diagnosis = await client.query(
      `
        SELECT status
        FROM service_order_diagnostics
        WHERE service_order_id = $1
        LIMIT 1
      `,
      [order.id]
    );

    if (
      diagnosis.rows[0]?.status !==
      'confirmed'
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code:
          'CONFIRMED_DIAGNOSIS_REQUIRED',
        message:
          'El diagnóstico o resultado debe estar confirmado antes del cierre técnico',
      });
    }

    const evidenceResult =
      await client.query(
        `
          SELECT COUNT(*)::int AS total
          FROM service_order_final_evidences
          WHERE service_order_id = $1
            AND (
              $2::timestamptz IS NULL
              OR created_at > $2
            )
        `,
        [
          order.id,
          closure.status ===
          'rework_required'
            ? closure.rework_started_at
            : null,
        ]
      );

    if (
      Number(
        evidenceResult.rows[0]?.total ||
          0
      ) < 1
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code:
          'FINAL_EVIDENCE_REQUIRED',
        message:
          closure.status ===
          'rework_required'
            ? 'Después del reproceso debes cargar una nueva evidencia final'
            : 'Debes cargar al menos una evidencia final',
      });
    }

    if (
      closure.status ===
        'rework_required' &&
      (
        !closure.last_checklist_saved_at ||
        (
          closure.rework_started_at &&
          new Date(
            closure.last_checklist_saved_at
          ) <= new Date(
            closure.rework_started_at
          )
        )
      )
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code:
          'REWORK_CHECKLIST_REQUIRED',
        message:
          'Después del reproceso vuelve a guardar el checklist de cierre',
      });
    }

    const custody =
      await currentCustody(
        client,
        order.id
      );

    if (
      !custody ||
      custody.holder_user_id !==
        req.user.id
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        code:
          'PRIMARY_CUSTODY_REQUIRED',
        message:
          'El técnico responsable debe conservar la custodia para cerrar técnicamente',
      });
    }

    const result = await client.query(
      `
        UPDATE service_order_closures
        SET status =
              'technical_closed',
            technical_closed_by = $1,
            technical_closed_at = NOW(),
            updated_at = NOW()
        WHERE service_order_id = $2
        RETURNING *
      `,
      [
        req.user.id,
        order.id,
      ]
    );

    await client.query(
      `
        UPDATE service_orders
        SET estado = 'en_espera',
            fecha_fin = NOW(),
            "updatedAt" = NOW()
        WHERE id = $1
      `,
      [order.id]
    );

    await client.query(
      `
        UPDATE service_order_schedule_blocks
        SET status = 'completed',
            end_at =
              GREATEST(
                start_at +
                  INTERVAL '1 minute',
                NOW()
              ),
            updated_at = NOW()
        WHERE service_order_id = $1
          AND status = 'active'
      `,
      [order.id]
    );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'technical_closed',
        actorUserId: req.user.id,
        previousStatus:
          closure.status,
        newStatus:
          'technical_closed',
        metadata: {
          actual_finish:
            new Date().toISOString(),
        },
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Cierre técnico confirmado. La agenda del equipo fue liberada con la hora real de finalización.',
      data: result.rows[0],
    });
  } catch (error) {
    await rollback(client);

    console.error(
      'Error technical closing:',
      error
    );

    if (
      error?.code ===
      'PRIMARY_REQUIRED'
    ) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al confirmar cierre técnico',
    });
  } finally {
    client.release();
  }
};

exports.handToDirection = async (
  req,
  res
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    await assertPrimary(
      client,
      req,
      order
    );

    const closure = await getClosure(
      client,
      order.id,
      true
    );

    if (
      closure?.status !==
      'technical_closed'
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'Primero debe existir un cierre técnico confirmado',
      });
    }

    const result = await client.query(
      `
        UPDATE service_order_closures
        SET status =
              'handed_to_direction',
            handed_to_direction_by = $1,
            handed_to_direction_at = NOW(),
            updated_at = NOW()
        WHERE service_order_id = $2
        RETURNING *
      `,
      [
        req.user.id,
        order.id,
      ]
    );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'handed_to_direction',
        actorUserId: req.user.id,
        previousStatus:
          closure.status,
        newStatus:
          'handed_to_direction',
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Entrega a Dirección Técnica registrada. Falta que administración reciba formalmente la custodia.',
      data: result.rows[0],
    });
  } catch (error) {
    await rollback(client);

    console.error(
      'Error handing to direction:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al registrar entrega a Dirección Técnica',
    });
  } finally {
    client.release();
  }
};

exports.receiveAtDirection = async (
  req,
  res
) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          'Solo administración/Dirección Técnica puede recibir el equipo',
      });
    }

    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    const closure = await getClosure(
      client,
      order.id,
      true
    );

    if (
      closure?.status !==
      'handed_to_direction'
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'La orden todavía no fue entregada formalmente a Dirección Técnica',
      });
    }

    const custody =
      await currentCustody(
        client,
        order.id
      );

    if (!custody) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'La orden no tiene custodia activa para transferir',
      });
    }

    await transferCustody(
      client,
      {
        orderId: order.id,
        fromUserId:
          custody.holder_user_id,
        toUserId: req.user.id,
        performedBy: req.user.id,
        note:
          'Recepción formal en Dirección Técnica V12',
      }
    );

    const result = await client.query(
      `
        UPDATE service_order_closures
        SET status =
              'direction_received',
            direction_received_by = $1,
            direction_received_at = NOW(),
            updated_at = NOW()
        WHERE service_order_id = $2
        RETURNING *
      `,
      [
        req.user.id,
        order.id,
      ]
    );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'direction_received',
        actorUserId: req.user.id,
        previousStatus:
          closure.status,
        newStatus:
          'direction_received',
        metadata: {
          custody_from:
            custody.holder_user_id,
          custody_to:
            req.user.id,
        },
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Dirección Técnica recibió el equipo y asumió la custodia.',
      data: result.rows[0],
    });
  } catch (error) {
    await rollback(client);

    console.error(
      'Error receiving at direction:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al recibir el equipo en Dirección Técnica',
    });
  } finally {
    client.release();
  }
};

exports.validateDirection = async (
  req,
  res
) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          'Solo administración/Dirección Técnica puede validar el cierre',
      });
    }

    const decision =
      cleanText(
        req.body?.decision,
        20
      );

    const note =
      cleanText(
        req.body?.note,
        5000
      );

    if (
      ![
        'approved',
        'rejected',
      ].includes(decision)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'La decisión debe ser approved o rejected',
      });
    }

    if (
      decision === 'rejected' &&
      !note
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Indica el motivo del reproceso',
      });
    }

    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    const closure = await getClosure(
      client,
      order.id,
      true
    );

    if (
      closure?.status !==
      'direction_received'
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'Dirección Técnica debe recibir primero el equipo',
      });
    }

    if (decision === 'approved') {
      const result = await client.query(
        `
          UPDATE service_order_closures
          SET status = 'validated',
              direction_validated_by = $1,
              direction_validated_at = NOW(),
              direction_validation_note = $2,
              updated_at = NOW()
          WHERE service_order_id = $3
          RETURNING *
        `,
        [
          req.user.id,
          note,
          order.id,
        ]
      );

      await addClosureEvent(
        client,
        {
          orderId: order.id,
          eventType:
            'direction_validated',
          actorUserId: req.user.id,
          previousStatus:
            closure.status,
          newStatus:
            'validated',
          metadata: {
            note,
          },
        }
      );

      await enqueueNotification(
        client,
        {
          serviceOrderId:
            order.id,
          eventType:
            'ready_for_pickup',
          payload: {
            codigo_os:
              order.codigo_os,
            validation_note:
              note,
          },
        }
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message:
          'Cierre validado por Dirección Técnica. La OS queda pendiente de entrega final al cliente.',
        data: result.rows[0],
      });
    }

    const primary =
      await getPrimary(
        client,
        order
      );

    if (!primary) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message:
          'No se encontró técnico principal para devolver el reproceso',
      });
    }

    const custody =
      await currentCustody(
        client,
        order.id
      );

    if (
      custody &&
      custody.holder_user_id !==
        primary
    ) {
      await transferCustody(
        client,
        {
          orderId: order.id,
          fromUserId:
            custody.holder_user_id,
          toUserId: primary,
          performedBy:
            req.user.id,
          note:
            'Devolución al técnico principal por reproceso V12',
        }
      );
    }

    const result = await client.query(
      `
        UPDATE service_order_closures
        SET status =
              'rework_required',
            rework_reason = $1,
            rework_started_at = NOW(),
            rework_count =
              rework_count + 1,
            direction_validated_by = $2,
            direction_validated_at = NOW(),
            direction_validation_note = $1,
            updated_at = NOW()
        WHERE service_order_id = $3
        RETURNING *
      `,
      [
        note,
        req.user.id,
        order.id,
      ]
    );

    await client.query(
      `
        UPDATE service_orders
        SET fecha_fin = NULL,
            "updatedAt" = NOW()
        WHERE id = $1
      `,
      [order.id]
    );

    const schedule =
      await scheduleOrderAutomatically(
        client,
        {
          orderId: order.id,
          actorUserId: req.user.id,
          replaceExisting: true,
        }
      );

    await addClosureEvent(
      client,
      {
        orderId: order.id,
        eventType:
          'direction_rejected_rework',
        actorUserId: req.user.id,
        previousStatus:
          closure.status,
        newStatus:
          'rework_required',
        metadata: {
          reason: note,
          primary_technician_id:
            primary,
          schedule,
        },
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Dirección Técnica devolvió la orden a reproceso. Se reasignó la custodia al técnico principal y se recalculó su agenda.',
      data: result.rows[0],
      schedule,
    });
  } catch (error) {
    await rollback(client);

    console.error(
      'Error validating at direction:',
      error
    );

    if (
      [
        'NO_COMMON_SLOT',
        'TEAM_REQUIRED_FOR_SCHEDULE',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'Error al validar cierre en Dirección Técnica',
    });
  } finally {
    client.release();
  }
};
