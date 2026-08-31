'use strict';

// backend/src/controllers/service-order.controller.js
const pool = require('../db/pool');
const { randomUUID } = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const {
  SERVICE_ORDER_STATES,
  canTransition,
  isValidState,
  isTerminalState,
} = require('../domain/service-order-lifecycle');

const MAX_PAGE_SIZE = 100;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function getUserRole(req) {
  return req.user?.role?.name || req.user?.rol || null;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {
    // Evitar ocultar el error original si el rollback también falla.
  }
}

const ASSIGNMENT_STATUS = Object.freeze({
  PENDIENTE: 'pendiente',
  ACEPTADA: 'aceptada',
  IMPEDIMENTO: 'impedimento',
  REVOCADA: 'revocada',
});

const CUSTODY_MAX_ACCURACY_M = Math.max(
  1,
  Number(process.env.CUSTODY_MAX_ACCURACY_M || 25)
);

const CUSTODY_LOCATION_MAX_AGE_MINUTES = Math.max(
  1,
  Number(process.env.CUSTODY_LOCATION_MAX_AGE_MINUTES || 5)
);

const CUSTODY_MAX_LOCATION_RISK_SCORE = Math.max(
  0,
  Math.min(100, Number(process.env.CUSTODY_MAX_LOCATION_RISK_SCORE || 34))
);

const CUSTODY_REQUIRE_PRECISE_LOCATION =
  String(
    process.env.CUSTODY_REQUIRE_PRECISE_LOCATION ?? 'true'
  ).toLowerCase() !== 'false';


const SERVICE_EVIDENCE_DIR = path.resolve(
  process.env.SERVICE_EVIDENCE_DIR ||
    path.resolve(__dirname, '../../uploads/service-orders')
);

const SERVICE_EVIDENCE_MAX_BYTES = Math.max(
  256 * 1024,
  Number(process.env.SERVICE_EVIDENCE_MAX_BYTES || 8 * 1024 * 1024)
);

const ALLOWED_EVIDENCE_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

const EVIDENCE_STAGES = new Set([
  'reception',
  'diagnosis',
  'execution',
  'closure',
  'delivery',
]);

const DIAGNOSIS_WORK_TYPES = new Set([
  'diagnostico',
  'servicio_especifico',
]);

function isTechnicianRole(req) {
  return getUserRole(req) === 'tecnico';
}

function isAdminRole(req) {
  return getUserRole(req) === 'admin';
}

async function getRecentPreciseLocation(
  client,
  userId,
  {
    maxAccuracyM = CUSTODY_MAX_ACCURACY_M,
    maxAgeMinutes = CUSTODY_LOCATION_MAX_AGE_MINUTES,
  } = {}
) {
  if (!userId) return null;

  try {
    const result = await client.query(
      `
        SELECT
          latitude,
          longitude,
          accuracy_m,
          altitude_m,
          heading_deg,
          speed_mps,
          integrity_status,
          integrity_score,
          integrity_flags,
          movement_speed_kmh,
          network_changed,
          network_trust_status,
          network_proxy,
          network_vpn,
          network_tor,
          network_hosting,
          network_fraud_score,
          device_id,
          device_trust_status,
          precision_tier,
          captured_at,
          received_at
        FROM user_current_locations
        WHERE user_id = $1
          AND accuracy_m <= $2
          AND captured_at >= NOW() - ($3::text || ' minutes')::interval
          AND COALESCE(integrity_status, 'unverified') = 'trusted'
          AND COALESCE(integrity_score, 0) <= $4
          AND COALESCE(network_trust_status, 'unknown') <> 'blocked'
          AND COALESCE(device_trust_status, 'unknown') = 'trusted'
        LIMIT 1
      `,
      [userId, maxAccuracyM, maxAgeMinutes, CUSTODY_MAX_LOCATION_RISK_SCORE]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy_m: Number(row.accuracy_m),
      altitude_m:
        row.altitude_m === null ? null : Number(row.altitude_m),
      heading_deg:
        row.heading_deg === null ? null : Number(row.heading_deg),
      speed_mps:
        row.speed_mps === null ? null : Number(row.speed_mps),
      integrity_status: row.integrity_status || 'unverified',
      integrity_score: Number(row.integrity_score || 0),
      integrity_flags: row.integrity_flags || [],
      movement_speed_kmh:
        row.movement_speed_kmh === null ? null : Number(row.movement_speed_kmh),
      network_changed: Boolean(row.network_changed),
      network_trust_status: row.network_trust_status || 'unknown',
      network_proxy: Boolean(row.network_proxy),
      network_vpn: Boolean(row.network_vpn),
      network_tor: Boolean(row.network_tor),
      network_hosting: Boolean(row.network_hosting),
      network_fraud_score: row.network_fraud_score === null ? null : Number(row.network_fraud_score),
      device_id: row.device_id || null,
      device_trust_status: row.device_trust_status || 'unknown',
      precision_tier: row.precision_tier || 'precise',
      captured_at: row.captured_at,
      received_at: row.received_at,
    };
  } catch (error) {
    // El módulo de ubicación es complementario. Si aún no se ha instalado
    // su tabla, no debemos tumbar el flujo completo salvo que la custodia
    // exija ubicación precisa.
    if (error?.code === '42P01') {
      return null;
    }

    throw error;
  }
}

async function getLatestAssignment(
  client,
  serviceOrderId,
  { forUpdate = false } = {}
) {
  const result = await client.query(
    `
      SELECT *
      FROM service_order_assignments
      WHERE service_order_id = $1
      ORDER BY assigned_at DESC, created_at DESC
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [serviceOrderId]
  );

  return result.rows[0] || null;
}

async function ensurePendingAssignmentForLegacyOrder(
  client,
  order,
  technicianId
) {
  let assignment = await getLatestAssignment(
    client,
    order.id,
    { forUpdate: true }
  );

  if (assignment) {
    return assignment;
  }

  if (
    order.estado !== SERVICE_ORDER_STATES.ASIGNADA ||
    order.tecnico_id !== technicianId
  ) {
    return null;
  }

  const id = randomUUID();

  const insertResult = await client.query(
    `
      INSERT INTO service_order_assignments (
        id,
        service_order_id,
        tecnico_id,
        assigned_by,
        status,
        assigned_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, NULL, $4,
        COALESCE($5, NOW()),
        NOW(), NOW()
      )
      RETURNING *
    `,
    [
      id,
      order.id,
      technicianId,
      ASSIGNMENT_STATUS.PENDIENTE,
      order.fecha_asignacion || null,
    ]
  );

  return insertResult.rows[0];
}

// ============================================================
// LISTAR ÓRDENES
// ============================================================

exports.list = async (req, res) => {
  try {
    const {
      estado,
      tecnico_id,
      fecha_inicio,
      fecha_fin,
      search,
    } = req.query;

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const userId = req.user?.id;
    const userRole = getUserRole(req);

    if (estado && !isValidState(estado)) {
      return res.status(400).json({
        message: 'Estado de orden no válido',
      });
    }

    if (tecnico_id && !isUuid(tecnico_id)) {
      return res.status(400).json({
        message: 'tecnico_id no es válido',
      });
    }

    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (estado) {
      whereClauses.push(`so.estado = $${paramIndex++}`);
      params.push(estado);
    }

    if (tecnico_id) {
      whereClauses.push(`so.tecnico_id = $${paramIndex++}`);
      params.push(tecnico_id);
    }

    if (fecha_inicio) {
      whereClauses.push(`so.fecha_agendada >= $${paramIndex++}::date`);
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClauses.push(
        `so.fecha_agendada < ($${paramIndex++}::date + INTERVAL '1 day')`
      );
      params.push(fecha_fin);
    }

    const cleanSearch =
      typeof search === 'string' ? search.trim().slice(0, 120) : '';

    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`;
      whereClauses.push(`
        (
          so.codigo_os ILIKE $${paramIndex}
          OR COALESCE(c.razon_social, '') ILIKE $${paramIndex}
          OR CONCAT_WS(
            ' ',
            NULLIF(c.primer_nombre, ''),
            NULLIF(c.primer_apellido, '')
          ) ILIKE $${paramIndex}
        )
      `);
      params.push(pattern);
      paramIndex += 1;
    }

    // Un técnico solo puede consultar sus propias órdenes.
    if (userRole === 'tecnico') {
      whereClauses.push(`so.tecnico_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereSql =
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';

    const dataParams = [...params, limit, offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const query = `
      SELECT
        so.*,
        CASE
          WHEN c.tipo_persona = 'juridica'
            THEN c.razon_social
          ELSE NULLIF(
            TRIM(
              CONCAT_WS(
                ' ',
                NULLIF(c.primer_nombre, ''),
                NULLIF(c.primer_apellido, '')
              )
            ),
            ''
          )
        END AS cliente_nombre,
        u.usuario AS tecnico_nombre
      FROM service_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      ${whereSql}
      ORDER BY so."createdAt" DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM service_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      ${whereSql}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, dataParams),
      pool.query(countQuery, params),
    ]);

    const total = countResult.rows[0]?.total || 0;

    return res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error listing service orders:', error);

    return res.status(500).json({
      message: 'Error al listar órdenes de servicio',
    });
  }
};

// ============================================================
// OBTENER ORDEN POR ID
// ============================================================

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = getUserRole(req);

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    const params = [id];

    let ownershipSql = '';

    if (userRole === 'tecnico') {
      params.push(userId);
      ownershipSql = `AND so.tecnico_id = $2`;
    }

    const osQuery = `
      SELECT
        so.*,
        CASE
          WHEN c.tipo_persona = 'juridica'
            THEN c.razon_social
          ELSE NULLIF(
            TRIM(
              CONCAT_WS(
                ' ',
                NULLIF(c.primer_nombre, ''),
                NULLIF(c.primer_apellido, '')
              )
            ),
            ''
          )
        END AS cliente_nombre,
        c.documento AS cliente_documento,
        c.telefono AS cliente_telefono,
        c.email AS cliente_email,
        c.direccion AS cliente_direccion,
        c.ciudad AS cliente_ciudad,
        u.usuario AS tecnico_nombre
      FROM service_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      WHERE so.id = $1
      ${ownershipSql}
    `;

    const osResult = await pool.query(osQuery, params);

    if (osResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const serviciosResult = await pool.query(
      `
        SELECT *
        FROM service_order_services
        WHERE service_order_id = $1
        ORDER BY "createdAt" ASC
      `,
      [id]
    );

    return res.json({
      ...osResult.rows[0],
      servicios: serviciosResult.rows,
    });
  } catch (error) {
    console.error('Error getting service order:', error);

    return res.status(500).json({
      message: 'Error al obtener la orden de servicio',
    });
  }
};

// ============================================================
// APROBAR ORDEN
// ============================================================

