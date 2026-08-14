'use strict';

// backend/src/controllers/service-order.controller.js

const pool = require('../db/pool');

const {
  SERVICE_ORDER_STATES,
  canTransition,
  isValidState,
  isTerminalState,
} = require('../domain/service-order-lifecycle');

// ============================================================
// CONFIGURACIÓN / HELPERS
// ============================================================

const MAX_PAGE_SIZE = 100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function parsePositiveInt(
  value,
  fallback,
  max = Number.MAX_SAFE_INTEGER
) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function getUserRole(req) {
  return req.user?.role?.name || req.user?.rol || null;
}

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {
    // No ocultar el error original si el rollback falla.
  }
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

    const limit = parsePositiveInt(
      req.query.limit,
      20,
      MAX_PAGE_SIZE
    );

    const offset = (page - 1) * limit;

    const userId = req.user?.id;
    const userRole = getUserRole(req);

    // --------------------------------------------------------
    // Validaciones
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Construcción dinámica del WHERE
    // --------------------------------------------------------

    const whereClauses = [];
    const params = [];

    let paramIndex = 1;

    if (estado) {
      whereClauses.push(
        `so.estado = $${paramIndex++}`
      );

      params.push(estado);
    }

    if (tecnico_id) {
      whereClauses.push(
        `so.tecnico_id = $${paramIndex++}`
      );

      params.push(tecnico_id);
    }

    if (fecha_inicio) {
      whereClauses.push(
        `so.fecha_agendada >= $${paramIndex++}::date`
      );

      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClauses.push(
        `
        so.fecha_agendada <
        ($${paramIndex++}::date + INTERVAL '1 day')
        `
      );

      params.push(fecha_fin);
    }

    // --------------------------------------------------------
    // Búsqueda
    // --------------------------------------------------------

    const cleanSearch =
      typeof search === 'string'
        ? search.trim().slice(0, 120)
        : '';

    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`;

      whereClauses.push(`
        (
          so.codigo_os ILIKE $${paramIndex}

          OR COALESCE(
            c.razon_social,
            ''
          ) ILIKE $${paramIndex}

          OR CONCAT_WS(
            ' ',
            NULLIF(c.primer_nombre, ''),
            NULLIF(c.primer_apellido, '')
          ) ILIKE $${paramIndex}
        )
      `);

      params.push(pattern);

      paramIndex++;
    }

    // --------------------------------------------------------
    // Seguridad:
    // Un técnico solo ve sus propias órdenes
    // --------------------------------------------------------

    if (userRole === 'tecnico') {
      whereClauses.push(
        `so.tecnico_id = $${paramIndex++}`
      );

      params.push(userId);
    }

    const whereSql =
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';

    // --------------------------------------------------------
    // Paginación
    // --------------------------------------------------------

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const dataParams = [
      ...params,
      limit,
      offset,
    ];

    // --------------------------------------------------------
    // Consulta principal
    // --------------------------------------------------------

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

      LEFT JOIN clients c
        ON so.client_id = c.id

      LEFT JOIN usuarios u
        ON so.tecnico_id = u.id

      ${whereSql}

      ORDER BY so."createdAt" DESC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    // --------------------------------------------------------
    // Contador
    // --------------------------------------------------------

    const countQuery = `
      SELECT
        COUNT(*)::int AS total

      FROM service_orders so

      LEFT JOIN clients c
        ON so.client_id = c.id

      ${whereSql}
    `;

    const [
      result,
      countResult,
    ] = await Promise.all([
      pool.query(
        query,
        dataParams
      ),

      pool.query(
        countQuery,
        params
      ),
    ]);

    const total =
      countResult.rows[0]?.total || 0;

    return res.json({
      data: result.rows,

      pagination: {
        page,
        limit,
        total,

        pages:
          Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error(
      'Error listing service orders:',
      error
    );

    return res.status(500).json({
      message:
        'Error al listar órdenes de servicio',
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

    // Un técnico únicamente puede ver sus propias OS
    if (userRole === 'tecnico') {
      params.push(userId);

      ownershipSql =
        `AND so.tecnico_id = $2`;
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

      LEFT JOIN clients c
        ON so.client_id = c.id

      LEFT JOIN usuarios u
        ON so.tecnico_id = u.id

      WHERE so.id = $1

      ${ownershipSql}
    `;

    const osResult =
      await pool.query(
        osQuery,
        params
      );

    if (osResult.rows.length === 0) {
      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    // --------------------------------------------------------
    // Servicios asociados
    // --------------------------------------------------------

    const serviciosResult =
      await pool.query(
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

      servicios:
        serviciosResult.rows,
    });

  } catch (error) {
    console.error(
      'Error getting service order:',
      error
    );

    return res.status(500).json({
      message:
        'Error al obtener la orden de servicio',
    });
  }
};

