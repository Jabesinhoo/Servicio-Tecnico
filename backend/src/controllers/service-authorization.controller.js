'use strict';

const pool = require('../db/pool');
const { randomUUID } = require('crypto');
const fsp = require('fs/promises');
const path = require('path');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TYPES = new Set([
  'repair',
  'materials',
  'additional_work',
  'other',
]);

const DECISION_STATUSES = new Set([
  'approved',
  'rejected',
]);

const DECISION_CHANNELS = new Set([
  'whatsapp',
  'email',
  'phone',
  'in_person',
  'other',
]);

const AUTH_EVIDENCE_DIR = path.resolve(
  process.env.SERVICE_EVIDENCE_DIR ||
    path.resolve(__dirname, '../../uploads/service-orders')
);

const AUTH_EVIDENCE_MAX_BYTES = Math.max(
  256 * 1024,
  Number(process.env.SERVICE_EVIDENCE_MAX_BYTES || 8 * 1024 * 1024)
);

const ALLOWED_AUTH_EVIDENCE_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
});

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

function cleanText(value, max = 4000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function parseMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

async function readBinaryRequest(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > AUTH_EVIDENCE_MAX_BYTES) {
      const error = new Error('Archivo demasiado grande');
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function getOrderAccess(client, req, orderId) {
  if (!isUuid(orderId)) {
    return { ok: false, status: 400, message: 'ID de orden no válido' };
  }

  const result = await client.query(
    `
      SELECT id, codigo_os, estado, tecnico_id
      FROM service_orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  const order = result.rows[0];

  if (!order) {
    return { ok: false, status: 404, message: 'Orden de servicio no encontrada' };
  }

  if (isAdmin(req)) {
    return { ok: true, order };
  }

  if (isTechnician(req) && order.tecnico_id === req.user?.id) {
    return { ok: true, order };
  }

  return { ok: false, status: 403, message: 'No tienes acceso a esta orden' };
}

async function loadAuthorization(client, orderId, authorizationId, lock = false) {
  const result = await client.query(
    `
      SELECT *
      FROM service_order_authorizations
      WHERE id = $1
        AND service_order_id = $2
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [authorizationId, orderId]
  );

  return result.rows[0] || null;
}

async function getAuthorizationRows(client, orderId) {
  const authResult = await client.query(
    `
      SELECT
        a.*,
        requester.nombre1 AS requested_by_name,
        requester.apellidos AS requested_by_lastname,
        decider.nombre1 AS decided_by_name,
        decider.apellidos AS decided_by_lastname,
        (
          SELECT COUNT(*)::int
          FROM service_order_authorization_evidences e
          WHERE e.authorization_id = a.id
        ) AS evidence_count
      FROM service_order_authorizations a
      LEFT JOIN usuarios requester ON requester.id = a.requested_by
      LEFT JOIN usuarios decider ON decider.id = a.decided_by
      WHERE a.service_order_id = $1
      ORDER BY a.created_at DESC
    `,
    [orderId]
  );

  if (authResult.rows.length === 0) return [];

  const ids = authResult.rows.map((item) => item.id);

  const evidenceResult = await client.query(
    `
      SELECT
        id,
        authorization_id,
        uploaded_by,
        original_name,
        mime_type,
        size_bytes,
        note,
        created_at
      FROM service_order_authorization_evidences
      WHERE authorization_id = ANY($1::uuid[])
      ORDER BY created_at DESC
    `,
    [ids]
  );

  const byAuth = new Map();

  for (const evidence of evidenceResult.rows) {
    if (!byAuth.has(evidence.authorization_id)) {
      byAuth.set(evidence.authorization_id, []);
    }
    byAuth.get(evidence.authorization_id).push(evidence);
  }

  return authResult.rows.map((item) => ({
    ...item,
    evidences: byAuth.get(item.id) || [],
  }));
}

async function addEvent(
  client,
  {
    authorizationId,
    eventType,
    actorUserId,
    previousStatus = null,
    newStatus = null,
    metadata = null,
  }
) {
  await client.query(
    `
      INSERT INTO service_order_authorization_events (
        id,
        authorization_id,
        event_type,
        actor_user_id,
        previous_status,
        new_status,
        metadata,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())
    `,
    [
      randomUUID(),
      authorizationId,
      eventType,
      actorUserId || null,
      previousStatus,
      newStatus,
      JSON.stringify(metadata || {}),
    ]
  );
}

exports.overview = async (req, res) => {
  const client = await pool.connect();

  try {
    const role = getRole(req);

    if (!['admin', 'tecnico'].includes(role)) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const params = [];
    let technicianFilter = '';

    if (role === 'tecnico') {
      params.push(req.user.id);
      technicianFilter = 'AND so.tecnico_id = $1';
    }

    const result = await client.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (a.service_order_id)
            a.service_order_id,
            a.id AS authorization_id,
            a.status AS authorization_status,
            a.request_type AS authorization_type,
            a.subject AS authorization_subject,
            a.requested_at AS authorization_requested_at,
            a.decided_at AS authorization_decided_at
          FROM service_order_authorizations a
          ORDER BY a.service_order_id, a.created_at DESC
        )
        SELECT latest.*
        FROM latest
        JOIN service_orders so
          ON so.id = latest.service_order_id
        WHERE 1=1
          ${technicianFilter}
      `,
      params
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error loading authorization overview:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V8_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V8 de autorizaciones',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al cargar estado de autorizaciones',
    });
  } finally {
    client.release();
  }
};

exports.list = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const access = await getOrderAccess(client, req, id);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const rows = await getAuthorizationRows(client, id);

    return res.json({
      success: true,
      data: rows,
      current: rows[0] || null,
    });
  } catch (error) {
    console.error('Error loading client authorizations:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V8_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V8 de autorizaciones',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al cargar autorizaciones',
    });
  } finally {
    client.release();
  }
};

exports.create = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const access = await getOrderAccess(client, req, id);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const requestType = cleanText(req.body?.request_type, 40) || 'additional_work';
    const subject = cleanText(req.body?.subject, 180);
    const description = cleanText(req.body?.description, 5000);
    const requestedComponents = cleanText(req.body?.requested_components, 5000);
    const estimatedAmount = parseMoney(req.body?.estimated_amount);

    if (!REQUEST_TYPES.has(requestType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de autorización no válido',
      });
    }

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Asunto y descripción son obligatorios',
      });
    }

    if (Number.isNaN(estimatedAmount)) {
      return res.status(400).json({
        success: false,
        message: 'El valor estimado no es válido',
      });
    }

    await client.query('BEGIN');

    const orderLock = await client.query(
      `
        SELECT id, estado, tecnico_id
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    const order = orderLock.rows[0];

    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Orden de servicio no encontrada',
      });
    }

    if (!isAdmin(req) && order.tecnico_id !== req.user?.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Esta orden no está asignada a tu cuenta',
      });
    }

    const diagnosisResult = await client.query(
      `
        SELECT
          id,
          status,
          work_type,
          result_status,
          description,
          solution_available,
          approximate_cost,
          required_components,
          functional_result,
          activities_performed,
          confirmed_at
        FROM service_order_diagnostics
        WHERE service_order_id = $1
        LIMIT 1
      `,
      [id]
    );

    const diagnosis = diagnosisResult.rows[0];

    if (!diagnosis || diagnosis.status !== 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'CONFIRMED_DIAGNOSIS_REQUIRED',
        message: 'Primero debes confirmar el diagnóstico o resultado del servicio',
      });
    }

    if (
      diagnosis.work_type === 'diagnostico' &&
      diagnosis.solution_available === false
    ) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'NO_ADDITIONAL_WORK_RECOMMENDED',
        message: 'El diagnóstico confirmado indica que no existe una solución adicional por autorizar',
      });
    }

    const pendingResult = await client.query(
      `
        SELECT id
        FROM service_order_authorizations
        WHERE service_order_id = $1
          AND status = 'pending'
        LIMIT 1
      `,
      [id]
    );

    if (pendingResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'AUTHORIZATION_ALREADY_PENDING',
        message: 'Ya existe una autorización pendiente para esta orden',
      });
    }

    const authorizationId = randomUUID();

    const snapshot = {
      work_type: diagnosis.work_type,
      result_status: diagnosis.result_status,
      description: diagnosis.description,
      solution_available: diagnosis.solution_available,
      approximate_cost: diagnosis.approximate_cost,
      required_components: diagnosis.required_components,
      functional_result: diagnosis.functional_result,
      activities_performed: diagnosis.activities_performed,
      confirmed_at: diagnosis.confirmed_at,
    };

    const effectiveAmount =
      estimatedAmount === null
        ? diagnosis.approximate_cost
        : estimatedAmount;

    const effectiveComponents =
      requestedComponents ||
      diagnosis.required_components ||
      null;

    const insertResult = await client.query(
      `
        INSERT INTO service_order_authorizations (
          id,
          service_order_id,
          diagnosis_id,
          requested_by,
          request_type,
          subject,
          description,
          estimated_amount,
          requested_components,
          diagnosis_snapshot,
          status,
          requested_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,
          'pending',NOW(),NOW(),NOW()
        )
        RETURNING *
      `,
      [
        authorizationId,
        id,
        diagnosis.id,
        req.user.id,
        requestType,
        subject,
        description,
        effectiveAmount,
        effectiveComponents,
        JSON.stringify(snapshot),
      ]
    );

    await addEvent(client, {
      authorizationId,
      eventType: 'requested',
      actorUserId: req.user.id,
      previousStatus: null,
      newStatus: 'pending',
      metadata: {
        request_type: requestType,
        estimated_amount: effectiveAmount,
      },
    });

    if (order.estado === 'en_ejecucion') {
      await client.query(
        `
          UPDATE service_orders
          SET estado = 'en_espera',
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [id]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message:
        order.estado === 'en_ejecucion'
          ? 'Autorización solicitada. El servicio quedó en espera hasta recibir decisión del cliente.'
          : 'Autorización solicitada.',
      data: insertResult.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error creating client authorization:', error);

    if (error?.code === '23505') {
      return res.status(409).json({
        success: false,
        code: 'AUTHORIZATION_ALREADY_PENDING',
        message: 'Ya existe una autorización pendiente para esta orden',
      });
    }

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V8_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V8 de autorizaciones',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al solicitar autorización',
    });
  } finally {
    client.release();
  }
};

exports.uploadEvidence = async (req, res) => {
  const client = await pool.connect();
  let absolutePath = null;

  try {
    const { id, authorizationId } = req.params;
    const access = await getOrderAccess(client, req, id);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    if (!isUuid(authorizationId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de autorización no válido',
      });
    }

    const authorization = await loadAuthorization(
      client,
      id,
      authorizationId
    );

    if (!authorization) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada',
      });
    }

    if (authorization.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'La evidencia de una autorización decidida ya no puede modificarse',
      });
    }

    const mimeType = String(req.headers['content-type'] || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    const extension = ALLOWED_AUTH_EVIDENCE_MIME[mimeType];

    if (!extension) {
      return res.status(415).json({
        success: false,
        message: 'Formato no permitido. Usa JPG, PNG, WEBP o PDF',
      });
    }

    const buffer = await readBinaryRequest(req);

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        message: 'El archivo está vacío',
      });
    }

    const evidenceId = randomUUID();
    const originalName =
      cleanText(req.query?.name, 255) ||
      `autorizacion${extension}`;
    const note = cleanText(req.query?.note, 1500);

    const relativeDir = path.join(
      id,
      'authorization',
      authorizationId
    );
    const relativePath = path.join(
      relativeDir,
      `${evidenceId}${extension}`
    );
    absolutePath = path.resolve(
      AUTH_EVIDENCE_DIR,
      relativePath
    );

    if (
      !absolutePath.startsWith(
        `${AUTH_EVIDENCE_DIR}${path.sep}`
      )
    ) {
      throw new Error('Ruta de evidencia inválida');
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
        INSERT INTO service_order_authorization_evidences (
          id,
          authorization_id,
          uploaded_by,
          original_name,
          mime_type,
          size_bytes,
          storage_path,
          note,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        RETURNING
          id,
          authorization_id,
          uploaded_by,
          original_name,
          mime_type,
          size_bytes,
          note,
          created_at
      `,
      [
        evidenceId,
        authorizationId,
        req.user.id,
        originalName,
        mimeType,
        buffer.length,
        relativePath,
        note,
      ]
    );

    await addEvent(client, {
      authorizationId,
      eventType: 'evidence_added',
      actorUserId: req.user.id,
      previousStatus: authorization.status,
      newStatus: authorization.status,
      metadata: {
        evidence_id: evidenceId,
        mime_type: mimeType,
        original_name: originalName,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Evidencia de autorización registrada',
      data: result.rows[0],
    });
  } catch (error) {
    if (absolutePath) {
      try { await fsp.unlink(absolutePath); } catch (_) {}
    }

    console.error('Error uploading authorization evidence:', error);

    if (error?.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({
        success: false,
        message: `El archivo supera el límite de ${Math.round(
          AUTH_EVIDENCE_MAX_BYTES / 1024 / 1024
        )} MB`,
      });
    }

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V8_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V8 de autorizaciones',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al cargar evidencia de autorización',
    });
  } finally {
    client.release();
  }
};