exports.aprobar = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { observaciones } = req.body || {};
    const userId = req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: 'Usuario no autenticado',
      });
    }

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT id, codigo_os, estado
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden no encontrada',
      });
    }

    const order = currentResult.rows[0];

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.APROBADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede aprobar una orden que está en estado ` +
          `"${order.estado}"`,
        estado_actual: order.estado,
      });
    }

    const result = await client.query(
      `
        UPDATE service_orders
        SET
          estado = $1,
          aprobado_por = $2,
          fecha_aprobacion = NOW(),
          observaciones = COALESCE($3, observaciones),
          "updatedAt" = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [
        SERVICE_ORDER_STATES.APROBADO,
        userId,
        typeof observaciones === 'string' && observaciones.trim()
          ? observaciones.trim()
          : null,
        id,
      ]
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (error) {
    await safeRollback(client);

    console.error('Error aprobando servicio:', error);

    return res.status(500).json({
      message: 'Error al aprobar el servicio',
    });
  } finally {
    client.release();
  }
};

// Mantener compatibilidad con rutas antiguas.
exports.approve = exports.aprobar;

// ============================================================
// RECHAZAR ORDEN
// ============================================================

exports.rechazar = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { motivo } = req.body || {};
    const userId = req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: 'Usuario no autenticado',
      });
    }

    const cleanMotivo =
      typeof motivo === 'string' ? motivo.trim() : '';

    if (!cleanMotivo) {
      return res.status(400).json({
        message: 'Debe especificar el motivo del rechazo',
      });
    }

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT id, codigo_os, estado
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden no encontrada',
      });
    }

    const order = currentResult.rows[0];

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.RECHAZADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede rechazar una orden que está en estado ` +
          `"${order.estado}"`,
        estado_actual: order.estado,
      });
    }

    const result = await client.query(
      `
        UPDATE service_orders
        SET
          estado = $1,
          rechazado_por = $2,
          fecha_rechazo = NOW(),
          motivo_rechazo = $3,
          "updatedAt" = NOW()
        WHERE id = $4
        RETURNING *
      `,
      [
        SERVICE_ORDER_STATES.RECHAZADO,
        userId,
        cleanMotivo,
        id,
      ]
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (error) {
    await safeRollback(client);

    console.error('Error rechazando servicio:', error);

    return res.status(500).json({
      message: 'Error al rechazar el servicio',
    });
  } finally {
    client.release();
  }
};

// Mantener compatibilidad con rutas antiguas.
exports.reject = exports.rechazar;

// ============================================================
// CREAR ORDEN
// ============================================================

exports.create = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      client_id,
      descripcion_inicial,
      origen_tipo = 'tecnico',
      origen_id = null,
      programacion = {},
      servicios = [],
      notas = {},
    } = req.body || {};

    const userId = req.user?.id;

    if (!client_id || !isUuid(client_id)) {
      return res.status(400).json({
        message: 'El cliente es requerido y debe ser válido',
      });
    }

    const validOrigins = ['venta', 'tecnico', 'otro'];

    if (!validOrigins.includes(origen_tipo)) {
      return res.status(400).json({
        message: 'origen_tipo no válido',
      });
    }

    if (origen_id && !isUuid(origen_id)) {
      return res.status(400).json({
        message: 'origen_id no es válido',
      });
    }

    if (programacion?.tecnico_id) {
      return res.status(400).json({
        message:
          'La orden debe crearse pendiente. ' +
          'Primero apruébela y luego asigne el técnico.',
      });
    }

    if (!Array.isArray(servicios)) {
      return res.status(400).json({
        message: 'servicios debe ser un arreglo',
      });
    }

    await client.query('BEGIN');

    const clientCheck = await client.query(
      `
        SELECT id
        FROM clients
        WHERE id = $1
      `,
      [client_id]
    );

    if (clientCheck.rows.length === 0) {
      await safeRollback(client);

      return res.status(400).json({
        message: 'Cliente no encontrado',
      });
    }

    const year = new Date().getFullYear();

    // Evita que dos solicitudes concurrentes generen el mismo consecutivo.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`service_order_code_${year}`]
    );

    const countResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM service_orders
        WHERE EXTRACT(YEAR FROM "createdAt") = $1
      `,
      [year]
    );

    const nextNumber = (countResult.rows[0]?.count || 0) + 1;
    const codigo_os =
      `OS-${year}-${String(nextNumber).padStart(4, '0')}`;

    /*
     * IMPORTANTE:
     * La BD actual sí tiene:
     * - fecha_agendada
     * - hora_inicio_agendada
     * - duracion_estimada
     *
     * Pero todavía NO tiene:
     * - prioridad
     * - notas_internas
     *
     * Por eso no se insertan aquí hasta crear una migración específica.
     */
    const result = await client.query(
      `
        INSERT INTO service_orders (
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
          $1, $2, $3, $4, $5,
          NULL,
          $6, $7, $8, $9,
          $10, $11,
          NOW(), NOW()
        )
        RETURNING *
      `,
      [
        codigo_os,
        client_id,
        origen_tipo,
        origen_id,
        typeof descripcion_inicial === 'string'
          ? descripcion_inicial.trim() || null
          : null,
        programacion?.fecha_agendada || null,
        programacion?.hora_inicio || null,
        parsePositiveInt(programacion?.duracion_estimada, 60, 24 * 60),
        typeof notas?.observaciones_tecnico === 'string'
          ? notas.observaciones_tecnico.trim() || null
          : null,
        SERVICE_ORDER_STATES.PENDIENTE,
        userId || null,
      ]
    );

    const order = result.rows[0];

    for (const servicio of servicios) {
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
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            NOW(), NOW()
          )
        `,
        [
          order.id,
          servicio?.tipo_servicio_id || null,
          servicio?.tipo_servicio_nombre || null,
          servicio?.descripcion_problema || null,
          servicio?.observaciones || null,
          servicio?.precio_estimado ?? null,
          servicio?.equipo_relacionado || null,
          Boolean(servicio?.requiere_diagnostico),
          Boolean(servicio?.requiere_repuestos),
          servicio?.repuestos_necesarios || null,
        ]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json(order);
  } catch (error) {
    await safeRollback(client);

    console.error('Error creating service order:', error);

    return res.status(500).json({
      message: 'Error al crear la orden de servicio',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// CAMBIAR ESTADO
// ============================================================

exports.changeStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { estado } = req.body || {};
    const userId = req.user?.id;
    const userRole = getUserRole(req);

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (!isValidState(estado)) {
      return res.status(400).json({
        message: 'Estado de orden no válido',
      });
    }

    if (!['admin', 'tecnico'].includes(userRole)) {
      return res.status(403).json({
        message: 'No tienes permisos para cambiar el estado de la orden',
      });
    }

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT
          id,
          codigo_os,
          estado,
          tecnico_id,
          fecha_asignacion
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const currentOrder = currentResult.rows[0];

    if (
      userRole === 'tecnico' &&
      currentOrder.tecnico_id !== userId
    ) {
      await safeRollback(client);

      return res.status(403).json({
        message: 'Esta orden no está asignada a tu cuenta',
      });
    }

    if (currentOrder.estado === estado) {
      await safeRollback(client);

      return res.status(400).json({
        message: `La orden ya se encuentra en estado "${estado}"`,
      });
    }

    if (!canTransition(currentOrder.estado, estado)) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `Transición no permitida: ` +
          `${currentOrder.estado} → ${estado}`,
        estado_actual: currentOrder.estado,
        estado_solicitado: estado,
      });
    }

    if (
      estado === SERVICE_ORDER_STATES.APROBADO ||
      estado === SERVICE_ORDER_STATES.RECHAZADO
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'La aprobación o rechazo debe realizarse ' +
          'mediante su acción específica',
      });
    }

    if (estado === SERVICE_ORDER_STATES.ASIGNADA) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'Para asignar una orden debe utilizarse ' +
          'la función de asignación de técnico',
      });
    }

    /*
     * P2:
     * El técnico no puede iniciar/reanudar el trabajo sin:
     * 1) aceptar la asignación;
     * 2) tener la custodia vigente del equipo.
     */
    if (
      userRole === 'tecnico' &&
      estado === SERVICE_ORDER_STATES.EN_EJECUCION
    ) {
      const assignment = await getLatestAssignment(
        client,
        currentOrder.id,
        { forUpdate: true }
      );

      if (
        !assignment ||
        assignment.tecnico_id !== userId ||
        assignment.status !== ASSIGNMENT_STATUS.ACEPTADA
      ) {
        await safeRollback(client);

        return res.status(409).json({
          message:
            'Debes aceptar la asignación antes de iniciar el servicio',
          code: 'ASSIGNMENT_NOT_ACCEPTED',
        });
      }

      const custodyResult = await client.query(
        `
          SELECT holder_user_id
          FROM service_order_current_custody
          WHERE service_order_id = $1
          FOR UPDATE
        `,
        [currentOrder.id]
      );

      const custody = custodyResult.rows[0];

      if (!custody || custody.holder_user_id !== userId) {
        await safeRollback(client);

        return res.status(409).json({
          message:
            'Debes tomar la custodia del equipo antes de iniciar el servicio',
          code: 'CUSTODY_REQUIRED',
        });
      }

      const receptionChecklistResult = await client.query(
        `
          SELECT status
          FROM service_order_reception_checklists
          WHERE service_order_id = $1
          FOR UPDATE
        `,
        [currentOrder.id]
      );

      if (
        receptionChecklistResult.rows[0]?.status !== 'confirmed'
      ) {
        await safeRollback(client);

        return res.status(409).json({
          message:
            'Debes confirmar el checklist de recepción antes de iniciar el servicio',
          code: 'RECEPTION_CHECKLIST_REQUIRED',
        });
      }


      const receptionActResult = await client.query(
        `
          SELECT id, signed_at
          FROM service_order_reception_acts
          WHERE service_order_id = $1
          FOR UPDATE
        `,
        [currentOrder.id]
      );

      if (!receptionActResult.rows[0]?.signed_at) {
        await safeRollback(client);

        return res.status(409).json({
          message:
            'Debes registrar las evidencias iniciales y firmar el acta de recibo antes de iniciar el servicio',
          code: 'RECEPTION_ACT_REQUIRED',
        });
      }
    }

    const result = await client.query(
      `
        UPDATE service_orders
        SET
          estado = $1,
          fecha_inicio = CASE
            WHEN $1::text = 'en_ejecucion'
              THEN COALESCE(fecha_inicio, NOW())
            ELSE fecha_inicio
          END,
          fecha_fin = CASE
            WHEN $1::text = 'cerrada'
              THEN NOW()
            ELSE fecha_fin
          END,
          "updatedAt" = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [estado, id]
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (error) {
    await safeRollback(client);

    console.error('Error changing service order status:', error);

    return res.status(500).json({
      message: 'Error al cambiar el estado de la orden',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// ASIGNAR / REASIGNAR TÉCNICO
// ============================================================

exports.assignTech = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { tecnico_id } = req.body || {};
    const assignedBy = req.user?.id || null;

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (!tecnico_id || !isUuid(tecnico_id)) {
      return res.status(400).json({
        message: 'El técnico es requerido y debe ser válido',
      });
    }

    await client.query('BEGIN');

    const techResult = await client.query(
      `
        SELECT
          u.id,
          u.activo,
          u.rol,
          r.name AS role_name
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
        FOR SHARE OF u
      `,
      [tecnico_id]
    );

    if (techResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Técnico no encontrado',
      });
    }

    const tech = techResult.rows[0];

    if (!tech.activo) {
      await safeRollback(client);

      return res.status(400).json({
        message: 'El técnico seleccionado está inactivo',
      });
    }

    const effectiveRole = tech.role_name || tech.rol;

    if (effectiveRole !== 'tecnico') {
      await safeRollback(client);

      return res.status(400).json({
        message: 'El usuario seleccionado no tiene rol de técnico',
      });
    }

    const currentResult = await client.query(
      `
        SELECT
          id,
          codigo_os,
          estado,
          tecnico_id,
          fecha_asignacion
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const order = currentResult.rows[0];
    const latestAssignment = await getLatestAssignment(
      client,
      order.id,
      { forUpdate: true }
    );

    const normalAssignmentAllowed = canTransition(
      order.estado,
      SERVICE_ORDER_STATES.ASIGNADA
    );

    /*
     * La reasignación no modifica el lifecycle principal.
     * Se permite si la orden continúa "asignada" pero el técnico
     * anterior reportó un impedimento.
     */
    const reassignmentAllowed =
      order.estado === SERVICE_ORDER_STATES.ASIGNADA &&
      latestAssignment?.status === ASSIGNMENT_STATUS.IMPEDIMENTO;

    if (!normalAssignmentAllowed && !reassignmentAllowed) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede asignar o reasignar técnico cuando la orden ` +
          `está en estado "${order.estado}"`,
        estado_actual: order.estado,
        assignment_status: latestAssignment?.status || null,
      });
    }

    // No puede existir más de una invitación pendiente.
    await client.query(
      `
        UPDATE service_order_assignments
        SET
          status = $1,
          updated_at = NOW()
        WHERE service_order_id = $2
          AND status = $3
      `,
      [
        ASSIGNMENT_STATUS.REVOCADA,
        order.id,
        ASSIGNMENT_STATUS.PENDIENTE,
      ]
    );

    const result = await client.query(
      `
        UPDATE service_orders
        SET
          tecnico_id = $1,
          estado = $2,
          fecha_asignacion = NOW(),
          "updatedAt" = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [
        tecnico_id,
        SERVICE_ORDER_STATES.ASIGNADA,
        id,
      ]
    );

    const assignmentId = randomUUID();

    const assignmentResult = await client.query(
      `
        INSERT INTO service_order_assignments (
          id,
          service_order_id,
          tecnico_id,
          assigned_by,
          status,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          NOW(), NOW(), NOW()
        )
        RETURNING *
      `,
      [
        assignmentId,
        id,
        tecnico_id,
        assignedBy,
        ASSIGNMENT_STATUS.PENDIENTE,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      ...result.rows[0],
      assignment: assignmentResult.rows[0],
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error assigning technician:', error);

    return res.status(500).json({
      message: 'Error al asignar técnico',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// P2 · MIS SERVICIOS DEL TÉCNICO
// ============================================================

exports.myWork = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = getUserRole(req);

    if (userRole !== 'tecnico') {
      return res.status(403).json({
        message: 'Esta vista está disponible únicamente para técnicos',
      });
    }

    const result = await pool.query(
      `
        SELECT
          so.*,
          CASE
            WHEN c.tipo_persona = 'juridica'
              THEN c.razon_social
            ELSE NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  NULLIF(c.primer_nombre, ''),
                  NULLIF(c.primer_apellido, '')
                )
              ),
              ''
            )
          END AS cliente_nombre,
          c.documento AS cliente_documento,
          c.telefono AS cliente_telefono,
          c.email AS cliente_email,
          c.direccion AS cliente_direccion,
          c.ciudad AS cliente_ciudad,

          COALESCE(
            team_me.member_role,
            CASE
              WHEN so.tecnico_id = $1 THEN 'primary'
              ELSE NULL
            END
          ) AS team_role,
          COALESCE(
            team_me.member_status,
            CASE
              WHEN so.tecnico_id = $1 THEN 'assigned'
              ELSE NULL
            END
          ) AS team_member_status,
          CASE
            WHEN so.tecnico_id = $1 THEN TRUE
            ELSE FALSE
          END AS is_primary_technician,

          a.id AS assignment_id,
          a.status AS assignment_status,
          a.assigned_at,
          a.responded_at,
          a.impediment_reason,
          a.acceptance_note,

          cc.holder_user_id AS custody_holder_user_id,
          cc.custody_since,
          CASE
            WHEN cc.holder_user_id = $1 THEN TRUE
            ELSE FALSE
          END AS has_custody,

          rc.id AS reception_checklist_id,
          rc.status AS reception_checklist_status,
          rc.confirmed_at AS reception_checklist_confirmed_at,
          CASE
            WHEN rc.status = 'confirmed' THEN TRUE
            ELSE FALSE
          END AS reception_checklist_confirmed,

          COALESCE((
            SELECT COUNT(*)::int
            FROM service_order_evidences ev
            WHERE ev.service_order_id = so.id
              AND ev.stage = 'reception'
              AND ev.deleted_at IS NULL
          ), 0) AS reception_evidence_count,

          ra.id AS reception_act_id,
          ra.signed_at AS reception_act_signed_at,
          CASE WHEN ra.id IS NOT NULL THEN TRUE ELSE FALSE END AS reception_act_signed,

          d.id AS diagnosis_id,
          d.status AS diagnosis_status,
          d.work_type AS diagnosis_work_type,
          d.confirmed_at AS diagnosis_confirmed_at,

          COALESCE((
            SELECT COUNT(*)::int
            FROM service_order_evidences dev
            WHERE dev.service_order_id = so.id
              AND dev.stage = 'diagnosis'
              AND dev.deleted_at IS NULL
          ), 0) AS diagnosis_evidence_count

        FROM service_orders so
        LEFT JOIN clients c
          ON c.id = so.client_id

        LEFT JOIN LATERAL (
          SELECT
            tm.technician_id,
            tm.member_role,
            tm.member_status
          FROM service_order_team_members tm
          WHERE tm.service_order_id = so.id
            AND tm.technician_id = $1
            AND tm.member_status = 'assigned'
          ORDER BY tm.added_at DESC
          LIMIT 1
        ) team_me ON TRUE

        LEFT JOIN LATERAL (
          SELECT sa.*
          FROM service_order_assignments sa
          WHERE sa.service_order_id = so.id
            AND sa.tecnico_id = $1
          ORDER BY sa.assigned_at DESC, sa.created_at DESC
          LIMIT 1
        ) a ON TRUE

        LEFT JOIN service_order_current_custody cc
          ON cc.service_order_id = so.id

        LEFT JOIN service_order_reception_checklists rc
          ON rc.service_order_id = so.id

        LEFT JOIN service_order_reception_acts ra
          ON ra.service_order_id = so.id

        LEFT JOIN service_order_diagnostics d
          ON d.service_order_id = so.id

        WHERE
          so.tecnico_id = $1
          OR team_me.technician_id IS NOT NULL
        ORDER BY
          CASE so.estado::text
            WHEN 'asignada' THEN 1
            WHEN 'en_ejecucion' THEN 2
            WHEN 'en_espera' THEN 3
            WHEN 'aprobado' THEN 4
            WHEN 'pendiente' THEN 5
            WHEN 'cerrada' THEN 6
            WHEN 'cancelado' THEN 7
            WHEN 'rechazado' THEN 8
            ELSE 9
          END,
          COALESCE(so.fecha_agendada, so."createdAt") ASC
      `,
      [userId]
    );

    const client = await pool.connect();
    let gps = null;

    try {
      const location = await getRecentPreciseLocation(
        client,
        userId
      );

      gps = {
        available: Boolean(location),
        valid_for_custody: Boolean(location),
        max_accuracy_m: CUSTODY_MAX_ACCURACY_M,
        max_age_minutes: CUSTODY_LOCATION_MAX_AGE_MINUTES,
        location,
      };
    } finally {
      client.release();
    }

    return res.json({
      success: true,
      data: result.rows,
      gps,
    });
  } catch (error) {
    console.error('Error loading technician work:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cargar los servicios del técnico',
    });
  }
};


// ============================================================
// P2.1 · TABLERO OPERATIVO DEL ADMINISTRADOR
// ============================================================

exports.adminWorkBoard = async (req, res) => {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede consultar el tablero operativo',
      });
    }

    const result = await pool.query(
      `
        SELECT
          so.*,
          CASE
            WHEN c.tipo_persona = 'juridica'
              THEN c.razon_social
            ELSE NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  NULLIF(c.primer_nombre, ''),
                  NULLIF(c.primer_apellido, '')
                )
              ),
              ''
            )
          END AS cliente_nombre,
          c.telefono AS cliente_telefono,
          c.direccion AS cliente_direccion,
          c.ciudad AS cliente_ciudad,

          u.id AS tecnico_usuario_id,
          NULLIF(
            TRIM(
              CONCAT_WS(
                ' ',
                NULLIF(u.nombre1, ''),
                NULLIF(u.nombre2, ''),
                NULLIF(u.apellidos, '')
              )
            ),
            ''
          ) AS tecnico_nombre_completo,
          u.usuario AS tecnico_usuario,
          u.celular AS tecnico_celular,

          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'technician_id', tm.technician_id,
                  'member_role', tm.member_role,
                  'member_status', tm.member_status
                )
              )
              FROM service_order_team_members tm
              WHERE tm.service_order_id = so.id
                AND tm.member_status <> 'removed'
            ),
            '[]'::jsonb
          ) AS team_members,
          COALESCE(
            (
              SELECT COUNT(*)::int
              FROM service_order_team_members tm
              WHERE tm.service_order_id = so.id
                AND tm.member_status <> 'removed'
            ),
            0
          ) AS team_size,

          a.id AS assignment_id,
          a.status AS assignment_status,
          a.assigned_at,
          a.responded_at,
          a.impediment_reason,

          cc.holder_user_id AS custody_holder_user_id,
          cc.custody_since,
          CASE
            WHEN cc.holder_user_id = so.tecnico_id THEN TRUE
            ELSE FALSE
          END AS has_custody,

          rc.id AS reception_checklist_id,
          rc.status AS reception_checklist_status,
          rc.confirmed_at AS reception_checklist_confirmed_at,
          CASE
            WHEN rc.status = 'confirmed' THEN TRUE
            ELSE FALSE
          END AS reception_checklist_confirmed,

          COALESCE((
            SELECT COUNT(*)::int
            FROM service_order_evidences ev
            WHERE ev.service_order_id = so.id
              AND ev.stage = 'reception'
              AND ev.deleted_at IS NULL
          ), 0) AS reception_evidence_count,

          ra.id AS reception_act_id,
          ra.signed_at AS reception_act_signed_at,
          CASE WHEN ra.id IS NOT NULL THEN TRUE ELSE FALSE END AS reception_act_signed,

          d.id AS diagnosis_id,
          d.status AS diagnosis_status,
          d.work_type AS diagnosis_work_type,
          d.confirmed_at AS diagnosis_confirmed_at,

          COALESCE((
            SELECT COUNT(*)::int
            FROM service_order_evidences dev
            WHERE dev.service_order_id = so.id
              AND dev.stage = 'diagnosis'
              AND dev.deleted_at IS NULL
          ), 0) AS diagnosis_evidence_count

        FROM service_orders so
        LEFT JOIN clients c
          ON c.id = so.client_id
        LEFT JOIN usuarios u
          ON u.id = so.tecnico_id

        LEFT JOIN LATERAL (
          SELECT sa.*
          FROM service_order_assignments sa
          WHERE sa.service_order_id = so.id
          ORDER BY sa.assigned_at DESC, sa.created_at DESC
          LIMIT 1
        ) a ON TRUE

        LEFT JOIN service_order_current_custody cc
          ON cc.service_order_id = so.id

        LEFT JOIN service_order_reception_checklists rc
          ON rc.service_order_id = so.id

        LEFT JOIN service_order_reception_acts ra
          ON ra.service_order_id = so.id

        LEFT JOIN service_order_diagnostics d
          ON d.service_order_id = so.id

        WHERE so.tecnico_id IS NOT NULL
          AND so.estado::text NOT IN ('cerrada', 'cancelado', 'rechazado')
        ORDER BY
          COALESCE(so.fecha_agendada, so."createdAt") ASC,
          u.nombre1 ASC NULLS LAST
      `
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error loading admin work board:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'P2_P3_TABLES_NOT_INSTALLED',
        message:
          'Faltan tablas de asignación/custodia/checklist. Ejecuta los SQL incluidos en el paquete.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al cargar el tablero operativo',
    });
  }
};

// ============================================================
// P4 · DIRECTORIO DE TÉCNICOS PARA EL TABLERO ADMIN
// Devuelve TODOS los técnicos de la base de datos, incluso sin OS activas.
// ============================================================

exports.workBoardTechnicians = async (req, res) => {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede consultar el directorio técnico',
      });
    }

    let result;

    const baseSelect = `
      SELECT
        u.id,
        u.nombre1,
        u.nombre2,
        u.apellidos,
        u.usuario,
        u.cedula,
        u.celular,
        u.email,
        u.activo,
        (
          SELECT COUNT(DISTINCT so2.id)::int
          FROM service_orders so2
          LEFT JOIN service_order_team_members tm2
            ON tm2.service_order_id = so2.id
           AND tm2.technician_id = u.id
           AND tm2.member_status <> 'removed'
          WHERE
            (
              so2.tecnico_id = u.id
              OR tm2.technician_id = u.id
            )
            AND so2.estado::text NOT IN (
              'cerrada',
              'cancelado',
              'rechazado'
            )
        ) AS active_service_count
    `;

    try {
      result = await pool.query(`
        ${baseSelect},
        loc.latitude,
        loc.longitude,
        loc.accuracy_m AS location_accuracy_m,
        loc.captured_at AS last_location_at,
        loc.integrity_status AS location_integrity_status,
        loc.integrity_score AS location_integrity_score,
        loc.network_changed AS location_network_changed,
        loc.network_trust_status,
        loc.network_proxy,
        loc.network_vpn,
        loc.network_tor,
        loc.network_hosting,
        loc.network_fraud_score,
        loc.device_id,
        loc.device_trust_status,
        loc.precision_tier
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN user_current_locations loc
          ON loc.user_id = u.id
        WHERE LOWER(
          COALESCE(r.name, u.rol::text, '')
        ) = 'tecnico'
        ORDER BY
          u.activo DESC,
          u.nombre1 ASC NULLS LAST,
          u.apellidos ASC NULLS LAST
      `);
    } catch (error) {
      if (
        error?.code !== '42P01' &&
        error?.code !== '42703'
      ) {
        throw error;
      }

      result = await pool.query(`
        ${baseSelect},
        NULL::numeric AS latitude,
        NULL::numeric AS longitude,
        NULL::numeric AS location_accuracy_m,
        NULL::timestamptz AS last_location_at,
        'unverified'::varchar AS location_integrity_status,
        0::int AS location_integrity_score,
        FALSE AS location_network_changed,
        'unknown'::varchar AS network_trust_status,
        FALSE AS network_proxy,
        FALSE AS network_vpn,
        FALSE AS network_tor,
        FALSE AS network_hosting,
        NULL::numeric AS network_fraud_score,
        NULL::varchar AS device_id,
        'unknown'::varchar AS device_trust_status,
        'provisional'::varchar AS precision_tier
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE LOWER(
          COALESCE(r.name, u.rol::text, '')
        ) = 'tecnico'
        ORDER BY
          u.activo DESC,
          u.nombre1 ASC NULLS LAST,
          u.apellidos ASC NULLS LAST
      `);
    }

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      'Error loading technician directory:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Error al cargar el directorio de técnicos',
    });
  }
};

// ============================================================
// P2 · ACEPTAR ASIGNACIÓN
// ============================================================

exports.acceptAssignment = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const note =
      typeof req.body?.note === 'string'
        ? req.body.note.trim().slice(0, 1000)
        : '';

    if (!isTechnicianRole(req)) {
      return res.status(403).json({
        message: 'Solo un técnico puede aceptar una asignación',
      });
    }

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        SELECT
          id,
          codigo_os,
          estado,
          tecnico_id,
          fecha_asignacion
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const order = orderResult.rows[0];

    if (order.tecnico_id !== userId) {
      await safeRollback(client);

      return res.status(403).json({
        message: 'Esta orden no está asignada a tu cuenta',
      });
    }

    if (order.estado !== SERVICE_ORDER_STATES.ASIGNADA) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'Solo se pueden aceptar órdenes que estén asignadas',
        estado_actual: order.estado,
      });
    }

    const assignment =
      await ensurePendingAssignmentForLegacyOrder(
        client,
        order,
        userId
      );

    if (!assignment) {
      await safeRollback(client);

      return res.status(409).json({
        message: 'No existe una asignación pendiente para esta orden',
      });
    }

    if (assignment.tecnico_id !== userId) {
      await safeRollback(client);

      return res.status(403).json({
        message: 'La asignación pendiente pertenece a otro técnico',
      });
    }

    if (assignment.status === ASSIGNMENT_STATUS.ACEPTADA) {
      await safeRollback(client);

      return res.json({
        success: true,
        message: 'La asignación ya había sido aceptada',
        assignment,
      });
    }

    if (assignment.status !== ASSIGNMENT_STATUS.PENDIENTE) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `La asignación está en estado "${assignment.status}"`,
      });
    }

    const location = await getRecentPreciseLocation(
      client,
      userId
    );

    const result = await client.query(
      `
        UPDATE service_order_assignments
        SET
          status = $1,
          responded_at = NOW(),
          acceptance_note = $2,
          response_latitude = $3,
          response_longitude = $4,
          response_accuracy_m = $5,
          response_location_captured_at = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [
        ASSIGNMENT_STATUS.ACEPTADA,
        note || null,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
        assignment.id,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Asignación aceptada correctamente',
      assignment: result.rows[0],
      precise_location_recorded: Boolean(location),
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error accepting assignment:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al aceptar la asignación',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// P2 · REPORTAR IMPEDIMENTO
// ============================================================

exports.reportAssignmentImpediment = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const reason =
      typeof req.body?.reason === 'string'
        ? req.body.reason.trim().slice(0, 2000)
        : '';

    if (!isTechnicianRole(req)) {
      return res.status(403).json({
        message: 'Solo un técnico puede reportar un impedimento',
      });
    }

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (reason.length < 8) {
      return res.status(400).json({
        message:
          'Describe el impedimento con al menos 8 caracteres',
      });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        SELECT
          id,
          codigo_os,
          estado,
          tecnico_id,
          fecha_asignacion
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const order = orderResult.rows[0];

    if (order.tecnico_id !== userId) {
      await safeRollback(client);

      return res.status(403).json({
        message: 'Esta orden no está asignada a tu cuenta',
      });
    }

    if (order.estado !== SERVICE_ORDER_STATES.ASIGNADA) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'El impedimento solo puede reportarse antes de iniciar el servicio',
        estado_actual: order.estado,
      });
    }

    const assignment =
      await ensurePendingAssignmentForLegacyOrder(
        client,
        order,
        userId
      );

    if (!assignment) {
      await safeRollback(client);

      return res.status(409).json({
        message: 'No existe una asignación pendiente para esta orden',
      });
    }

    if (assignment.status !== ASSIGNMENT_STATUS.PENDIENTE) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `La asignación está en estado "${assignment.status}"`,
      });
    }

    const location = await getRecentPreciseLocation(
      client,
      userId
    );

    const result = await client.query(
      `
        UPDATE service_order_assignments
        SET
          status = $1,
          responded_at = NOW(),
          impediment_reason = $2,
          response_latitude = $3,
          response_longitude = $4,
          response_accuracy_m = $5,
          response_location_captured_at = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [
        ASSIGNMENT_STATUS.IMPEDIMENTO,
        reason,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
        assignment.id,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Impedimento reportado. El administrador puede reasignar la orden.',
      assignment: result.rows[0],
      precise_location_recorded: Boolean(location),
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error reporting assignment impediment:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al reportar el impedimento',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// P2 · TOMAR CUSTODIA
// ============================================================

exports.takeCustody = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const note =
      typeof req.body?.note === 'string'
        ? req.body.note.trim().slice(0, 1000)
        : '';

    if (!isTechnicianRole(req)) {
      return res.status(403).json({
        message: 'Solo un técnico puede tomar la custodia',
      });
    }

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        SELECT
          id,
          codigo_os,
          estado,
          tecnico_id
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const order = orderResult.rows[0];

    if (order.tecnico_id !== userId) {
      await safeRollback(client);

      return res.status(403).json({
        message: 'Esta orden no está asignada a tu cuenta',
      });
    }

    if (
      ![
        SERVICE_ORDER_STATES.ASIGNADA,
        SERVICE_ORDER_STATES.EN_EJECUCION,
        SERVICE_ORDER_STATES.EN_ESPERA,
      ].includes(order.estado)
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'No se puede tomar custodia en el estado actual de la orden',
        estado_actual: order.estado,
      });
    }

    const assignment = await getLatestAssignment(
      client,
      order.id,
      { forUpdate: true }
    );

    if (
      !assignment ||
      assignment.tecnico_id !== userId ||
      assignment.status !== ASSIGNMENT_STATUS.ACEPTADA
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'Primero debes aceptar la asignación de esta orden',
        code: 'ASSIGNMENT_NOT_ACCEPTED',
      });
    }

    const currentCustodyResult = await client.query(
      `
        SELECT *
        FROM service_order_current_custody
        WHERE service_order_id = $1
        FOR UPDATE
      `,
      [id]
    );

    const currentCustody = currentCustodyResult.rows[0];

    if (currentCustody?.holder_user_id === userId) {
      await safeRollback(client);

      return res.json({
        success: true,
        message: 'Ya tienes la custodia de este equipo',
        custody: currentCustody,
      });
    }

    if (
      currentCustody?.holder_user_id &&
      currentCustody.holder_user_id !== userId
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'La custodia actual pertenece a otro usuario. Debe transferirse antes.',
        code: 'CUSTODY_OWNED_BY_ANOTHER_USER',
      });
    }

    const location = await getRecentPreciseLocation(
      client,
      userId
    );

    if (
      CUSTODY_REQUIRE_PRECISE_LOCATION &&
      !location
    ) {
      await safeRollback(client);

      return res.status(409).json({
        success: false,
        code: 'PRECISE_LOCATION_REQUIRED',
        message:
          `Para tomar custodia necesitamos una ubicación reciente ` +
          `con precisión de ±${CUSTODY_MAX_ACCURACY_M} m o mejor. ` +
          `Activa la ubicación precisa y espera unos segundos.`,
      });
    }

    const custodyResult = await client.query(
      `
        INSERT INTO service_order_current_custody (
          service_order_id,
          holder_user_id,
          custody_since,
          updated_by,
          latitude,
          longitude,
          accuracy_m,
          location_captured_at,
          updated_at
        )
        VALUES (
          $1, $2, NOW(), $2,
          $3, $4, $5, $6,
          NOW()
        )
        ON CONFLICT (service_order_id)
        DO UPDATE SET
          holder_user_id = EXCLUDED.holder_user_id,
          custody_since = EXCLUDED.custody_since,
          updated_by = EXCLUDED.updated_by,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          accuracy_m = EXCLUDED.accuracy_m,
          location_captured_at = EXCLUDED.location_captured_at,
          updated_at = NOW()
        RETURNING *
      `,
      [
        id,
        userId,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
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
          latitude,
          longitude,
          accuracy_m,
          location_captured_at,
          created_at
        )
        VALUES (
          $1, $2, 'tomada',
          NULL, $3, $3, $4,
          $5, $6, $7, $8,
          NOW()
        )
      `,
      [
        randomUUID(),
        id,
        userId,
        note || null,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Custodia registrada correctamente',
      custody: custodyResult.rows[0],
      precise_location_recorded: Boolean(location),
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error taking custody:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al registrar la custodia',
    });
  } finally {
    client.release();
  }
};