// ============================================================
// APROBAR ORDEN
// ============================================================

exports.aprobar = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } = req.params;

    const {
      observaciones,
    } = req.body || {};

    const userId =
      req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    if (!userId) {
      return res.status(401).json({
        message:
          'Usuario no autenticado',
      });
    }

    await client.query('BEGIN');

    // Bloqueo pesimista para impedir condiciones de carrera
    const currentResult =
      await client.query(
        `
        SELECT
          id,
          codigo_os,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden no encontrada',
      });
    }

    const order =
      currentResult.rows[0];

    // Solo permite transición válida
    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.APROBADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede aprobar una orden ` +
          `que está en estado "${order.estado}"`,

        estado_actual:
          order.estado,
      });
    }

    const cleanObservaciones =
      typeof observaciones === 'string'
        ? observaciones.trim()
        : '';

    const result =
      await client.query(
        `
        UPDATE service_orders

        SET
          estado = $1,

          aprobado_por = $2,

          fecha_aprobacion = NOW(),

          observaciones =
            COALESCE(
              $3,
              observaciones
            ),

          "updatedAt" = NOW()

        WHERE id = $4

        RETURNING *
        `,
        [
          SERVICE_ORDER_STATES.APROBADO,

          userId,

          cleanObservaciones || null,

          id,
        ]
      );

    await client.query(
      'COMMIT'
    );

    return res.json(
      result.rows[0]
    );

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error aprobando servicio:',
      error
    );

    return res.status(500).json({
      message:
        'Error al aprobar el servicio',
    });

  } finally {
    client.release();
  }
};

// Compatibilidad con rutas antiguas
exports.approve =
  exports.aprobar;

// ============================================================
// RECHAZAR ORDEN
// ============================================================

exports.rechazar = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } = req.params;

    const {
      motivo,
    } = req.body || {};

    const userId =
      req.user?.id;

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    if (!userId) {
      return res.status(401).json({
        message:
          'Usuario no autenticado',
      });
    }

    const cleanMotivo =
      typeof motivo === 'string'
        ? motivo.trim()
        : '';

    if (!cleanMotivo) {
      return res.status(400).json({
        message:
          'Debe especificar el motivo del rechazo',
      });
    }

    await client.query(
      'BEGIN'
    );

    const currentResult =
      await client.query(
        `
        SELECT
          id,
          codigo_os,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden no encontrada',
      });
    }

    const order =
      currentResult.rows[0];

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.RECHAZADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede rechazar una orden ` +
          `que está en estado "${order.estado}"`,

        estado_actual:
          order.estado,
      });
    }

    const result =
      await client.query(
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

    await client.query(
      'COMMIT'
    );

    return res.json(
      result.rows[0]
    );

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error rechazando servicio:',
      error
    );

    return res.status(500).json({
      message:
        'Error al rechazar el servicio',
    });

  } finally {
    client.release();
  }
};

// Compatibilidad con rutas antiguas
exports.reject =
  exports.rechazar;

// ============================================================
// CREAR ORDEN DE SERVICIO
// ============================================================