exports.getEvidenceFile = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      id,
      authorizationId,
      evidenceId,
    } = req.params;

    const access = await getOrderAccess(client, req, id);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    if (
      !isUuid(authorizationId) ||
      !isUuid(evidenceId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Identificador no válido',
      });
    }

    const result = await client.query(
      `
        SELECT
          e.storage_path,
          e.mime_type,
          e.original_name
        FROM service_order_authorization_evidences e
        JOIN service_order_authorizations a
          ON a.id = e.authorization_id
        WHERE e.id = $1
          AND e.authorization_id = $2
          AND a.service_order_id = $3
        LIMIT 1
      `,
      [evidenceId, authorizationId, id]
    );

    const evidence = result.rows[0];

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidencia no encontrada',
      });
    }

    const absolutePath = path.resolve(
      AUTH_EVIDENCE_DIR,
      evidence.storage_path
    );

    if (
      !absolutePath.startsWith(
        `${AUTH_EVIDENCE_DIR}${path.sep}`
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Ruta de evidencia inválida',
      });
    }

    await fsp.access(absolutePath);

    res.setHeader(
      'Content-Type',
      evidence.mime_type
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(
        evidence.original_name || 'evidencia'
      )}"`
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Error reading authorization evidence:', error);

    if (error?.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: 'El archivo de evidencia no existe en almacenamiento',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al abrir evidencia',
    });
  } finally {
    client.release();
  }
};