// ============================================================
// P3 · CHECKLIST DE RECEPCIÓN
// ============================================================

async function getOrderForChecklist(client, serviceOrderId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT
        id,
        codigo_os,
        estado,
        tecnico_id
      FROM service_orders
      WHERE id = $1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [serviceOrderId]
  );

  return result.rows[0] || null;
}

async function assertChecklistAccess(client, req, serviceOrderId, { write = false } = {}) {
  const order = await getOrderForChecklist(
    client,
    serviceOrderId,
    { forUpdate: write }
  );

  if (!order) {
    return {
      ok: false,
      status: 404,
      message: 'Orden de servicio no encontrada',
    };
  }

  const role = getUserRole(req);
  const userId = req.user?.id;

  if (role === 'admin' && !write) {
    return { ok: true, order };
  }

  if (role !== 'tecnico') {
    return {
      ok: false,
      status: 403,
      message: write
        ? 'Solo el técnico asignado puede diligenciar el checklist'
        : 'No tienes permiso para consultar este checklist',
    };
  }

  if (order.tecnico_id !== userId) {
    return {
      ok: false,
      status: 403,
      message: 'Esta orden no está asignada a tu cuenta',
    };
  }

  if (write) {
    const custodyResult = await client.query(
      `
        SELECT holder_user_id
        FROM service_order_current_custody
        WHERE service_order_id = $1
      `,
      [serviceOrderId]
    );

    if (custodyResult.rows[0]?.holder_user_id !== userId) {
      return {
        ok: false,
        status: 409,
        message:
          'Debes tener la custodia de la orden para diligenciar el checklist de recepción',
      };
    }
  }

  return { ok: true, order };
}

