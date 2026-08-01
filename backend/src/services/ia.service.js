// backend/src/services/ia.service.js
const { Pool } = require('pg');

const OLLAMA_URL = (
  process.env.OLLAMA_URL || 'http://ollama:11434'
).replace(/\/+$/, '');

const MODEL =
  process.env.OLLAMA_MODEL || 'llama3.2:1b';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
};

const OLLAMA_TIMEOUT_MS = toPositiveInt(
  process.env.OLLAMA_TIMEOUT_MS,
  180000
);

const OLLAMA_NUM_CTX = toPositiveInt(
  process.env.OLLAMA_NUM_CTX,
  2048
);

const OLLAMA_NUM_PREDICT = toPositiveInt(
  process.env.OLLAMA_NUM_PREDICT,
  400
);

const OLLAMA_KEEP_ALIVE =
  process.env.OLLAMA_KEEP_ALIVE || '30m';

const pgPool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: toPositiveInt(process.env.DB_PORT, 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1235',
  database: process.env.DB_NAME || 'tecnicos',
  max: toPositiveInt(process.env.DB_POOL_MAX, 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================================
// OLLAMA
// ============================================================

const solicitarOllama = async (
  ruta,
  opciones = {},
  timeoutMs = OLLAMA_TIMEOUT_MS
) => {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${OLLAMA_URL}${ruta}`,
      {
        ...opciones,
        signal: controller.signal,
      }
    );

    const raw = await response.text();

    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          raw,
        };
      }
    }

    if (!response.ok) {
      const detalle =
        data?.error ||
        data?.message ||
        data?.raw ||
        `HTTP ${response.status}`;

      throw new Error(
        `Ollama respondió con error: ${detalle}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Ollama no respondió antes de ${Math.round(
          timeoutMs / 1000
        )} segundos`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const ollamaChat = async (
  messages,
  options = {}
) => {
  const data = await solicitarOllama(
    '/api/chat',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        keep_alive: OLLAMA_KEEP_ALIVE,

        options: {
          num_ctx: OLLAMA_NUM_CTX,
          num_predict: OLLAMA_NUM_PREDICT,
          temperature: 0.2,
          ...options,
        },
      }),
    }
  );

  const contenido =
    data?.message?.content?.trim();

  if (!contenido) {
    throw new Error(
      'Ollama respondió sin contenido'
    );
  }

  return contenido;
};

const verificarConexion = async () => {
  try {
    const data = await solicitarOllama(
      '/api/tags',
      {
        method: 'GET',
      },
      15000
    );

    const modelos = Array.isArray(data?.models)
      ? data.models
      : [];

    const modeloDisponible = modelos.some(
      (item) =>
        item?.name === MODEL ||
        item?.model === MODEL
    );

    if (!modeloDisponible) {
      return {
        success: false,
        disponible: false,
        modelo: MODEL,

        error:
          `El servidor Ollama está activo, ` +
          `pero el modelo ${MODEL} no está descargado`,
      };
    }

    return {
      success: true,
      disponible: true,
      modelo: MODEL,
      message:
        `Ollama está disponible con el modelo ${MODEL}`,
    };
  } catch (error) {
    return {
      success: false,
      disponible: false,
      modelo: MODEL,
      error: error.message,
    };
  }
};

// ============================================================
// FECHA ACTUAL EN COLOMBIA
// ============================================================

const getFechaActual = () => {
  const ahora = new Date();
  const timeZone = 'America/Bogota';

  const partes = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(ahora);

  const valores = Object.fromEntries(
    partes.map((parte) => [
      parte.type,
      parte.value,
    ])
  );

  const iso =
    `${valores.year}-` +
    `${valores.month}-` +
    `${valores.day}`;

  return {
    fecha: new Intl.DateTimeFormat(
      'es-CO',
      {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
      }
    ).format(ahora),

    iso,

    hora: new Intl.DateTimeFormat(
      'es-CO',
      {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
    ).format(ahora),

    diaSemana: new Intl.DateTimeFormat(
      'es-CO',
      {
        timeZone,
        weekday: 'long',
      }
    ).format(ahora),
  };
};

// ============================================================
// SISTEMA DE BOTS POR ROL
// ============================================================

const getBotConfig = (rol) => {
  const bots = {
    admin: {
      nombre: 'Administrador',

      descripcion:
        'Visión general del sistema, estadísticas y gestión de usuarios',

      prompt: `
        Eres el asistente del Administrador del sistema.

        Puedes ayudar con estadísticas generales, usuarios,
        rendimiento global, servicios, productos, clientes,
        facturación, alquileres e inventario.

        Responde de forma profesional y ejecutiva.
      `,
    },

    tecnico: {
      nombre: 'Técnico',

      descripcion:
        'Servicios asignados, diagnósticos, equipos y repuestos',

      prompt: `
        Eres el asistente de un Técnico de servicio.

        Ayuda con servicios asignados, equipos, diagnósticos,
        repuestos, órdenes pendientes, visitas técnicas
        y estado de equipos.

        Responde de forma práctica y operativa.
        Prioriza la información de los servicios
        asignados al técnico.
      `,
    },

    ventas: {
      nombre: 'Ventas',

      descripcion:
        'Cotizaciones, clientes, pedidos y seguimiento',

      prompt: `
        Eres el asistente del área de Ventas.

        Ayuda con cotizaciones, clientes, pedidos,
        seguimiento comercial, productos, precios
        y disponibilidad.

        Responde de forma comercial y proactiva.
      `,
    },

    cartera: {
      nombre: 'Cartera',

      descripcion:
        'Facturas, pagos, clientes morosos y cobros',

      prompt: `
        Eres el asistente del área de Cartera.

        Ayuda con facturas vencidas, clientes morosos,
        pagos pendientes, acuerdos de pago
        y cartera por antigüedad.

        Responde de forma financiera y estratégica.
      `,
    },

    jefe_tecnicos: {
      nombre: 'Jefe de Técnicos',

      descripcion:
        'Carga de trabajo, rendimiento, asignaciones y productividad',

      prompt: `
        Eres el asistente del Jefe de Técnicos.

        Ayuda con carga de trabajo, rendimiento,
        asignaciones, productividad, tiempos de atención
        y órdenes retrasadas.

        Responde de forma gerencial y analítica.
      `,
    },

    garantias: {
      nombre: 'Garantías',

      descripcion:
        'Casos de garantía, seguimiento, proveedores y devoluciones',

      prompt: `
        Eres el asistente del área de Garantías.

        Ayuda con garantías ingresadas, casos pendientes,
        proveedores, devoluciones y productos defectuosos.

        Responde de forma detallada
        y orientada al seguimiento.
      `,
    },
  };

  return bots[rol] || bots.admin;
};

// ============================================================
// FUNCIONES DE CONSULTA POR ROL
// ============================================================

const getServiciosTecnico = async (
  tecnicoId
) => {
  if (!tecnicoId) {
    return [];
  }

  try {
    const result = await pgPool.query(
      `
        SELECT
          s.codigo_os,
          s.estado,
          s.descripcion_inicial,
          s.fecha_agendada,
          s.hora_inicio_agendada,
          s.duracion_estimada,
          c.razon_social AS cliente_nombre,
          c.documento AS cliente_documento,
          s.created_at
        FROM service_orders s
        LEFT JOIN clients c
          ON s.client_id = c.id
        WHERE s.tecnico_id = $1
        ORDER BY
          s.fecha_agendada ASC NULLS LAST
      `,
      [tecnicoId]
    );

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getServiciosTecnico:',
      error.message
    );

    return [];
  }
};

const getServiciosHoyTecnico = async (
  tecnicoId
) => {
  if (!tecnicoId) {
    return [];
  }

  try {
    const result = await pgPool.query(
      `
        SELECT
          s.codigo_os,
          s.estado,
          s.descripcion_inicial,
          s.fecha_agendada,
          s.hora_inicio_agendada,
          s.duracion_estimada,
          c.razon_social AS cliente_nombre,
          c.documento AS cliente_documento
        FROM service_orders s
        LEFT JOIN clients c
          ON s.client_id = c.id
        WHERE s.tecnico_id = $1
          AND DATE(s.fecha_agendada) = $2
        ORDER BY
          s.hora_inicio_agendada ASC
      `,
      [
        tecnicoId,
        getFechaActual().iso,
      ]
    );

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getServiciosHoyTecnico:',
      error.message
    );

    return [];
  }
};

const getResumenTecnico = async (
  tecnicoId
) => {
  if (!tecnicoId) {
    return null;
  }

  try {
    const result = await pgPool.query(
      `
        SELECT
          COUNT(*) AS total,

          COUNT(
            CASE
              WHEN estado = 'pendiente'
              THEN 1
            END
          ) AS pendientes,

          COUNT(
            CASE
              WHEN estado = 'asignada'
              THEN 1
            END
          ) AS asignados,

          COUNT(
            CASE
              WHEN estado = 'en_ejecucion'
              THEN 1
            END
          ) AS en_ejecucion,

          COUNT(
            CASE
              WHEN estado = 'cerrada'
              THEN 1
            END
          ) AS completados,

          COUNT(
            CASE
              WHEN DATE(fecha_agendada) = CURRENT_DATE
              THEN 1
            END
          ) AS hoy

        FROM service_orders
        WHERE tecnico_id = $1
      `,
      [tecnicoId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      'Error en getResumenTecnico:',
      error.message
    );

    return null;
  }
};

const getTecnicosDisponibles = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        id,
        nombre1,
        apellidos,
        usuario,
        celular,
        email,
        activo
      FROM usuarios
      WHERE rol = 'tecnico'
      ORDER BY nombre1 ASC
    `);

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getTecnicosDisponibles:',
      error.message
    );

    return [];
  }
};