exports.create = async (req, res) => {
  const client =
    await pool.connect();

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

    const userId =
      req.user?.id;

    // --------------------------------------------------------
    // Validar cliente
    // --------------------------------------------------------

    if (
      !client_id ||
      !isUuid(client_id)
    ) {
      return res.status(400).json({
        message:
          'El cliente es requerido y debe ser válido',
      });
    }

    // Debe coincidir con enum_service_orders_origen_tipo
    const validOrigins = [
      'venta',
      'tecnico',
      'otro',
    ];

    if (
      !validOrigins.includes(
        origen_tipo
      )
    ) {
      return res.status(400).json({
        message:
          'origen_tipo no válido',
      });
    }

    if (
      origen_id &&
      !isUuid(origen_id)
    ) {
      return res.status(400).json({
        message:
          'origen_id no es válido',
      });
    }

    // --------------------------------------------------------
    // No permitir asignar técnico durante creación
    // --------------------------------------------------------

    if (
      programacion?.tecnico_id
    ) {
      return res.status(400).json({
        message:
          'La orden debe crearse pendiente. ' +
          'Primero apruébela y luego asigne el técnico.',
      });
    }

    if (
      !Array.isArray(servicios)
    ) {
      return res.status(400).json({
        message:
          'servicios debe ser un arreglo',
      });
    }

    await client.query('BEGIN');

    // --------------------------------------------------------
    // Validar que cliente exista
    // --------------------------------------------------------

    const clientCheck =
      await client.query(
        `
        SELECT id
        FROM clients
        WHERE id = $1
        `,
        [client_id]
      );

    if (
      clientCheck.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'Cliente no encontrado',
      });
    }

    // --------------------------------------------------------
    // Generar consecutivo
    // --------------------------------------------------------

    const year =
      new Date().getFullYear();

    /*
     * Bloqueo transaccional para evitar que
     * dos usuarios generen el mismo consecutivo.
     */
    await client.query(
      `
      SELECT
        pg_advisory_xact_lock(
          hashtext($1)
        )
      `,
      [
        `service_order_code_${year}`,
      ]
    );

    const countResult =
      await client.query(
        `
        SELECT
          COUNT(*)::int AS count

        FROM service_orders

        WHERE
          EXTRACT(
            YEAR
            FROM "createdAt"
          ) = $1
        `,
        [year]
      );

    const nextNumber =
      (countResult.rows[0]?.count || 0) + 1;

    const codigo_os =
      `OS-${year}-${String(nextNumber).padStart(
        4,
        '0'
      )}`;

    // --------------------------------------------------------
    // Crear OS
    //
    // IMPORTANTE:
    // actualmente NO usamos prioridad ni notas_internas,
    // porque esas columnas aún no existen en la BD actual.
    // --------------------------------------------------------

    const result =
      await client.query(
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
          $1,
          $2,
          $3,
          $4,
          $5,
          NULL,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          NOW(),
          NOW()
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

          parsePositiveInt(
            programacion?.duracion_estimada,
            60,
            24 * 60
          ),

          typeof notas?.observaciones_tecnico === 'string'
            ? notas.observaciones_tecnico.trim() || null
            : null,

          SERVICE_ORDER_STATES.PENDIENTE,

          userId || null,
        ]
      );

    const order =
      result.rows[0];

    // --------------------------------------------------------
    // Servicios asociados
    // --------------------------------------------------------

    for (
      const servicio
      of servicios
    ) {
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          NOW(),
          NOW()
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

          Boolean(
            servicio?.requiere_diagnostico
          ),

          Boolean(
            servicio?.requiere_repuestos
          ),

          servicio?.repuestos_necesarios || null,
        ]
      );
    }

    await client.query(
      'COMMIT'
    );

    return res
      .status(201)
      .json(order);

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error creating service order:',
      error
    );

    return res.status(500).json({
      message:
        'Error al crear la orden de servicio',
    });

  } finally {
    client.release();
  }
};

// ============================================================
// CAMBIAR ESTADO
// ============================================================