exports.getReceptionChecklist = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden no válido',
      });
    }

    const access = await assertChecklistAccess(
      client,
      req,
      id,
      { write: false }
    );

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const result = await client.query(
      `
        SELECT *
        FROM service_order_reception_checklists
        WHERE service_order_id = $1
        LIMIT 1
      `,
      [id]
    );

    return res.json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Error getting reception checklist:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'RECEPTION_CHECKLIST_TABLE_NOT_INSTALLED',
        message: 'La tabla del checklist de recepción aún no está instalada',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al obtener el checklist de recepción',
    });
  } finally {
    client.release();
  }
};

exports.saveReceptionChecklist = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden no válido',
      });
    }

    const access = await assertChecklistAccess(
      client,
      req,
      id,
      { write: true }
    );

    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const {
      equipment_type,
      brand,
      model,
      serial_number,
      received_from_name,
      received_from_document,
      condition_flags,
      accessories,
      accessories_other,
      observations,
    } = req.body || {};

    const existingResult = await client.query(
      `
        SELECT *
        FROM service_order_reception_checklists
        WHERE service_order_id = $1
        LIMIT 1
      `,
      [id]
    );

    const existing = existingResult.rows[0];

    if (existing?.status === 'confirmed') {
      return res.status(409).json({
        success: false,
        message:
          'El checklist ya fue confirmado y no puede modificarse desde el flujo técnico',
      });
    }

    const checklistId = existing?.id || randomUUID();

    const result = await client.query(
      `
        INSERT INTO service_order_reception_checklists (
          id,
          service_order_id,
          technician_id,
          status,
          equipment_type,
          brand,
          model,
          serial_number,
          received_from_name,
          received_from_document,
          condition_flags,
          accessories,
          accessories_other,
          observations,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 'draft',
          $4, $5, $6, $7,
          $8, $9, $10::jsonb, $11::jsonb,
          $12, $13,
          NOW(), NOW()
        )
        ON CONFLICT (service_order_id)
        DO UPDATE SET
          technician_id = EXCLUDED.technician_id,
          equipment_type = EXCLUDED.equipment_type,
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          serial_number = EXCLUDED.serial_number,
          received_from_name = EXCLUDED.received_from_name,
          received_from_document = EXCLUDED.received_from_document,
          condition_flags = EXCLUDED.condition_flags,
          accessories = EXCLUDED.accessories,
          accessories_other = EXCLUDED.accessories_other,
          observations = EXCLUDED.observations,
          updated_at = NOW()
        RETURNING *
      `,
      [
        checklistId,
        id,
        userId,
        typeof equipment_type === 'string'
          ? equipment_type.trim().slice(0, 150) || null
          : null,
        typeof brand === 'string'
          ? brand.trim().slice(0, 120) || null
          : null,
        typeof model === 'string'
          ? model.trim().slice(0, 120) || null
          : null,
        typeof serial_number === 'string'
          ? serial_number.trim().slice(0, 160) || null
          : null,
        typeof received_from_name === 'string'
          ? received_from_name.trim().slice(0, 180) || null
          : null,
        typeof received_from_document === 'string'
          ? received_from_document.trim().slice(0, 80) || null
          : null,
        JSON.stringify(
          condition_flags &&
          typeof condition_flags === 'object' &&
          !Array.isArray(condition_flags)
            ? condition_flags
            : {}
        ),
        JSON.stringify(
          accessories &&
          typeof accessories === 'object' &&
          !Array.isArray(accessories)
            ? accessories
            : {}
        ),
        typeof accessories_other === 'string'
          ? accessories_other.trim().slice(0, 1000) || null
          : null,
        typeof observations === 'string'
          ? observations.trim().slice(0, 4000) || null
          : null,
      ]
    );

    return res.json({
      success: true,
      message: 'Checklist guardado como borrador',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error saving reception checklist:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'RECEPTION_CHECKLIST_TABLE_NOT_INSTALLED',
        message: 'La tabla del checklist de recepción aún no está instalada',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al guardar el checklist de recepción',
    });
  } finally {
    client.release();
  }
};