const getCargaTecnicos = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        u.id,
        u.nombre1,
        u.apellidos,

        COUNT(s.id)
          AS total_servicios,

        COUNT(
          CASE
            WHEN s.estado = 'pendiente'
            THEN 1
          END
        ) AS pendientes,

        COUNT(
          CASE
            WHEN s.estado = 'asignada'
            THEN 1
          END
        ) AS asignados,

        COUNT(
          CASE
            WHEN s.estado = 'en_ejecucion'
            THEN 1
          END
        ) AS en_ejecucion,

        COUNT(
          CASE
            WHEN s.estado = 'cerrada'
            THEN 1
          END
        ) AS completados

      FROM usuarios u

      LEFT JOIN service_orders s
        ON u.id = s.tecnico_id

      WHERE u.rol = 'tecnico'

      GROUP BY
        u.id,
        u.nombre1,
        u.apellidos

      ORDER BY
        total_servicios DESC
    `);

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getCargaTecnicos:',
      error.message
    );

    return [];
  }
};

const getServiciosByEstado = async (
  estado
) => {
  if (!estado) {
    return [];
  }

  try {
    const result = await pgPool.query(
      `
        SELECT
          s.codigo_os,
          s.estado,
          s.descripcion_inicial,
          s.fecha_agendada,
          c.razon_social AS cliente_nombre,
          u.usuario AS tecnico_nombre,
          s.created_at

        FROM service_orders s

        LEFT JOIN clients c
          ON s.client_id = c.id

        LEFT JOIN usuarios u
          ON s.tecnico_id = u.id

        WHERE s.estado = $1

        ORDER BY
          s.fecha_agendada ASC NULLS LAST

        LIMIT 30
      `,
      [estado]
    );

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getServiciosByEstado:',
      error.message
    );

    return [];
  }
};

const getCotizacionesPendientes = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        id,
        numero_solicitud,
        cliente_nombre,
        fecha_creacion,
        estado

      FROM solicitudes_alquiler

      WHERE estado = 'pendiente'

      ORDER BY
        fecha_creacion ASC

      LIMIT 20
    `);

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getCotizacionesPendientes:',
      error.message
    );

    return [];
  }
};