exports.changeStatus = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } =
      req.params;

    const {
      estado,
    } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    if (
      !isValidState(estado)
    ) {
      return res.status(400).json({
        message:
          'Estado de orden no válido',
      });
    }

    await client.query(
      'BEGIN'
    );

    // --------------------------------------------------------
    // Bloquear OS mientras se procesa
    // --------------------------------------------------------

    const currentResult =
      await client.query(
        `
        SELECT
          id,
          codigo_os,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    const currentOrder =
      currentResult.rows[0];

    if (
      currentOrder.estado === estado
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          `La orden ya se encuentra ` +
          `en estado "${estado}"`,
      });
    }

    // --------------------------------------------------------
    // Máquina de estados
    // --------------------------------------------------------

    if (
      !canTransition(
        currentOrder.estado,
        estado
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `Transición no permitida: ` +
          `${currentOrder.estado} → ${estado}`,

        estado_actual:
          currentOrder.estado,

        estado_solicitado:
          estado,
      });
    }

    // --------------------------------------------------------
    // Aprobar/rechazar deben pasar por endpoints específicos
    // --------------------------------------------------------

    if (
      estado ===
        SERVICE_ORDER_STATES.APROBADO ||

      estado ===
        SERVICE_ORDER_STATES.RECHAZADO
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'La aprobación o rechazo debe realizarse ' +
          'mediante su acción específica',
      });
    }

    // --------------------------------------------------------
    // Asignación debe registrar técnico
    // --------------------------------------------------------

    if (
      estado ===
      SERVICE_ORDER_STATES.ASIGNADA
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'Para asignar una orden debe utilizarse ' +
          'la función de asignación de técnico',
      });
    }

    // --------------------------------------------------------
    // Cambiar estado
    // --------------------------------------------------------

    const result =
      await client.query(
        `
        UPDATE service_orders

        SET
          estado = $1,

          fecha_inicio =
            CASE
              WHEN $1::text = 'en_ejecucion'
                THEN COALESCE(
                  fecha_inicio,
                  NOW()
                )

              ELSE fecha_inicio
            END,

          fecha_fin =
            CASE
              WHEN $1::text = 'cerrada'
                THEN NOW()

              ELSE fecha_fin
            END,

          "updatedAt" = NOW()

        WHERE id = $2

        RETURNING *
        `,
        [
          estado,
          id,
        ]
      );

    await client.query(
      'COMMIT'
    );

    return res.json(
      result.rows[0]
    );

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error changing service order status:',
      error
    );

    return res.status(500).json({
      message:
        'Error al cambiar el estado de la orden',
    });

  } finally {
    client.release();
  }
};

// ============================================================
// ASIGNAR TÉCNICO
// ============================================================

exports.assignTech = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } =
      req.params;

    const {
      tecnico_id,
    } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    if (
      !tecnico_id ||
      !isUuid(tecnico_id)
    ) {
      return res.status(400).json({
        message:
          'El técnico es requerido y debe ser válido',
      });
    }

    await client.query(
      'BEGIN'
    );

    // --------------------------------------------------------
    // Validar usuario técnico
    // Compatible con rol antiguo y nuevo sistema Role
    // --------------------------------------------------------

    const techResult =
      await client.query(
        `
        SELECT
          u.id,
          u.activo,
          u.rol,
          r.name AS role_name

        FROM usuarios u

        LEFT JOIN roles r
          ON r.id = u.role_id

        WHERE u.id = $1

        FOR SHARE OF u
        `,
        [tecnico_id]
      );

    if (
      techResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Técnico no encontrado',
      });
    }

    const tech =
      techResult.rows[0];

    if (!tech.activo) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'El técnico seleccionado está inactivo',
      });
    }

    const effectiveRole =
      tech.role_name ||
      tech.rol;

    if (
      effectiveRole !== 'tecnico'
    ) {
      await safeRollback(client);

      return res.status(400).json({
        message:
          'El usuario seleccionado no tiene rol de técnico',
      });
    }

    // --------------------------------------------------------
    // Obtener OS con bloqueo
    // --------------------------------------------------------

    const currentResult =
      await client.query(
        `
        SELECT
          id,
          codigo_os,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    const order =
      currentResult.rows[0];

    // Solo aprobado -> asignada
    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.ASIGNADA
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede asignar técnico cuando ` +
          `la orden está en estado "${order.estado}"`,

        estado_actual:
          order.estado,
      });
    }

    // --------------------------------------------------------
    // Asignación
    // --------------------------------------------------------

    const result =
      await client.query(
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

    await client.query(
      'COMMIT'
    );

    return res.json(
      result.rows[0]
    );

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error assigning technician:',
      error
    );

    return res.status(500).json({
      message:
        'Error al asignar técnico',
    });

  } finally {
    client.release();
  }
};

// ============================================================
// AGREGAR REPUESTO USADO
// ============================================================

exports.addPart = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } =
      req.params;

    const {
      product_id,
      cantidad,
      observaciones,
    } = req.body || {};

    const userId =
      req.user?.id;

    const qty =
      Number(cantidad);

    // --------------------------------------------------------
    // Validaciones
    // --------------------------------------------------------

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    if (
      !product_id ||
      !isUuid(product_id)
    ) {
      return res.status(400).json({
        message:
          'Producto no válido',
      });
    }

    if (
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      return res.status(400).json({
        message:
          'La cantidad debe ser un entero mayor que cero',
      });
    }

    await client.query(
      'BEGIN'
    );

    // --------------------------------------------------------
    // Validar OS
    // --------------------------------------------------------

    const orderResult =
      await client.query(
        `
        SELECT
          id,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      orderResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    // No modificar una OS terminal
    if (
      isTerminalState(
        orderResult.rows[0].estado
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'No se pueden agregar repuestos ' +
          'a una orden finalizada',
      });
    }

    // --------------------------------------------------------
    // Descontar stock de forma atómica
    // --------------------------------------------------------

    const stockResult =
      await client.query(
        `
        UPDATE products

        SET
          stock_actual =
            stock_actual - $1

        WHERE
          id = $2

          AND stock_actual >= $1

        RETURNING
          id,
          stock_actual
        `,
        [
          qty,
          product_id,
        ]
      );

    // Si no actualizó producto
    if (
      stockResult.rows.length === 0
    ) {
      const productExists =
        await client.query(
          `
          SELECT id
          FROM products
          WHERE id = $1
          `,
          [product_id]
        );

      await safeRollback(client);

      if (
        productExists.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            'Producto no encontrado',
        });
      }

      return res.status(400).json({
        message:
          'Stock insuficiente',
      });
    }

    // --------------------------------------------------------
    // Registrar movimiento
    // --------------------------------------------------------

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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW(),
        NOW(),
        NOW()
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

    await client.query(
      'COMMIT'
    );

    return res.status(201).json({
      message:
        'Repuesto agregado correctamente',

      stock_actual:
        stockResult.rows[0].stock_actual,
    });

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error adding part:',
      error
    );

    return res.status(500).json({
      message:
        'Error al agregar repuesto',
    });

  } finally {
    client.release();
  }
};