exports.confirmReceptionChecklist = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const access = await assertChecklistAccess(
      client,
      req,
      id,
      { write: true }
    );

    if (!access.ok) {
      await safeRollback(client);
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const order = access.order;

    if (
      ![
        SERVICE_ORDER_STATES.ASIGNADA,
        SERVICE_ORDER_STATES.EN_EJECUCION,
        SERVICE_ORDER_STATES.EN_ESPERA,
      ].includes(order.estado)
    ) {
      await safeRollback(client);

      return res.status(409).json({
        success: false,
        message:
          'El checklist de recepción no puede confirmarse en el estado actual de la orden',
        estado_actual: order.estado,
      });
    }

    const custodyResult = await client.query(
      `
        SELECT holder_user_id
        FROM service_order_current_custody
        WHERE service_order_id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (
      custodyResult.rows[0]?.holder_user_id !== userId
    ) {
      await safeRollback(client);

      return res.status(409).json({
        success: false,
        code: 'CUSTODY_REQUIRED',
        message:
          'Debes tener la custodia de la orden antes de confirmar la recepción',
      });
    }

    const checklistResult = await client.query(
      `
        SELECT *
        FROM service_order_reception_checklists
        WHERE service_order_id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (checklistResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(409).json({
        success: false,
        message:
          'Primero guarda el checklist de recepción',
      });
    }

    const checklist = checklistResult.rows[0];

    if (checklist.status === 'confirmed') {
      await safeRollback(client);

      return res.json({
        success: true,
        message: 'El checklist ya estaba confirmado',
        data: checklist,
      });
    }

    const conditionFlags =
      checklist.condition_flags || {};

    const hasConditionSelection =
      Object.values(conditionFlags).some(Boolean);

    if (
      !checklist.equipment_type ||
      !checklist.received_from_name ||
      !hasConditionSelection
    ) {
      await safeRollback(client);

      return res.status(400).json({
        success: false,
        message:
          'Completa tipo de equipo, recibido de y al menos una condición física',
      });
    }

    const location = await getRecentPreciseLocation(
      client,
      userId
    );

    const result = await client.query(
      `
        UPDATE service_order_reception_checklists
        SET
          status = 'confirmed',
          confirmed_at = NOW(),
          latitude = $1,
          longitude = $2,
          accuracy_m = $3,
          location_captured_at = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
        checklist.id,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Recepción confirmada correctamente',
      data: result.rows[0],
      precise_location_recorded: Boolean(location),
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error confirming reception checklist:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'P2_P3_TABLES_NOT_INSTALLED',
        message:
          'Faltan tablas de custodia o checklist. Ejecuta los SQL incluidos.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al confirmar el checklist de recepción',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// AGREGAR REPUESTO USADO
// ============================================================

exports.addPart = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      product_id,
      cantidad,
      observaciones,
    } = req.body || {};

    const userId = req.user?.id;
    const qty = Number(cantidad);

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    if (!product_id || !isUuid(product_id)) {
      return res.status(400).json({
        message: 'Producto no válido',
      });
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        message: 'La cantidad debe ser un entero mayor que cero',
      });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        SELECT id, estado
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    if (isTerminalState(orderResult.rows[0].estado)) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'No se pueden agregar repuestos a una orden finalizada',
      });
    }

    const stockResult = await client.query(
      `
        UPDATE products
        SET stock_actual = stock_actual - $1
        WHERE id = $2
          AND stock_actual >= $1
        RETURNING id, stock_actual
      `,
      [qty, product_id]
    );

    if (stockResult.rows.length === 0) {
      const productExists = await client.query(
        `SELECT id FROM products WHERE id = $1`,
        [product_id]
      );

      await safeRollback(client);

      if (productExists.rows.length === 0) {
        return res.status(404).json({
          message: 'Producto no encontrado',
        });
      }

      return res.status(400).json({
        message: 'Stock insuficiente',
      });
    }

    await client.query(
      `
        INSERT INTO inventory_movements (
          product_id,
          tipo_movimiento,
          origen_tipo,
          origen_id,
          cantidad,
          usuario_id,
          observaciones,
          fecha,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          NOW(), NOW(), NOW()
        )
      `,
      [
        product_id,
        'salida',
        'servicio',
        id,
        qty,
        userId || null,
        typeof observaciones === 'string'
          ? observaciones.trim() || null
          : null,
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Repuesto agregado correctamente',
      stock_actual: stockResult.rows[0].stock_actual,
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error adding part:', error);

    return res.status(500).json({
      message: 'Error al agregar repuesto',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// ACTUALIZAR DIAGNÓSTICO / OBSERVACIONES
// ============================================================

exports.update = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      diagnostico_final,
      observaciones,
    } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT id, estado
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    if (isTerminalState(currentResult.rows[0].estado)) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'No se puede modificar una orden que ya está finalizada',
      });
    }

    const result = await client.query(
      `
        UPDATE service_orders
        SET
          diagnostico_final = COALESCE($1, diagnostico_final),
          observaciones = COALESCE($2, observaciones),
          "updatedAt" = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [
        typeof diagnostico_final === 'string'
          ? diagnostico_final.trim() || null
          : null,
        typeof observaciones === 'string'
          ? observaciones.trim() || null
          : null,
        id,
      ]
    );

    await client.query('COMMIT');

    return res.json(result.rows[0]);
  } catch (error) {
    await safeRollback(client);

    console.error('Error updating service order:', error);

    return res.status(500).json({
      message: 'Error al actualizar la orden',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// "ELIMINAR" ORDEN = CANCELAR, NO BORRAR FÍSICAMENTE
// ============================================================

exports.delete = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT id, codigo_os, estado
        FROM service_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (currentResult.rows.length === 0) {
      await safeRollback(client);

      return res.status(404).json({
        message: 'Orden de servicio no encontrada',
      });
    }

    const order = currentResult.rows[0];

    if (order.estado === SERVICE_ORDER_STATES.CANCELADO) {
      await safeRollback(client);

      return res.json({
        message: 'La orden ya se encuentra cancelada',
      });
    }

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.CANCELADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede cancelar una orden en estado ` +
          `"${order.estado}"`,
        estado_actual: order.estado,
      });
    }

    await client.query(
      `
        UPDATE service_orders
        SET
          estado = $1,
          "updatedAt" = NOW()
        WHERE id = $2
      `,
      [SERVICE_ORDER_STATES.CANCELADO, id]
    );

    await client.query('COMMIT');

    return res.json({
      message:
        'Orden cancelada correctamente. ' +
        'Se conserva el historial y no se elimina físicamente.',
    });
  } catch (error) {
    await safeRollback(client);

    console.error('Error cancelling service order:', error);

    return res.status(500).json({
      message: 'Error al cancelar la orden',
    });
  } finally {
    client.release();
  }
};

// ============================================================
// V6 · DISPOSITIVOS DE UBICACIÓN - ADMIN
// ============================================================
exports.getTechnicianLocationDevices = async (req, res) => {
  try {
    if (!isAdminRole(req)) return res.status(403).json({ success: false, message: 'Solo administrador' });
    const { technicianId } = req.params;
    if (!isUuid(technicianId)) return res.status(400).json({ success: false, message: 'ID de técnico no válido' });

    const result = await pool.query(
      `SELECT id, user_id, device_id, trust_status, platform, first_seen_at, last_seen_at, approved_at, revoked_at
       FROM user_location_devices
       WHERE user_id = $1
       ORDER BY last_seen_at DESC`,
      [technicianId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error loading technician devices:', error);
    return res.status(500).json({ success: false, message: 'Error al cargar dispositivos' });
  }
};

exports.approveTechnicianLocationDevice = async (req, res) => {
  try {
    if (!isAdminRole(req)) return res.status(403).json({ success: false, message: 'Solo administrador' });
    const { technicianId, deviceId } = req.params;
    if (!isUuid(technicianId) || !isUuid(deviceId)) return res.status(400).json({ success: false, message: 'Identificador no válido' });

    const result = await pool.query(
      `UPDATE user_location_devices
       SET trust_status = 'trusted', approved_at = NOW(), approved_by = $1, revoked_at = NULL
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, device_id, trust_status, platform, approved_at, last_seen_at`,
      [req.user.id, deviceId, technicianId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Dispositivo no encontrado' });
    return res.json({ success: true, data: result.rows[0], message: 'Dispositivo autorizado' });
  } catch (error) {
    console.error('Error approving technician device:', error);
    return res.status(500).json({ success: false, message: 'Error al autorizar dispositivo' });
  }
};

exports.revokeTechnicianLocationDevice = async (req, res) => {
  try {
    if (!isAdminRole(req)) return res.status(403).json({ success: false, message: 'Solo administrador' });
    const { technicianId, deviceId } = req.params;
    const result = await pool.query(
      `UPDATE user_location_devices
       SET trust_status = 'revoked', revoked_at = NOW(), approved_at = NULL, approved_by = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, device_id, trust_status, revoked_at`,
      [req.user.id, deviceId, technicianId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Dispositivo no encontrado' });
    return res.json({ success: true, data: result.rows[0], message: 'Dispositivo revocado' });
  } catch (error) {
    console.error('Error revoking technician device:', error);
    return res.status(500).json({ success: false, message: 'Error al revocar dispositivo' });
  }
};

// ============================================================
// V6 · GEOCERCA DE SERVICIO - ADMIN
// ============================================================
exports.getServiceGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'ID de orden no válido' });
    const result = await pool.query(`SELECT * FROM service_order_geofences WHERE service_order_id = $1 LIMIT 1`, [id]);
    return res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('Error loading geofence:', error);
    return res.status(500).json({ success: false, message: 'Error al cargar geocerca' });
  }
};

exports.setServiceGeofence = async (req, res) => {
  try {
    if (!isAdminRole(req)) return res.status(403).json({ success: false, message: 'Solo administrador' });
    const { id } = req.params;
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const radiusM = Number(req.body?.radius_m || 150);
    if (!isUuid(id) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(radiusM) || radiusM < 25 || radiusM > 2000) {
      return res.status(400).json({ success: false, message: 'Coordenadas o radio no válidos' });
    }
    const result = await pool.query(
      `INSERT INTO service_order_geofences (service_order_id, latitude, longitude, radius_m, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5,NOW(),NOW())
       ON CONFLICT (service_order_id) DO UPDATE SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, radius_m=EXCLUDED.radius_m, updated_by=EXCLUDED.updated_by, updated_at=NOW()
       RETURNING *`,
      [id, latitude, longitude, radiusM, req.user.id]
    );
    return res.json({ success: true, data: result.rows[0], message: 'Geocerca guardada' });
  } catch (error) {
    console.error('Error setting geofence:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar geocerca' });
  }
};

// ============================================================
// V6 · VISITA TÉCNICA: EN CAMINO / LLEGADA VALIDADA
// ============================================================
exports.markEnRoute = async (req, res) => {
  try {
    if (!isTechnicianRole(req)) return res.status(403).json({ success: false, message: 'Solo técnico' });
    const { id } = req.params;
    const own = await pool.query(`SELECT id FROM service_orders WHERE id=$1 AND tecnico_id=$2 LIMIT 1`, [id, req.user.id]);
    if (!own.rows[0]) return res.status(404).json({ success: false, message: 'Servicio no asignado a este técnico' });
    await pool.query(
      `INSERT INTO service_order_visit_events (id, service_order_id, tecnico_id, event_type, created_at)
       VALUES ($1,$2,$3,'en_camino',NOW())`,
      [randomUUID(), id, req.user.id]
    );
    return res.json({ success: true, message: 'Estado de visita actualizado' });
  } catch (error) {
    console.error('Error marking en route:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar visita' });
  }
};

exports.markArrived = async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isTechnicianRole(req)) return res.status(403).json({ success: false, message: 'Solo técnico' });
    const { id } = req.params;
    await client.query('BEGIN');
    const own = await client.query(`SELECT id FROM service_orders WHERE id=$1 AND tecnico_id=$2 LIMIT 1 FOR UPDATE`, [id, req.user.id]);
    if (!own.rows[0]) { await safeRollback(client); return res.status(404).json({ success: false, message: 'Servicio no asignado a este técnico' }); }

    const fenceResult = await client.query(`SELECT * FROM service_order_geofences WHERE service_order_id=$1 LIMIT 1`, [id]);
    const fence = fenceResult.rows[0];
    if (!fence) { await safeRollback(client); return res.status(409).json({ success: false, code: 'GEOFENCE_NOT_CONFIGURED', message: 'La ubicación objetivo del servicio todavía no está configurada' }); }

    const location = await getRecentPreciseLocation(client, req.user.id);
    if (!location) { await safeRollback(client); return res.status(409).json({ success: false, code: 'TRUSTED_PRECISE_LOCATION_REQUIRED', message: 'No fue posible validar una ubicación precisa y confiable para confirmar la llegada' }); }

    const distance = haversineMeters(
      location.latitude,
      location.longitude,
      Number(fence.latitude),
      Number(fence.longitude)
    );

    if (distance > Number(fence.radius_m)) {
      await safeRollback(client);
      return res.status(409).json({
        success: false,
        code: 'OUTSIDE_SERVICE_GEOFENCE',
        message: 'No fue posible validar la llegada en el punto del servicio',
      });
    }

    await client.query(
      `INSERT INTO service_order_visit_events
       (id, service_order_id, tecnico_id, event_type, latitude, longitude, accuracy_m, distance_to_target_m, network_trust_status, device_trust_status, created_at)
       VALUES ($1,$2,$3,'llegada_validada',$4,$5,$6,$7,$8,$9,NOW())`,
      [randomUUID(), id, req.user.id, location.latitude, location.longitude, location.accuracy_m, distance, location.network_trust_status, location.device_trust_status]
    );
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Llegada validada correctamente' });
  } catch (error) {
    await safeRollback(client);
    console.error('Error marking arrival:', error);
    return res.status(500).json({ success: false, message: 'Error al validar llegada' });
  } finally {
    client.release();
  }
};

// ============================================================
// V7 · EVIDENCIAS, ACTA DE RECIBO Y DIAGNÓSTICO
// Basado en el flujo funcional: evidencia inicial -> acta firmada
// -> ejecución -> diagnóstico/resultado con evidencia.
// ============================================================

function cleanText(value, max = 4000) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

async function readBinaryRequest(req, maxBytes = SERVICE_EVIDENCE_MAX_BYTES) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) {
      const error = new Error('Archivo demasiado grande');
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }
    return req.body;
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > maxBytes) {
      const error = new Error('Archivo demasiado grande');
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function getOrderForEvidence(client, req, orderId, { write = false } = {}) {
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

  if (isAdminRole(req) && !write) {
    return { ok: true, order };
  }

  if (!isTechnicianRole(req) || order.tecnico_id !== req.user?.id) {
    return {
      ok: false,
      status: 403,
      message: write
        ? 'Solo el técnico asignado puede registrar información operativa'
        : 'No tienes acceso a esta orden',
    };
  }

  return { ok: true, order };
}

async function assertTechnicianCustody(client, orderId, userId) {
  const result = await client.query(
    `
      SELECT holder_user_id
      FROM service_order_current_custody
      WHERE service_order_id = $1
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0]?.holder_user_id === userId;
}

async function evidenceStageLocked(client, orderId, stage) {
  if (stage === 'reception') {
    const act = await client.query(
      `SELECT id FROM service_order_reception_acts WHERE service_order_id = $1 LIMIT 1`,
      [orderId]
    );
    return Boolean(act.rows[0]);
  }

  if (stage === 'diagnosis') {
    const diagnosis = await client.query(
      `SELECT status FROM service_order_diagnostics WHERE service_order_id = $1 LIMIT 1`,
      [orderId]
    );
    return diagnosis.rows[0]?.status === 'confirmed';
  }

  return false;
}

exports.getServiceEvidences = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const stage = cleanText(req.query?.stage, 40);

    const access = await getOrderForEvidence(client, req, id, { write: false });
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const params = [id];
    let stageSql = '';

    if (stage) {
      if (!EVIDENCE_STAGES.has(stage)) {
        return res.status(400).json({ success: false, message: 'Etapa de evidencia no válida' });
      }
      params.push(stage);
      stageSql = 'AND e.stage = $2';
    }

    const result = await client.query(
      `
        SELECT
          e.id,
          e.service_order_id,
          e.technician_id,
          e.stage,
          e.category,
          e.original_name,
          e.mime_type,
          e.size_bytes,
          e.note,
          e.captured_at,
          e.created_at
        FROM service_order_evidences e
        WHERE e.service_order_id = $1
          ${stageSql}
          AND e.deleted_at IS NULL
        ORDER BY e.created_at DESC
      `,
      params
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error loading service evidences:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V7_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V7 de evidencias y diagnóstico',
      });
    }

    return res.status(500).json({ success: false, message: 'Error al cargar evidencias' });
  } finally {
    client.release();
  }
};

