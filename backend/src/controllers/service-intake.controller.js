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
        verifier.apellidos AS payment_verified_by_lastname,
        (
          SELECT itm.technician_id
          FROM service_order_intake_team_members itm
          WHERE itm.intake_id = i.id
            AND itm.member_role = 'primary'
          LIMIT 1
        ) AS primary_technician_id,
        (
          SELECT COUNT(*)::int
          FROM service_order_intake_team_members itm
          WHERE itm.intake_id = i.id
        ) AS team_size
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


async function resolveClientForIntake(
  client,
  body
) {
  const requestedId =
    cleanText(body?.client_id, 120);

  const origin =
    cleanText(
      body?.client_origin ||
      body?.client_snapshot?.origen,
      30
    ) || 'local';

  if (requestedId && isUuid(requestedId)) {
    const local = await client.query(
      `
        SELECT id
        FROM clients
        WHERE id = $1
          AND activo = TRUE
        LIMIT 1
      `,
      [requestedId]
    );

    if (local.rows[0]) {
      return {
        client_id: local.rows[0].id,
        origin: 'local',
        source_reference:
          cleanText(body?.source_reference, 180),
      };
    }
  }

  const externalCandidate =
    body?.client_external_id ??
    body?.client_snapshot?.id_externo ??
    (
      origin === 'melissa' &&
        requestedId &&
        /^\d+$/.test(requestedId)
        ? requestedId
        : null
    );

  const externalId =
    externalCandidate !== null &&
      externalCandidate !== undefined &&
      /^\d+$/.test(String(externalCandidate))
      ? String(externalCandidate)
      : null;

  if (!externalId) {
    const error = new Error(
      'Cliente inválido: selecciona nuevamente el cliente desde el buscador'
    );
    error.code = 'CLIENT_REFERENCE_INVALID';
    throw error;
  }

  const syncResult = await client.query(
    `
      SELECT
        id_externo,
        documento,
        razon_social,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        activo,
        datos_completos
      FROM sync_clientes
      WHERE id_externo = $1::bigint
        AND activo = TRUE
      LIMIT 1
    `,
    [externalId]
  );

  const syncClient = syncResult.rows[0];

  if (!syncClient) {
    const error = new Error(
      'El cliente de WorldOffice ya no está disponible o está inactivo'
    );
    error.code = 'SYNC_CLIENT_NOT_FOUND';
    throw error;
  }

  const localResult = await client.query(
    `
      SELECT id
      FROM clients
      WHERE activo = TRUE
        AND (
          codigo_worldoffice = $1
          OR (
            NULLIF($2, '') IS NOT NULL
            AND documento = $2
          )
        )
      ORDER BY
        CASE
          WHEN codigo_worldoffice = $1 THEN 0
          ELSE 1
        END
      LIMIT 1
    `,
    [
      externalId,
      String(syncClient.documento || ''),
    ]
  );

  if (localResult.rows[0]) {
    await client.query(
      `
        UPDATE clients
        SET codigo_worldoffice =
              COALESCE(
                NULLIF(codigo_worldoffice, ''),
                $1
              ),
            "updatedAt" = NOW()
        WHERE id = $2
      `,
      [
        externalId,
        localResult.rows[0].id,
      ]
    );

    return {
      client_id: localResult.rows[0].id,
      origin: 'melissa',
      source_reference: `melissa:${externalId}`,
    };
  }

  const snapshot =
    body?.client_snapshot &&
      typeof body.client_snapshot === 'object'
      ? body.client_snapshot
      : {};

  const inferredType =
    snapshot.tipo_persona === 'natural' ||
      snapshot.tipo_persona === 'juridica'
      ? snapshot.tipo_persona
      : (
        syncClient.razon_social &&
          !syncClient.primer_apellido
          ? 'juridica'
          : 'natural'
      );

  const localId = randomUUID();

  await client.query(
    `
      INSERT INTO clients (
        id,
        tipo_persona,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        razon_social,
        documento,
        telefono,
        email,
        direccion,
        ciudad,
        codigo_worldoffice,
        observacion,
        activo,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,TRUE,NOW(),NOW()
      )
    `,
    [
      localId,
      inferredType,
      syncClient.primer_nombre ||
      snapshot.primer_nombre ||
      null,
      syncClient.segundo_nombre ||
      snapshot.segundo_nombre ||
      null,
      syncClient.primer_apellido ||
      snapshot.primer_apellido ||
      null,
      syncClient.segundo_apellido ||
      snapshot.segundo_apellido ||
      null,
      inferredType === 'juridica'
        ? (
          syncClient.razon_social ||
          snapshot.razon_social ||
          syncClient.primer_nombre ||
          `Cliente WO ${externalId}`
        )
        : null,
      syncClient.documento ||
      snapshot.documento ||
      `WO-${externalId}`,
      snapshot.telefono || null,
      snapshot.email || null,
      snapshot.direccion || null,
      snapshot.ciudad || null,
      externalId,
      'Creado automáticamente como vínculo local de cliente WorldOffice para Servicio Técnico.',
    ]
  );

  return {
    client_id: localId,
    origin: 'melissa',
    source_reference: `melissa:${externalId}`,
  };
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
    if (!clientId) errors.push('Cliente no válido');
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

  if (!intake.primary_technician_id) {
    missing.push('tecnico_principal');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}


async function validateIntakeTeam(
  client,
  req,
  rawMembers
) {
  if (isTechnician(req)) {
    return [
      {
        technician_id: req.user.id,
        member_role: 'primary',
      },
    ];
  }

  const members = [];
  const seen = new Set();
  let primaryCount = 0;

  for (const raw of Array.isArray(rawMembers) ? rawMembers : []) {
    const technicianId =
      raw?.technician_id || raw?.id || null;

    if (!isUuid(technicianId) || seen.has(technicianId)) {
      continue;
    }

    seen.add(technicianId);

    const memberRole =
      raw?.member_role === 'primary'
        ? 'primary'
        : 'support';

    if (memberRole === 'primary') primaryCount += 1;

    members.push({
      technician_id: technicianId,
      member_role: memberRole,
    });
  }

  if (members.length > 10) {
    const error = new Error(
      'Máximo 10 técnicos por servicio'
    );
    error.code = 'TEAM_TOO_LARGE';
    throw error;
  }

  if (primaryCount !== 1) {
    const error = new Error(
      'Selecciona exactamente un técnico responsable principal'
    );
    error.code = 'PRIMARY_REQUIRED';
    throw error;
  }

  const ids = members.map((item) => item.technician_id);

  const result = await client.query(
    `
      SELECT
        u.id,
        u.activo,
        u.rol,
        r.name AS role_name
      FROM usuarios u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ANY($1::uuid[])
    `,
    [ids]
  );

  const validIds = new Set(
    result.rows
      .filter((row) => {
        const role = row.role_name || row.rol;
        return row.activo === true && role === 'tecnico';
      })
      .map((row) => row.id)
  );

  if (ids.some((id) => !validIds.has(id))) {
    const error = new Error(
      'Uno o más técnicos no están activos o no tienen rol técnico'
    );
    error.code = 'INVALID_TECHNICIAN';
    throw error;
  }

  return members;
}

async function saveIntakeTeam(
  client,
  intakeId,
  members,
  actorUserId
) {
  await client.query(
    `
      DELETE FROM service_order_intake_team_members
      WHERE intake_id = $1
    `,
    [intakeId]
  );

  for (const member of members) {
    await client.query(
      `
        INSERT INTO service_order_intake_team_members (
          id,
          intake_id,
          technician_id,
          member_role,
          added_by,
          added_at
        )
        VALUES ($1,$2,$3,$4,$5,NOW())
      `,
      [
        randomUUID(),
        intakeId,
        member.technician_id,
        member.member_role,
        actorUserId || null,
      ]
    );
  }
}

async function getIntakeTeam(
  client,
  intakeId
) {
  try {
    const result = await client.query(
      `
        SELECT
          itm.id,
          itm.technician_id,
          itm.member_role,
          u.nombre1,
          u.nombre2,
          u.apellidos,
          u.usuario,
          u.cedula,
          u.celular,
          u.email,
          u.activo
        FROM service_order_intake_team_members itm
        JOIN usuarios u ON u.id = itm.technician_id
        WHERE itm.intake_id = $1
        ORDER BY
          CASE itm.member_role
            WHEN 'primary' THEN 0
            ELSE 1
          END,
          u.nombre1 ASC NULLS LAST
      `,
      [intakeId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getIntakeTeam:', error);
    throw error;
  }
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
          so.codigo_os,
          (
            SELECT itm.technician_id
            FROM service_order_intake_team_members itm
            WHERE itm.intake_id = i.id
              AND itm.member_role = 'primary'
            LIMIT 1
          ) AS primary_technician_id,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'technician_id', itm.technician_id,
                  'member_role', itm.member_role,
                  'nombre1', tu.nombre1,
                  'nombre2', tu.nombre2,
                  'apellidos', tu.apellidos,
                  'usuario', tu.usuario
                )
                ORDER BY
                  CASE itm.member_role
                    WHEN 'primary' THEN 0
                    ELSE 1
                  END,
                  tu.nombre1
              )
              FROM service_order_intake_team_members itm
              JOIN usuarios tu ON tu.id = itm.technician_id
              WHERE itm.intake_id = i.id
            ),
            '[]'::jsonb
          ) AS team
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

    const team = await getIntakeTeam(
      client,
      intake.id
    );

    return res.json({
      success: true,
      data: {
        ...intake,
        team,
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

    await client.query('BEGIN');

    const resolvedClient =
      await resolveClientForIntake(
        client,
        req.body || {}
      );

    const team = await validateIntakeTeam(
      client,
      req,
      req.body?.team || []
    );

    if (
      v.clientAcceptanceChannel &&
      !VALID_CHANNELS.has(v.clientAcceptanceChannel)
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Canal de aceptación no válido',
      });
    }

    if (v.billingMode === 'postpaid' && !isAdmin(req)) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        success: false,
        message:
          'La modalidad pospago solo puede ser autorizada por administración',
      });
    }

    const id = randomUUID();

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
          $21::varchar(20),$22,
          CASE
            WHEN $21::varchar(20) = 'postpaid'::varchar(20)
            THEN 'not_required'::varchar(20)
            ELSE 'pending'::varchar(20)
          END,
          $23,$24,$25,$26,$27,
          'draft',NOW(),NOW()
        )
        RETURNING *
      `,
      [
        id,
        resolvedClient.client_id,
        req.user.id,
        isTechnician(req) ? 'technician' : v.sourceType,
        resolvedClient.source_reference || v.sourceReference,
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
        null,
        null,
        v.estimatedDuration || v.estimatedMinutes || 60,
      ]
    );

    await saveIntakeTeam(
      client,
      id,
      team,
      req.user.id
    );

    await addEvent(client, {
      intakeId: id,
      eventType: 'intake_created',
      actorUserId: req.user.id,
      metadata: {
        source_type: isTechnician(req) ? 'technician' : v.sourceType,
        client_origin: resolvedClient.origin,
        classification: v.classification,
        billing_mode: v.billingMode,
      },
    });

    await client.query('COMMIT');

    const intake = result.rows[0];
    const primary = team.find(
      (item) => item.member_role === 'primary'
    );

    const enriched = {
      ...intake,
      primary_technician_id:
        primary?.technician_id || null,
      team_size: team.length,
      team,
    };

    return res.status(201).json({
      success: true,
      message: isTechnician(req)
        ? 'Solicitud registrada contigo como técnico responsable. Administración debe validarla y activarla.'
        : 'Solicitud previa registrada con equipo técnico.',
      data: {
        ...enriched,
        readiness: evaluateReadiness(enriched),
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { }

    console.error('Error creating service intake:', error);

    if (
      [
        'CLIENT_REFERENCE_INVALID',
        'SYNC_CLIENT_NOT_FOUND',
      ].includes(error?.code)
    ) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

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
    try { await client.query('ROLLBACK'); } catch (_) { }

    console.error('Error updating service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar solicitud',
    });
  } finally {
    client.release();
  }
};


exports.updateTeam = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede cambiar el equipo de una solicitud',
      });
    }

    await client.query('BEGIN');

    const intake = await getIntake(
      client,
      req.params.intakeId,
      true
    );

    if (!intake) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada',
      });
    }

    if (intake.status !== 'draft' && intake.status !== 'ready') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'El equipo ya no puede modificarse en esta solicitud',
      });
    }

    const team = await validateIntakeTeam(
      client,
      req,
      req.body?.members || []
    );

    await saveIntakeTeam(
      client,
      intake.id,
      team,
      req.user.id
    );

    await addEvent(client, {
      intakeId: intake.id,
      eventType: 'intake_team_updated',
      actorUserId: req.user.id,
      metadata: {
        team: team.map((item) => ({
          technician_id: item.technician_id,
          role: item.member_role,
        })),
      },
    });

    await client.query('COMMIT');

    const refreshed = await getIntake(
      client,
      intake.id
    );

    return res.json({
      success: true,
      message: 'Equipo técnico de la solicitud actualizado',
      data: {
        ...refreshed,
        team: await getIntakeTeam(client, intake.id),
        readiness: evaluateReadiness(refreshed),
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { }

    console.error('Error updating intake team:', error);

    if (
      ['TEAM_TOO_LARGE', 'PRIMARY_REQUIRED', 'INVALID_TECHNICIAN']
        .includes(error?.code)
    ) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar equipo técnico',
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
    try { await client.query('ROLLBACK'); } catch (_) { }

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

    // START TRANSACTION
    await client.query('BEGIN');
    console.log('🔄 Transaction started for intake:', req.params.intakeId);

    // 1. Get intake with lock
    console.log('📥 Getting intake with lock...');
    const intake = await getIntake(client, req.params.intakeId, true);

    if (!intake) {
      await client.query('ROLLBACK');
      console.log('❌ Intake not found, rolled back');
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada',
      });
    }
    console.log('✅ Intake found:', intake.id);

    if (intake.status === 'activated') {
      await client.query('ROLLBACK');
      console.log('❌ Intake already activated, rolled back');
      return res.status(409).json({
        success: false,
        code: 'INTAKE_ALREADY_ACTIVATED',
        message: 'Esta solicitud ya generó una orden de servicio',
        service_order_id: intake.service_order_id,
      });
    }

    if (intake.status === 'cancelled') {
      await client.query('ROLLBACK');
      console.log('❌ Intake cancelled, rolled back');
      return res.status(409).json({
        success: false,
        message: 'Una solicitud cancelada no puede activarse',
      });
    }

    // 2. Evaluate readiness
    console.log('📊 Evaluating readiness...');
    const readiness = evaluateReadiness(intake);

    if (!readiness.ready) {
      await client.query('ROLLBACK');
      console.log('❌ Intake not ready, rolled back. Missing:', readiness.missing);
      return res.status(409).json({
        success: false,
        code: 'INTAKE_NOT_READY',
        message: 'Faltan requisitos antes de crear la OS',
        missing: readiness.missing,
      });
    }
    console.log('✅ Intake is ready');

    // 3. Get next OS number
    console.log('🔢 Getting next OS number...');
    const year = new Date().getFullYear();
    let counterResult;
    
    try {
      counterResult = await client.query(
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
      console.log('✅ Counter query executed successfully');
    } catch (counterError) {
      console.error('❌ Error in counter query:', counterError);
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back due to counter error');
      throw counterError;
    }

    const nextNumber = Number(counterResult.rows[0].last_number);
    const codigoOs = `OS-${year}-${String(nextNumber).padStart(4, '0')}`;
    console.log('✅ OS Code generated:', codigoOs);

    // 4. Create service order
    console.log('📝 Creating service order...');
    const serviceOrderId = randomUUID();

    const activationObservations = [
      `Solicitud origen (intake): ${intake.id}`,
      intake.scope_text ? `Alcance: ${intake.scope_text}` : null,
      `Prioridad: ${intake.priority || 'normal'}`,
      `Clasificación: ${intake.classification || ''}`,
      `Tipo: ${intake.service_type_name || ''}`,
      `Condiciones informadas: ${intake.conditions_text || ''}`,
      `Costos adicionales informados: ${intake.additional_costs_notice || ''}`,
      `Modalidad: ${intake.billing_mode}`,
      `Factura: ${intake.invoice_reference || 'N/A'}`,
    ]
      .filter(Boolean)
      .join('\n');

    let orderResult;
    try {
      orderResult = await client.query(
        `
          INSERT INTO service_orders (
            id,
            codigo_os,
            client_id,
            origen_tipo,
            origen_id,
            descripcion_inicial,
            tecnico_id,
            fecha_agendada,
            hora_inicio_agendada,
            duracion_estimada,
            observaciones,
            estado,
            creado_por,
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1,$2,$3,'otro',NULL,$4,NULL,$5,$6,$7,$8,
            'pendiente',$9,NOW(),NOW()
          )
          RETURNING *
        `,
        [
          serviceOrderId,
          codigoOs,
          intake.client_id,
          intake.request_description,
          intake.scheduled_date,
          intake.scheduled_time,
          intake.estimated_duration || intake.estimated_minutes || 60,
          activationObservations,
          req.user.id,
        ]
      );
      console.log('✅ Service order created:', serviceOrderId);
    } catch (orderError) {
      console.error('❌ Error creating service order:', {
        message: orderError.message,
        code: orderError.code,
        detail: orderError.detail
      });
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back due to order creation error');
      throw orderError;
    }

    // 5. Insert service details - TEMPORALMENTE DESHABILITADO
    console.log('⏭️ Service details insert skipped (will be enabled later)');

    // 6. Get planned team
    console.log('👥 Getting planned team...');
    let plannedTeam = [];
    try {
      plannedTeam = await getIntakeTeam(client, intake.id);
      console.log(`✅ Planned team retrieved: ${plannedTeam.length} members`);
    } catch (teamError) {
      console.error('❌ Error getting intake team:', teamError);
      console.log('🔄 Rolling back due to team error...');
      await client.query('ROLLBACK');
      console.log('✅ Rollback completed');
      throw teamError;
    }

    // 7. Insert team members
    console.log('👥 Inserting team members...');
    for (const member of plannedTeam) {
      await client.query(
        `
          INSERT INTO service_order_team_members (
            id,
            service_order_id,
            technician_id,
            member_role,
            member_status,
            added_by,
            added_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,'planned',$5,NOW(),NOW()
          )
          ON CONFLICT DO NOTHING
        `,
        [
          randomUUID(),
          serviceOrderId,
          member.technician_id,
          member.member_role,
          req.user.id,
        ]
      );
    }
    console.log(`✅ ${plannedTeam.length} team members inserted`);

    // 8. Update intake status
    console.log('📝 Updating intake status...');
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
    console.log('✅ Intake updated to activated');

    // 9. Financial controls
    console.log('💰 Setting up financial controls...');
    const initialFinancialStatus =
      intake.billing_mode === 'prepaid' && intake.payment_status === 'verified'
        ? 'cleared'
        : intake.payment_status === 'not_required'
          ? 'not_required'
          : 'pending';

    try {
      await client.query(
        `
          INSERT INTO service_order_financial_controls (
            service_order_id,
            intake_id,
            billing_mode,
            verification_required,
            clearance_status,
            invoice_reference,
            payment_reference,
            expected_amount,
            last_verified_at,
            last_verified_by,
            note,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()
          )
          ON CONFLICT (service_order_id)
          DO NOTHING
        `,
        [
          serviceOrderId,
          intake.id,
          intake.billing_mode,
          initialFinancialStatus,
          intake.invoice_reference,
          intake.payment_reference,
          intake.base_value,
          intake.payment_verified_at,
          intake.payment_verified_by,
          intake.billing_mode === 'postpaid'
            ? 'Postpago: requiere control financiero antes de entrega.'
            : 'Control inicializado desde solicitud de servicio.',
        ]
      );
      console.log('✅ Financial controls set up');
    } catch (financialError) {
      console.error('❌ Error setting up financial controls:', financialError);
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back due to financial controls error');
      throw financialError;
    }

    if (
      intake.billing_mode === 'prepaid' &&
      intake.payment_status === 'verified' &&
      intake.payment_verified_by
    ) {
      console.log('💰 Creating financial verification record...');
      try {
        const verificationId = randomUUID();
        await client.query(
          `
            INSERT INTO service_order_financial_verifications (
              id,
              service_order_id,
              verification_source,
              verification_kind,
              result_status,
              invoice_reference,
              payment_reference,
              balance_amount,
              paid_amount,
              evidence_note,
              source_snapshot,
              verified_by,
              verified_at,
              created_at
            )
            VALUES (
              $1,$2,'intake','payment_confirmed','cleared',
              $3,$4,0,$5,$6,$7::jsonb,$8,
              COALESCE($9,NOW()),NOW()
            )
          `,
          [
            verificationId,
            serviceOrderId,
            intake.invoice_reference,
            intake.payment_reference,
            intake.base_value,
            'Verificación heredada de la solicitud de servicio.',
            JSON.stringify({
              intake_id: intake.id,
              billing_mode: intake.billing_mode,
              payment_status: intake.payment_status,
              payment_method: intake.payment_method,
              payment_reference: intake.payment_reference,
              invoice_reference: intake.invoice_reference,
            }),
            intake.payment_verified_by,
            intake.payment_verified_at,
          ]
        );

        await client.query(
          `
            INSERT INTO service_order_financial_events (
              id,
              service_order_id,
              event_type,
              actor_user_id,
              metadata,
              created_at
            )
            VALUES (
              $1,$2,'financial_verification_inherited',$3,$4::jsonb,NOW()
            )
          `,
          [
            randomUUID(),
            serviceOrderId,
            intake.payment_verified_by,
            JSON.stringify({
              verification_id: verificationId,
              intake_id: intake.id,
              billing_mode: intake.billing_mode,
              invoice_reference: intake.invoice_reference,
            }),
          ]
        );
        console.log('✅ Financial verification created');
      } catch (verificationError) {
        console.error('❌ Error creating financial verification:', verificationError);
        await client.query('ROLLBACK');
        console.log('🔄 Rolled back due to verification error');
        throw verificationError;
      }
    }

    // 10. Add event
    console.log('📝 Adding event...');
    try {
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
      console.log('✅ Event added');
    } catch (eventError) {
      console.error('❌ Error adding event:', eventError);
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back due to event error');
      throw eventError;
    }

    // 11. Commit transaction
    console.log('✅ Committing transaction...');
    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully!');

    return res.status(201).json({
      success: true,
      message:
        plannedTeam.length > 0
          ? `Orden ${codigoOs} creada con equipo técnico planificado. Al aprobarla se enviará al técnico responsable.`
          : `Orden ${codigoOs} creada. Falta definir el equipo técnico.`,
      data: {
        ...orderResult.rows[0],
        planned_team: plannedTeam,
      },
    });
  } catch (error) {
    try {
      console.log('🔄 Rolling back transaction...');
      await client.query('ROLLBACK');
      console.log('✅ Rollback completed');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError);
    }

    console.error('❌ Error activating intake as service order:', error);

    if (error.code === '25P02') {
      console.error('❌ Transaction aborted. This usually means a previous query failed.');
      console.error('❌ Check the database logs for the root cause.');
    }

    const errorResponse = {
      success: false,
      message: 'Error al crear la orden de servicio desde la solicitud',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = error.message;
      errorResponse.code = error.code;
      if (error.detail) errorResponse.detail = error.detail;
    }

    return res.status(500).json(errorResponse);
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
    try { await client.query('ROLLBACK'); } catch (_) { }

    console.error('Error cancelling service intake:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cancelar solicitud',
    });
  } finally {
    client.release();
  }
};