exports.decide = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, authorizationId } = req.params;

    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede registrar la decisión final del cliente',
      });
    }

    const access = await getOrderAccess(client, req, id);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const decision = cleanText(req.body?.decision, 30);
    const clientName = cleanText(req.body?.client_name, 180);
    const clientDocument = cleanText(req.body?.client_document, 80);
    const channel = cleanText(req.body?.decision_channel, 40);
    const reference = cleanText(req.body?.decision_reference, 4000);
    const note = cleanText(req.body?.decision_note, 4000);

    if (!DECISION_STATUSES.has(decision)) {
      return res.status(400).json({
        success: false,
        message: 'La decisión debe ser approved o rejected',
      });
    }

    if (!clientName || !channel) {
      return res.status(400).json({
        success: false,
        message: 'Nombre del cliente y canal de autorización son obligatorios',
      });
    }

    if (!DECISION_CHANNELS.has(channel)) {
      return res.status(400).json({
        success: false,
        message: 'Canal de autorización no válido',
      });
    }

    await client.query('BEGIN');

    const authorization = await loadAuthorization(
      client,
      id,
      authorizationId,
      true
    );

    if (!authorization) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada',
      });
    }

    if (authorization.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Esta autorización ya tiene una decisión registrada',
      });
    }

    const evidenceCountResult = await client.query(
      `
        SELECT COUNT(*)::int AS total
        FROM service_order_authorization_evidences
        WHERE authorization_id = $1
      `,
      [authorizationId]
    );

    const evidenceCount =
      Number(evidenceCountResult.rows[0]?.total || 0);

    if (!reference && evidenceCount < 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        code: 'AUTHORIZATION_EVIDENCE_REQUIRED',
        message:
          'Registra una referencia verificable o carga una evidencia antes de guardar la decisión',
      });
    }

    const result = await client.query(
      `
        UPDATE service_order_authorizations
        SET status = $1,
            client_name = $2,
            client_document = $3,
            decision_channel = $4,
            decision_reference = $5,
            decision_note = $6,
            decided_by = $7,
            decided_at = NOW(),
            updated_at = NOW()
        WHERE id = $8
          AND service_order_id = $9
        RETURNING *
      `,
      [
        decision,
        clientName,
        clientDocument,
        channel,
        reference,
        note,
        req.user.id,
        authorizationId,
        id,
      ]
    );

    await addEvent(client, {
      authorizationId,
      eventType:
        decision === 'approved'
          ? 'approved'
          : 'rejected',
      actorUserId: req.user.id,
      previousStatus: authorization.status,
      newStatus: decision,
      metadata: {
        client_name: clientName,
        client_document: clientDocument,
        channel,
        decision_reference: reference,
        evidence_count: evidenceCount,
      },
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        decision === 'approved'
          ? 'Autorización aprobada. El técnico ya puede reanudar el servicio y gestionar los materiales asociados.'
          : 'Autorización rechazada. El trabajo adicional permanece bloqueado.',
      data: result.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error deciding client authorization:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al registrar la decisión del cliente',
    });
  } finally {
    client.release();
  }
};

exports.cancel = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, authorizationId } = req.params;

    const access = await getOrderAccess(client, req, id);

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    await client.query('BEGIN');

    const authorization = await loadAuthorization(
      client,
      id,
      authorizationId,
      true
    );

    if (!authorization) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada',
      });
    }

    if (authorization.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Solo una autorización pendiente puede cancelarse',
      });
    }

    if (
      !isAdmin(req) &&
      authorization.requested_by !== req.user?.id
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Solo quien creó la solicitud o administración puede cancelarla',
      });
    }

    const result = await client.query(
      `
        UPDATE service_order_authorizations
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = $1,
            updated_at = NOW()
        WHERE id = $2
          AND service_order_id = $3
        RETURNING *
      `,
      [req.user.id, authorizationId, id]
    );

    await addEvent(client, {
      authorizationId,
      eventType: 'cancelled',
      actorUserId: req.user.id,
      previousStatus: 'pending',
      newStatus: 'cancelled',
      metadata: {
        reason: cleanText(req.body?.reason, 1500),
      },
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Solicitud de autorización cancelada',
      data: result.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}

    console.error('Error cancelling client authorization:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cancelar autorización',
    });
  } finally {
    client.release();
  }
};