exports.uploadServiceEvidence = async (req, res) => {
  const client = await pool.connect();
  let absolutePath = null;

  try {
    const { id } = req.params;
    const stage = cleanText(req.query?.stage, 40);
    const category = cleanText(req.query?.category, 80);
    const note = cleanText(req.query?.note, 1500);
    const originalName = cleanText(req.query?.name, 255) || 'evidencia';
    const capturedAtRaw = cleanText(req.query?.captured_at, 80);

    if (!stage || !EVIDENCE_STAGES.has(stage)) {
      return res.status(400).json({ success: false, message: 'Etapa de evidencia no válida' });
    }

    if (!['reception', 'diagnosis'].includes(stage)) {
      return res.status(400).json({
        success: false,
        message: 'Esta versión permite cargar evidencias de recepción y diagnóstico',
      });
    }

    const access = await getOrderForEvidence(client, req, id, { write: true });
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const hasCustody = await assertTechnicianCustody(client, id, req.user.id);
    if (!hasCustody) {
      return res.status(409).json({
        success: false,
        code: 'CUSTODY_REQUIRED',
        message: 'Debes tener la custodia del equipo para cargar evidencias',
      });
    }

    if (stage === 'reception' && !['asignada', 'en_ejecucion', 'en_espera'].includes(access.order.estado)) {
      return res.status(409).json({ success: false, message: 'No puedes registrar evidencias de recepción en el estado actual' });
    }

    if (stage === 'diagnosis' && !['en_ejecucion', 'en_espera'].includes(access.order.estado)) {
      return res.status(409).json({ success: false, message: 'El diagnóstico solo puede documentarse durante la ejecución' });
    }

    if (await evidenceStageLocked(client, id, stage)) {
      return res.status(409).json({
        success: false,
        code: 'EVIDENCE_STAGE_LOCKED',
        message: stage === 'reception'
          ? 'Las evidencias iniciales quedaron bloqueadas al firmar el acta de recibo'
          : 'Las evidencias del diagnóstico quedaron bloqueadas al confirmar el diagnóstico',
      });
    }

    const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const extension = ALLOWED_EVIDENCE_MIME[mimeType];

    if (!extension) {
      return res.status(415).json({
        success: false,
        message: 'Formato no permitido. Usa JPG, PNG o WEBP',
      });
    }

    const buffer = await readBinaryRequest(req);
    if (!buffer.length) {
      return res.status(400).json({ success: false, message: 'El archivo está vacío' });
    }

    const evidenceId = randomUUID();
    const relativeDir = path.join(id, stage);
    const relativePath = path.join(relativeDir, `${evidenceId}${extension}`);
    absolutePath = path.resolve(SERVICE_EVIDENCE_DIR, relativePath);

    if (!absolutePath.startsWith(`${SERVICE_EVIDENCE_DIR}${path.sep}`)) {
      throw new Error('Ruta de evidencia inválida');
    }

    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, buffer, { flag: 'wx' });

    const capturedAt = capturedAtRaw && !Number.isNaN(Date.parse(capturedAtRaw))
      ? new Date(capturedAtRaw)
      : null;

    const result = await client.query(
      `
        INSERT INTO service_order_evidences (
          id, service_order_id, technician_id, stage, category,
          original_name, mime_type, size_bytes, storage_path, note,
          captured_at, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        RETURNING id, service_order_id, technician_id, stage, category,
                  original_name, mime_type, size_bytes, note, captured_at, created_at
      `,
      [
        evidenceId,
        id,
        req.user.id,
        stage,
        category,
        originalName,
        mimeType,
        buffer.length,
        relativePath,
        note,
        capturedAt,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Evidencia registrada',
      data: result.rows[0],
    });
  } catch (error) {
    if (absolutePath) {
      try { await fsp.unlink(absolutePath); } catch (_) {}
    }

    console.error('Error uploading service evidence:', error);

    if (error?.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({
        success: false,
        message: `La imagen supera el límite de ${Math.round(SERVICE_EVIDENCE_MAX_BYTES / 1024 / 1024)} MB`,
      });
    }

    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }

    return res.status(500).json({ success: false, message: 'Error al guardar la evidencia' });
  } finally {
    client.release();
  }
};