// ============================================================
// ACTUALIZAR DIAGNÓSTICO / OBSERVACIONES
// ============================================================

exports.update = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } =
      req.params;

    const {
      diagnostico_final,
      observaciones,
    } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    await client.query(
      'BEGIN'
    );

    // --------------------------------------------------------
    // Bloquear y validar OS
    // --------------------------------------------------------

    const currentResult =
      await client.query(
        `
        SELECT
          id,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    if (
      isTerminalState(
        currentResult.rows[0].estado
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          'No se puede modificar una orden ' +
          'que ya está finalizada',
      });
    }

    // --------------------------------------------------------
    // Actualizar
    // --------------------------------------------------------

    const cleanDiagnostico =
      typeof diagnostico_final === 'string'
        ? diagnostico_final.trim()
        : '';

    const cleanObservaciones =
      typeof observaciones === 'string'
        ? observaciones.trim()
        : '';

    const result =
      await client.query(
        `
        UPDATE service_orders

        SET
          diagnostico_final =
            COALESCE(
              $1,
              diagnostico_final
            ),

          observaciones =
            COALESCE(
              $2,
              observaciones
            ),

          "updatedAt" = NOW()

        WHERE id = $3

        RETURNING *
        `,
        [
          cleanDiagnostico || null,

          cleanObservaciones || null,

          id,
        ]
      );

    await client.query(
      'COMMIT'
    );

    return res.json(
      result.rows[0]
    );

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error updating service order:',
      error
    );

    return res.status(500).json({
      message:
        'Error al actualizar la orden',
    });

  } finally {
    client.release();
  }
};

// ============================================================
// ELIMINAR = CANCELAR LÓGICAMENTE
// NO HACER DELETE FÍSICO
// ============================================================

exports.delete = async (req, res) => {
  const client =
    await pool.connect();

  try {
    const { id } =
      req.params;

    if (!isUuid(id)) {
      return res.status(400).json({
        message:
          'ID de orden no válido',
      });
    }

    await client.query(
      'BEGIN'
    );

    // --------------------------------------------------------
    // Bloquear OS
    // --------------------------------------------------------

    const currentResult =
      await client.query(
        `
        SELECT
          id,
          codigo_os,
          estado

        FROM service_orders

        WHERE id = $1

        FOR UPDATE
        `,
        [id]
      );

    if (
      currentResult.rows.length === 0
    ) {
      await safeRollback(client);

      return res.status(404).json({
        message:
          'Orden de servicio no encontrada',
      });
    }

    const order =
      currentResult.rows[0];

    // Ya cancelada
    if (
      order.estado ===
      SERVICE_ORDER_STATES.CANCELADO
    ) {
      await safeRollback(client);

      return res.json({
        message:
          'La orden ya se encuentra cancelada',
      });
    }

    // --------------------------------------------------------
    // Validar transición hacia cancelado
    // --------------------------------------------------------

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.CANCELADO
      )
    ) {
      await safeRollback(client);

      return res.status(409).json({
        message:
          `No se puede cancelar una orden ` +
          `en estado "${order.estado}"`,

        estado_actual:
          order.estado,
      });
    }

    // --------------------------------------------------------
    // Cancelación lógica
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE service_orders

      SET
        estado = $1,
        "updatedAt" = NOW()

      WHERE id = $2
      `,
      [
        SERVICE_ORDER_STATES.CANCELADO,
        id,
      ]
    );

    await client.query(
      'COMMIT'
    );

    return res.json({
      message:
        'Orden cancelada correctamente. ' +
        'Se conserva el historial y no se elimina físicamente.',
    });

  } catch (error) {
    await safeRollback(client);

    console.error(
      'Error cancelling service order:',
      error
    );

    return res.status(500).json({
      message:
        'Error al cancelar la orden',
    });

  } finally {
    client.release();
  }
};