const getFacturasVencidas = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        numero_factura,
        cliente_nombre,
        total_general,
        fecha_emision,
        estado

      FROM invoices

      WHERE estado = 'emitida'
        AND fecha_emision
          < NOW() - INTERVAL '30 days'

      ORDER BY
        fecha_emision ASC

      LIMIT 20
    `);

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getFacturasVencidas:',
      error.message
    );

    return [];
  }
};

const getGarantiasPendientes = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        id,
        numero_solicitud,
        cliente_nombre,
        fecha_creacion,
        estado

      FROM solicitudes_alquiler

      WHERE estado = 'pendiente'
        AND tipo = 'garantia'

      ORDER BY
        fecha_creacion ASC

      LIMIT 20
    `);

    return result.rows;
  } catch (error) {
    console.error(
      'Error en getGarantiasPendientes:',
      error.message
    );

    return [];
  }
};

const getEstadisticasGenerales = async () => {
  try {
    const result = await pgPool.query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM service_orders
        ) AS total_servicios,

        (
          SELECT COUNT(*)
          FROM service_orders
          WHERE estado = 'pendiente'
        ) AS pendientes,

        (
          SELECT COUNT(*)
          FROM service_orders
          WHERE estado = 'asignada'
        ) AS asignados,

        (
          SELECT COUNT(*)
          FROM service_orders
          WHERE estado = 'en_ejecucion'
        ) AS en_ejecucion,

        (
          SELECT COUNT(*)
          FROM service_orders
          WHERE estado = 'cerrada'
        ) AS completados,

        (
          SELECT COUNT(*)
          FROM usuarios
          WHERE rol = 'tecnico'
            AND activo = true
        ) AS tecnicos_activos,

        (
          SELECT COUNT(*)
          FROM sync_clientes
          WHERE activo = true
        ) AS clientes_activos,

        (
          SELECT COUNT(*)
          FROM products
          WHERE estado = true
        ) AS productos_activos,

        (
          SELECT COUNT(*)
          FROM invoices
          WHERE estado = 'emitida'
        ) AS facturas_pendientes,

        (
          SELECT COUNT(*)
          FROM solicitudes_alquiler
          WHERE estado = 'pendiente'
        ) AS solicitudes_pendientes
    `);

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      'Error en getEstadisticasGenerales:',
      error.message
    );

    return null;
  }
};

// ============================================================
// MAPA Y EJECUCIÓN DE TOOLS
// ============================================================

const tools = {
  getServiciosTecnico,
  getServiciosHoyTecnico,
  getResumenTecnico,
  getTecnicosDisponibles,
  getCargaTecnicos,
  getServiciosByEstado,
  getCotizacionesPendientes,
  getFacturasVencidas,
  getGarantiasPendientes,
  getEstadisticasGenerales,
};

const ejecutarTool = async (
  nombre,
  params = {}
) => {
  switch (nombre) {
    case 'getServiciosTecnico':
      return getServiciosTecnico(
        params.tecnico_id
      );

    case 'getServiciosHoyTecnico':
      return getServiciosHoyTecnico(
        params.tecnico_id
      );

    case 'getResumenTecnico':
      return getResumenTecnico(
        params.tecnico_id
      );

    case 'getServiciosByEstado':
      return getServiciosByEstado(
        params.estado
      );

    case 'getTecnicosDisponibles':
    case 'getCargaTecnicos':
    case 'getCotizacionesPendientes':
    case 'getFacturasVencidas':
    case 'getGarantiasPendientes':
    case 'getEstadisticasGenerales':
      return tools[nombre]();

    default:
      return null;
  }
};

// ============================================================
// DETECCIÓN DE INTENCIÓN POR ROL
// ============================================================

const normalizarTexto = (texto = '') => {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const contieneAlguno = (
  texto,
  palabras
) => {
  return palabras.some((palabra) =>
    texto.includes(palabra)
  );
};

const detectarIntencion = (
  mensaje,
  rol
) => {
  const msg = normalizarTexto(mensaje);

  // ADMINISTRADOR
  if (rol === 'admin') {
    if (
      contieneAlguno(msg, [
        'estadistica',
        'general',
        'resumen ejecutivo',
      ])
    ) {
      return {
        tool: 'getEstadisticasGenerales',
        params: {},
      };
    }

    if (
      msg.includes('tecnico') &&
      contieneAlguno(msg, [
        'carga',
        'trabajo',
        'ocupado',
      ])
    ) {
      return {
        tool: 'getCargaTecnicos',
        params: {},
      };
    }

    if (
      msg.includes('tecnico') &&
      contieneAlguno(msg, [
        'disponible',
        'libre',
        'activo',
      ])
    ) {
      return {
        tool: 'getTecnicosDisponibles',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'pendiente',
        'por atender',
      ])
    ) {
      return {
        tool: 'getServiciosByEstado',

        params: {
          estado: 'pendiente',
        },
      };
    }
  }

  // TÉCNICO
  if (rol === 'tecnico') {
    if (
      msg.includes('hoy') &&
      contieneAlguno(msg, [
        'servicio',
        'os',
        'orden',
      ])
    ) {
      return {
        tool: 'getServiciosHoyTecnico',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'resumen',
        'estadistica',
        'cuantos',
      ])
    ) {
      return {
        tool: 'getResumenTecnico',
        params: {},
      };
    }

    if (
      msg.includes('todos') &&
      contieneAlguno(msg, [
        'servicio',
        'os',
        'orden',
      ])
    ) {
      return {
        tool: 'getServiciosTecnico',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'pendiente',
        'por hacer',
      ])
    ) {
      return {
        tool: 'getServiciosTecnico',
        params: {},
      };
    }
  }

  // VENTAS
  if (rol === 'ventas') {
    if (msg.includes('cotizacion')) {
      return {
        tool: 'getCotizacionesPendientes',
        params: {},
      };
    }

    if (
      msg.includes('cliente') &&
      contieneAlguno(msg, [
        'contactar',
        'llamar',
        'seguimiento',
      ])
    ) {
      return {
        tool: 'getCotizacionesPendientes',
        params: {},
      };
    }

    if (
      msg.includes('pedido') &&
      contieneAlguno(msg, [
        'pendiente',
        'retraso',
      ])
    ) {
      return {
        tool: 'getServiciosByEstado',

        params: {
          estado: 'pendiente',
        },
      };
    }
  }

  // CARTERA
  if (rol === 'cartera') {
    if (
      msg.includes('factura') &&
      contieneAlguno(msg, [
        'vencida',
        'vencer',
        'pendiente',
      ])
    ) {
      return {
        tool: 'getFacturasVencidas',
        params: {},
      };
    }

    if (
      msg.includes('pago') &&
      contieneAlguno(msg, [
        'pendiente',
        'moroso',
        'deuda',
      ])
    ) {
      return {
        tool: 'getFacturasVencidas',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'cartera',
        'cobro',
      ])
    ) {
      return {
        tool: 'getFacturasVencidas',
        params: {},
      };
    }
  }

  // JEFE DE TÉCNICOS
  if (rol === 'jefe_tecnicos') {
    if (
      msg.includes('carga') &&
      msg.includes('tecnico')
    ) {
      return {
        tool: 'getCargaTecnicos',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'rendimiento',
        'productividad',
      ])
    ) {
      return {
        tool: 'getCargaTecnicos',
        params: {},
      };
    }

    if (
      msg.includes('disponible') &&
      msg.includes('tecnico')
    ) {
      return {
        tool: 'getTecnicosDisponibles',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'retraso',
        'demora',
      ])
    ) {
      return {
        tool: 'getServiciosByEstado',

        params: {
          estado: 'pendiente',
        },
      };
    }
  }

  // GARANTÍAS
  if (rol === 'garantias') {
    if (
      msg.includes('garantia') &&
      contieneAlguno(msg, [
        'pendiente',
        'ingresada',
      ])
    ) {
      return {
        tool: 'getGarantiasPendientes',
        params: {},
      };
    }

    if (
      contieneAlguno(msg, [
        'proveedor',
        'fabricante',
        'devolucion',
        'rechazado',
      ])
    ) {
      return {
        tool: 'getGarantiasPendientes',
        params: {},
      };
    }
  }

  return {
    tool: null,
    params: {},
  };
};

// ============================================================
// GESTIÓN DE SESIONES
// ============================================================

const sesiones = new Map();

const getSesion = (userId) => {
  const clave = String(
    userId || 'anonimo'
  );

  if (!sesiones.has(clave)) {
    sesiones.set(clave, {
      historial: [],

      contexto: {
        rol: '',
        nombre: '',
      },

      ultimaActividad: Date.now(),
    });
  }

  return sesiones.get(clave);
};

const limpiarSesion = (userId) => {
  const clave = String(
    userId || 'anonimo'
  );

  sesiones.delete(clave);

  return {
    success: true,
  };
};

// ============================================================
// CHAT PRINCIPAL CON BOT POR ROL
// ============================================================

const chatConModo = async (
  userId,
  mensaje,
  modo = 'asistente',
  rol = 'usuario',
  tecnicoId = null
) => {
  try {
    if (
      !mensaje ||
      !String(mensaje).trim()
    ) {
      return {
        success: false,
        message: 'El mensaje es obligatorio',
        error: 'El mensaje es obligatorio',
      };
    }

    const rolNormalizado =
      normalizarTexto(rol)
        .replace(/\s+/g, '_') ||
      'usuario';

    const modoNormalizado =
      modo === 'consulta'
        ? 'consulta'
        : 'asistente';

    const fecha = getFechaActual();

    const botConfig =
      getBotConfig(rolNormalizado);

    let promptSistema = '';
    let datos = null;
    let toolUsada = null;

    if (modoNormalizado === 'asistente') {
      const intencion = detectarIntencion(
        mensaje,
        rolNormalizado
      );

      if (
        intencion.tool &&
        tools[intencion.tool]
      ) {
        const params = {
          ...intencion.params,
        };

        if (
          rolNormalizado === 'tecnico' &&
          tecnicoId &&
          [
            'getServiciosHoyTecnico',
            'getResumenTecnico',
            'getServiciosTecnico',
          ].includes(intencion.tool)
        ) {
          params.tecnico_id = tecnicoId;
        }

        try {
          datos = await ejecutarTool(
            intencion.tool,
            params
          );

          toolUsada = intencion.tool;
        } catch (error) {
          console.error(
            `Error ejecutando la tool ${intencion.tool}:`,
            error
          );

          datos = null;
        }
      }

      promptSistema = `
        ${botConfig.prompt}

        FECHA ACTUAL: ${fecha.fecha}
        HORA ACTUAL: ${fecha.hora}
        ROL DEL USUARIO: ${rolNormalizado}
        IDENTIFICADOR DEL USUARIO: ${userId}

        REGLAS:

        1. Responde siempre en español.

        2. Usa la fecha actual como referencia.

        3. Cuando recibas datos del sistema,
        basa la respuesta exclusivamente en esos datos.

        4. No inventes servicios, clientes, facturas,
        productos, estados ni cifras internas.

        5. Si la consulta requiere información interna
        y no hay datos, indícalo claramente.

        6. Para orientación general, responde de forma
        práctica, breve y profesional.
      `;

      if (toolUsada) {
        if (
          Array.isArray(datos) &&
          datos.length === 0
        ) {
          promptSistema +=
            '\nNo se encontraron registros para la consulta realizada.';
        } else if (
          datos === null ||
          datos === undefined
        ) {
          promptSistema +=
            '\nLa consulta al sistema no devolvió información disponible.';
        } else {
          promptSistema +=
            `\n\nDATOS DEL SISTEMA:\n` +
            `${JSON.stringify(datos, null, 2)}`;
        }
      } else {
        promptSistema += `
          \nNo se ejecutó una consulta a la base de datos.

          Puedes brindar orientación general,
          pero no debes afirmar datos internos del sistema.
        `;
      }

      const sesion = getSesion(userId);

      const ultimos =
        sesion.historial.slice(-6);

      if (ultimos.length > 0) {
        promptSistema +=
          '\n\nHISTORIAL RECIENTE:';

        for (const item of ultimos) {
          promptSistema +=
            `\n[${item.role}]: ` +
            `${String(item.content).slice(0, 300)}`;
        }
      }
    } else {
      promptSistema = `
        Eres un asistente de consulta rápida.

        Responde preguntas específicas
        de forma directa, clara y concisa.

        FECHA ACTUAL: ${fecha.fecha}

        Responde siempre en español.

        No uses memoria ni afirmes
        información interna del sistema.
      `;
    }

    const respuesta = await ollamaChat([
      {
        role: 'system',
        content: promptSistema,
      },
      {
        role: 'user',
        content: String(mensaje).trim(),
      },
    ]);

    if (
      modoNormalizado === 'asistente'
    ) {
      const sesion = getSesion(userId);

      sesion.historial.push(
        {
          role: 'user',
          content: String(mensaje).trim(),
        },
        {
          role: 'assistant',
          content: respuesta,
        }
      );

      sesion.historial =
        sesion.historial.slice(-20);

      sesion.ultimaActividad =
        Date.now();
    }

    return {
      success: true,
      respuesta,
      tool: toolUsada,
      datos,
      modo: modoNormalizado,
      modelo: MODEL,
    };
  } catch (error) {
    console.error(
      'Error en chatConModo:',
      error
    );

    return {
      success: false,
      message: error.message,
      error: error.message,
    };
  }
};

// ============================================================
// GENERAR ALERTAS
// ============================================================

const generarAlertas = async (
  rol = 'usuario',
  tecnicoId = null
) => {
  try {
    const alertas = [];
    const fecha = getFechaActual();

    const rolNormalizado =
      normalizarTexto(rol)
        .replace(/\s+/g, '_');

    if (
      rolNormalizado === 'admin' ||
      rolNormalizado === 'jefe_tecnicos'
    ) {
      const stats =
        await getEstadisticasGenerales();

      if (stats) {
        alertas.push({
          tipo: 'estadisticas',

          titulo:
            `Resumen del sistema ` +
            `(${fecha.fecha})`,

          mensaje: `
Total servicios: ${stats.total_servicios || 0}
Pendientes: ${stats.pendientes || 0}
Asignados: ${stats.asignados || 0}
En ejecución: ${stats.en_ejecucion || 0}
Completados: ${stats.completados || 0}
Técnicos activos: ${stats.tecnicos_activos || 0}
Clientes activos: ${stats.clientes_activos || 0}
          `.trim(),

          prioridad: 'media',
          data: stats,
        });
      }
    }

    if (
      rolNormalizado === 'tecnico' &&
      tecnicoId
    ) {
      const resumen =
        await getResumenTecnico(tecnicoId);

      if (resumen) {
        alertas.push({
          tipo: 'resumen_tecnico',

          titulo:
            `Tus servicios ` +
            `(${fecha.fecha})`,

          mensaje: `
Total servicios: ${resumen.total || 0}
Pendientes: ${resumen.pendientes || 0}
Asignados: ${resumen.asignados || 0}
En ejecución: ${resumen.en_ejecucion || 0}
Completados: ${resumen.completados || 0}
Para hoy: ${resumen.hoy || 0}
          `.trim(),

          prioridad: 'media',
          data: resumen,
        });
      }
    }

    if (rolNormalizado === 'ventas') {
      const cotizaciones =
        await getCotizacionesPendientes();

      if (cotizaciones.length > 0) {
        alertas.push({
          tipo: 'cotizaciones',

          titulo:
            `${cotizaciones.length} ` +
            `cotizaciones pendientes`,

          mensaje: cotizaciones
            .map(
              (item) =>
                `- ${item.numero_solicitud}: ` +
                `${item.cliente_nombre}`
            )
            .join('\n'),

          prioridad: 'alta',
          data: cotizaciones,
        });
      }
    }

    if (rolNormalizado === 'cartera') {
      const facturas =
        await getFacturasVencidas();

      if (facturas.length > 0) {
        alertas.push({
          tipo: 'facturas',

          titulo:
            `${facturas.length} ` +
            `facturas vencidas`,

          mensaje: facturas
            .map(
              (item) =>
                `- ${item.numero_factura}: ` +
                `${item.cliente_nombre} ` +
                `($${item.total_general})`
            )
            .join('\n'),

          prioridad: 'alta',
          data: facturas,
        });
      }
    }

    return alertas;
  } catch (error) {
    console.error(
      'Error generando alertas:',
      error
    );

    return [];
  }
};

// ============================================================
// EXPORTAR
// ============================================================

module.exports = {
  chatConModo,
  getSesion,
  limpiarSesion,
  getFechaActual,
  generarAlertas,
  getBotConfig,
  getServiciosTecnico,
  getServiciosHoyTecnico,
  getResumenTecnico,
  getTecnicosDisponibles,
  getCargaTecnicos,
  getServiciosByEstado,
  getCotizacionesPendientes,
  getFacturasVencidas,
  getGarantiasPendientes,
  getEstadisticasGenerales,

  chat: async (
    prompt,
    sistema = ''
  ) => {
    try {
      const respuesta = await ollamaChat([
        {
          role: 'system',
          content: sistema,
        },
        {
          role: 'user',
          content: String(
            prompt || ''
          ).trim(),
        },
      ]);

      return {
        success: true,
        respuesta,
        modelo: MODEL,
      };
    } catch (error) {
      console.error(
        'Error en chat genérico:',
        error
      );

      return {
        success: false,
        message: error.message,
        error: error.message,
      };
    }
  },

  verificarConexion,
};