exports.getServiceEvidenceFile = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, evidenceId } = req.params;

    if (!isUuid(evidenceId)) {
      return res.status(400).json({ success: false, message: 'ID de evidencia no válido' });
    }

    const access = await getOrderForEvidence(client, req, id, { write: false });
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const result = await client.query(
      `
        SELECT storage_path, mime_type, original_name
        FROM service_order_evidences
        WHERE id = $1 AND service_order_id = $2 AND deleted_at IS NULL
        LIMIT 1
      `,
      [evidenceId, id]
    );

    const evidence = result.rows[0];
    if (!evidence) {
      return res.status(404).json({ success: false, message: 'Evidencia no encontrada' });
    }

    const absolutePath = path.resolve(SERVICE_EVIDENCE_DIR, evidence.storage_path);
    if (!absolutePath.startsWith(`${SERVICE_EVIDENCE_DIR}${path.sep}`) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'Archivo de evidencia no disponible' });
    }

    res.setHeader('Content-Type', evidence.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="evidencia-${evidenceId}"`);

    return fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    console.error('Error reading evidence file:', error);
    return res.status(500).json({ success: false, message: 'Error al abrir la evidencia' });
  } finally {
    client.release();
  }
};

exports.deleteServiceEvidence = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id, evidenceId } = req.params;

    if (!isUuid(evidenceId)) {
      return res.status(400).json({ success: false, message: 'ID de evidencia no válido' });
    }

    const access = await getOrderForEvidence(client, req, id, { write: true });
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const result = await client.query(
      `
        SELECT id, stage, technician_id
        FROM service_order_evidences
        WHERE id = $1 AND service_order_id = $2 AND deleted_at IS NULL
        LIMIT 1
      `,
      [evidenceId, id]
    );

    const evidence = result.rows[0];
    if (!evidence) return res.status(404).json({ success: false, message: 'Evidencia no encontrada' });

    if (evidence.technician_id && evidence.technician_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Solo puedes retirar tus propias evidencias antes de confirmar la etapa' });
    }

    if (await evidenceStageLocked(client, id, evidence.stage)) {
      return res.status(409).json({ success: false, message: 'La evidencia ya forma parte de una etapa confirmada y no puede retirarse' });
    }

    await client.query(
      `UPDATE service_order_evidences SET deleted_at = NOW() WHERE id = $1`,
      [evidenceId]
    );

    return res.json({ success: true, message: 'Evidencia retirada de la vista operativa' });
  } catch (error) {
    console.error('Error deleting evidence:', error);
    return res.status(500).json({ success: false, message: 'Error al retirar la evidencia' });
  } finally {
    client.release();
  }
};

exports.getReceptionAct = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const access = await getOrderForEvidence(client, req, id, { write: false });
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const [actResult, checklistResult, evidenceCount] = await Promise.all([
      client.query(
        `SELECT id, service_order_id, technician_id, checklist_id, status,
                signed_by_name, signed_by_document, signature_mime_type,
                signed_at, latitude, longitude, accuracy_m,
                location_captured_at, location_integrity_status, created_at, updated_at
         FROM service_order_reception_acts
         WHERE service_order_id = $1 LIMIT 1`,
        [id]
      ),
      client.query(
        `SELECT id, status, received_from_name, received_from_document, equipment_type,
                brand, model, serial_number, observations, confirmed_at
         FROM service_order_reception_checklists
         WHERE service_order_id = $1 LIMIT 1`,
        [id]
      ),
      client.query(
        `SELECT COUNT(*)::int AS total
         FROM service_order_evidences
         WHERE service_order_id = $1 AND stage = 'reception' AND deleted_at IS NULL`,
        [id]
      ),
    ]);

    return res.json({
      success: true,
      data: actResult.rows[0] || null,
      checklist: checklistResult.rows[0] || null,
      reception_evidence_count: evidenceCount.rows[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error loading reception act:', error);
    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }
    return res.status(500).json({ success: false, message: 'Error al cargar el acta de recibo' });
  } finally {
    client.release();
  }
};

exports.signReceptionAct = async (req, res) => {
  const client = await pool.connect();
  let signatureAbsolutePath = null;

  try {
    const { id } = req.params;
    const signedByName = cleanText(req.query?.signed_by_name, 180);
    const signedByDocument = cleanText(req.query?.signed_by_document, 80);

    if (!signedByName) {
      return res.status(400).json({ success: false, message: 'Indica el nombre de la persona que firma el acta' });
    }

    const access = await getOrderForEvidence(client, req, id, { write: true });
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const hasCustody = await assertTechnicianCustody(client, id, req.user.id);
    if (!hasCustody) {
      return res.status(409).json({ success: false, code: 'CUSTODY_REQUIRED', message: 'Debes mantener la custodia del equipo para cerrar el acta de recibo' });
    }

    const existingAct = await client.query(
      `SELECT id, signed_at FROM service_order_reception_acts WHERE service_order_id = $1 LIMIT 1`,
      [id]
    );

    if (existingAct.rows[0]) {
      return res.status(409).json({ success: false, message: 'El acta de recibo ya fue firmada y quedó bloqueada' });
    }

    const checklistResult = await client.query(
      `SELECT id, status FROM service_order_reception_checklists WHERE service_order_id = $1 LIMIT 1`,
      [id]
    );

    const checklist = checklistResult.rows[0];
    if (checklist?.status !== 'confirmed') {
      return res.status(409).json({ success: false, code: 'RECEPTION_CHECKLIST_REQUIRED', message: 'Confirma primero el checklist de recepción' });
    }

    const evidenceCount = await client.query(
      `SELECT COUNT(*)::int AS total FROM service_order_evidences WHERE service_order_id = $1 AND stage = 'reception' AND deleted_at IS NULL`,
      [id]
    );

    if ((evidenceCount.rows[0]?.total || 0) < 1) {
      return res.status(409).json({ success: false, code: 'RECEPTION_EVIDENCE_REQUIRED', message: 'Registra al menos una fotografía del estado inicial del equipo' });
    }

    const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (mimeType !== 'image/png') {
      return res.status(415).json({ success: false, message: 'La firma debe enviarse en formato PNG' });
    }

    const signature = await readBinaryRequest(req, 2 * 1024 * 1024);
    if (signature.length < 100) {
      return res.status(400).json({ success: false, message: 'No se recibió una firma válida' });
    }

    const actId = randomUUID();
    const relativePath = path.join(id, 'reception-act', `${actId}.png`);
    signatureAbsolutePath = path.resolve(SERVICE_EVIDENCE_DIR, relativePath);

    if (!signatureAbsolutePath.startsWith(`${SERVICE_EVIDENCE_DIR}${path.sep}`)) {
      throw new Error('Ruta de firma inválida');
    }

    await fsp.mkdir(path.dirname(signatureAbsolutePath), { recursive: true });
    await fsp.writeFile(signatureAbsolutePath, signature, { flag: 'wx' });

    const location = await getRecentPreciseLocation(client, req.user.id);

    const result = await client.query(
      `
        INSERT INTO service_order_reception_acts (
          id, service_order_id, technician_id, checklist_id, status,
          signed_by_name, signed_by_document, signature_mime_type,
          signature_storage_path, signed_at,
          latitude, longitude, accuracy_m, location_captured_at,
          location_integrity_status, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,'signed',$5,$6,'image/png',$7,NOW(),$8,$9,$10,$11,$12,NOW(),NOW())
        RETURNING id, service_order_id, technician_id, checklist_id, status,
                  signed_by_name, signed_by_document, signed_at,
                  latitude, longitude, accuracy_m, location_captured_at,
                  location_integrity_status, created_at
      `,
      [
        actId,
        id,
        req.user.id,
        checklist.id,
        signedByName,
        signedByDocument,
        relativePath,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy_m ?? null,
        location?.captured_at ?? null,
        location?.integrity_status ?? null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Acta de recibo firmada y bloqueada correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    if (signatureAbsolutePath) {
      try { await fsp.unlink(signatureAbsolutePath); } catch (_) {}
    }

    console.error('Error signing reception act:', error);
    if (error?.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({ success: false, message: 'La firma supera el tamaño permitido' });
    }
    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }
    return res.status(500).json({ success: false, message: 'Error al firmar el acta de recibo' });
  } finally {
    client.release();
  }
};

exports.getReceptionActSignature = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const access = await getOrderForEvidence(client, req, id, { write: false });
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const result = await client.query(
      `SELECT signature_storage_path, signature_mime_type FROM service_order_reception_acts WHERE service_order_id = $1 LIMIT 1`,
      [id]
    );

    const act = result.rows[0];
    if (!act) return res.status(404).json({ success: false, message: 'Acta no encontrada' });

    const absolutePath = path.resolve(SERVICE_EVIDENCE_DIR, act.signature_storage_path);
    if (!absolutePath.startsWith(`${SERVICE_EVIDENCE_DIR}${path.sep}`) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'Firma no disponible' });
    }

    res.setHeader('Content-Type', act.signature_mime_type || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    console.error('Error reading reception signature:', error);
    return res.status(500).json({ success: false, message: 'Error al abrir la firma' });
  } finally {
    client.release();
  }
};

async function assertDiagnosisAccess(client, req, orderId, { write = false } = {}) {
  const access = await getOrderForEvidence(client, req, orderId, { write });
  if (!access.ok) return access;

  if (write) {
    if (!['en_ejecucion', 'en_espera'].includes(access.order.estado)) {
      return { ok: false, status: 409, message: 'El diagnóstico solo puede editarse durante la ejecución del servicio' };
    }

    const hasCustody = await assertTechnicianCustody(client, orderId, req.user.id);
    if (!hasCustody) {
      return { ok: false, status: 409, message: 'Debes mantener la custodia del equipo para registrar el diagnóstico' };
    }
  }

  return access;
}

exports.getServiceDiagnosis = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const access = await assertDiagnosisAccess(client, req, id, { write: false });
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const result = await client.query(
      `SELECT * FROM service_order_diagnostics WHERE service_order_id = $1 LIMIT 1`,
      [id]
    );

    const evidenceCount = await client.query(
      `SELECT COUNT(*)::int AS total FROM service_order_evidences WHERE service_order_id = $1 AND stage = 'diagnosis' AND deleted_at IS NULL`,
      [id]
    );

    return res.json({
      success: true,
      data: result.rows[0] || null,
      diagnosis_evidence_count: evidenceCount.rows[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error loading diagnosis:', error);
    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }
    return res.status(500).json({ success: false, message: 'Error al cargar diagnóstico' });
  } finally {
    client.release();
  }
};

exports.saveServiceDiagnosis = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const access = await assertDiagnosisAccess(client, req, id, { write: true });
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const workType = cleanText(req.body?.work_type, 40) || 'diagnostico';
    if (!DIAGNOSIS_WORK_TYPES.has(workType)) {
      return res.status(400).json({ success: false, message: 'Tipo de trabajo no válido' });
    }

    const existing = await client.query(
      `SELECT id, status FROM service_order_diagnostics WHERE service_order_id = $1 LIMIT 1`,
      [id]
    );

    if (existing.rows[0]?.status === 'confirmed') {
      return res.status(409).json({ success: false, message: 'El diagnóstico ya fue confirmado y quedó bloqueado' });
    }

    const rawCost = req.body?.approximate_cost;
    const approximateCost = rawCost === '' || rawCost === null || rawCost === undefined
      ? null
      : Number(rawCost);

    if (approximateCost !== null && (!Number.isFinite(approximateCost) || approximateCost < 0)) {
      return res.status(400).json({ success: false, message: 'Costo aproximado no válido' });
    }

    const resultStatus = cleanText(req.body?.result_status, 30);
    if (resultStatus && !['positivo', 'negativo'].includes(resultStatus)) {
      return res.status(400).json({ success: false, message: 'Resultado no válido' });
    }

    const diagnosisId = existing.rows[0]?.id || randomUUID();

    const result = await client.query(
      `
        INSERT INTO service_order_diagnostics (
          id, service_order_id, technician_id, status, work_type,
          result_status, description, solution_available, approximate_cost,
          required_components, functional_result, activities_performed,
          created_at, updated_at
        )
        VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
        ON CONFLICT (service_order_id)
        DO UPDATE SET
          technician_id = EXCLUDED.technician_id,
          work_type = EXCLUDED.work_type,
          result_status = EXCLUDED.result_status,
          description = EXCLUDED.description,
          solution_available = EXCLUDED.solution_available,
          approximate_cost = EXCLUDED.approximate_cost,
          required_components = EXCLUDED.required_components,
          functional_result = EXCLUDED.functional_result,
          activities_performed = EXCLUDED.activities_performed,
          updated_at = NOW()
        RETURNING *
      `,
      [
        diagnosisId,
        id,
        req.user.id,
        workType,
        resultStatus,
        cleanText(req.body?.description, 8000),
        req.body?.solution_available === null || req.body?.solution_available === undefined
          ? null
          : Boolean(req.body.solution_available),
        approximateCost,
        cleanText(req.body?.required_components, 5000),
        cleanText(req.body?.functional_result, 5000),
        cleanText(req.body?.activities_performed, 8000),
      ]
    );

    return res.json({ success: true, message: 'Diagnóstico guardado como borrador', data: result.rows[0] });
  } catch (error) {
    console.error('Error saving diagnosis:', error);
    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }
    return res.status(500).json({ success: false, message: 'Error al guardar diagnóstico' });
  } finally {
    client.release();
  }
};

exports.confirmServiceDiagnosis = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const access = await assertDiagnosisAccess(client, req, id, { write: true });
    if (!access.ok) {
      await safeRollback(client);
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const diagnosisResult = await client.query(
      `SELECT * FROM service_order_diagnostics WHERE service_order_id = $1 FOR UPDATE`,
      [id]
    );

    const diagnosis = diagnosisResult.rows[0];
    if (!diagnosis) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: 'Primero guarda el diagnóstico' });
    }

    if (diagnosis.status === 'confirmed') {
      await safeRollback(client);
      return res.json({ success: true, message: 'El diagnóstico ya estaba confirmado', data: diagnosis });
    }

    if (diagnosis.work_type === 'diagnostico') {
      if (!diagnosis.description || !['positivo', 'negativo'].includes(diagnosis.result_status)) {
        await safeRollback(client);
        return res.status(400).json({ success: false, message: 'Indica el resultado positivo/negativo y describe el diagnóstico' });
      }

      if (diagnosis.solution_available === true && (diagnosis.approximate_cost === null || !diagnosis.required_components)) {
        await safeRollback(client);
        return res.status(400).json({ success: false, message: 'Si existe solución, registra costo aproximado y componentes requeridos' });
      }
    } else if (diagnosis.work_type === 'servicio_especifico') {
      if (!diagnosis.description || !diagnosis.functional_result) {
        await safeRollback(client);
        return res.status(400).json({ success: false, message: 'Describe el servicio realizado y el funcionamiento obtenido' });
      }
    }

    const evidenceCount = await client.query(
      `SELECT COUNT(*)::int AS total FROM service_order_evidences WHERE service_order_id = $1 AND stage = 'diagnosis' AND deleted_at IS NULL`,
      [id]
    );

    if ((evidenceCount.rows[0]?.total || 0) < 1) {
      await safeRollback(client);
      return res.status(409).json({ success: false, code: 'DIAGNOSIS_EVIDENCE_REQUIRED', message: 'Carga al menos una evidencia fotográfica del diagnóstico o funcionamiento' });
    }

    const result = await client.query(
      `UPDATE service_order_diagnostics SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [diagnosis.id]
    );

    await client.query('COMMIT');

    return res.json({ success: true, message: 'Diagnóstico confirmado y bloqueado', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error confirming diagnosis:', error);
    if (error?.code === '42P01') {
      return res.status(409).json({ success: false, code: 'V7_TABLES_NOT_INSTALLED', message: 'Falta instalar el SQL V7' });
    }
    return res.status(500).json({ success: false, message: 'Error al confirmar diagnóstico' });
  } finally {
    client.release();
  }
};
