// backend/src/services/ia.service.js
const { Ollama } = require('ollama');
const { Pool } = require('pg');

const ollama = new Ollama({
  host: process.env.OLLAMA_URL || 'http://localhost:11434'
});

const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// ============================================================
// FECHA ACTUAL
// ============================================================

const getFechaActual = () => {
    const hoy = new Date();
    return {
        fecha: hoy.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }),
        iso: hoy.toISOString().split('T')[0],
        hora: hoy.toLocaleTimeString('es-CO'),
        diaSemana: hoy.toLocaleDateString('es-CO', { weekday: 'long' })
    };
};

// ============================================================
// SISTEMA DE BOTS POR ROL
// ============================================================

const getBotConfig = (rol) => {
    const bots = {
        admin: {
            nombre: 'Administrador',
            descripcion: 'Visión general del sistema, estadísticas, gestión de usuarios',
            prompt: `
                Eres el asistente del Administrador del sistema.
                Tienes acceso a toda la información del sistema.
                Puedes responder sobre: estadísticas generales, gestión de usuarios, rendimiento global,
                servicios, productos, clientes, facturación, alquileres, inventario.
                Responde de forma profesional y ejecutiva.
            `
        },
        tecnico: {
            nombre: 'Técnico',
            descripcion: 'Servicios asignados, diagnósticos, equipos, repuestos',
            prompt: `
                Eres el asistente de un Técnico de servicio.
                Tu función es ayudar al técnico con sus tareas diarias.
                Puedes responder sobre: servicios asignados, equipos, diagnósticos, repuestos,
                órdenes pendientes, visitas técnicas, estado de equipos.
                Responde de forma práctica y operativa.
                Prioriza la información de los servicios asignados al técnico.
            `
        },
        ventas: {
            nombre: 'Ventas',
            descripcion: 'Cotizaciones, clientes, pedidos, seguimiento',
            prompt: `
                Eres el asistente del área de Ventas.
                Tu función es ayudar con la gestión de cotizaciones, clientes y pedidos.
                Puedes responder sobre: cotizaciones pendientes, clientes, pedidos,
                seguimiento de ventas, productos, precios, disponibilidad.
                Responde de forma comercial y proactiva.
                Prioriza el seguimiento a clientes y cierre de ventas.
            `
        },
        cartera: {
            nombre: 'Cartera',
            descripcion: 'Facturas, pagos, clientes morosos, cobros',
            prompt: `
                Eres el asistente del área de Cartera.
                Tu función es ayudar con la gestión de cobros y pagos.
                Puedes responder sobre: facturas vencidas, clientes morosos,
                pagos pendientes, acuerdos de pago, cartera por antigüedad.
                Responde de forma financiera y estratégica.
                Prioriza los cobros urgentes y la reducción de morosidad.
            `
        },
        jefe_tecnicos: {
            nombre: 'Jefe de Técnicos',
            descripcion: 'Carga de trabajo, rendimiento, asignaciones, productividad',
            prompt: `
                Eres el asistente del Jefe de Técnicos.
                Tu función es ayudar con la gestión del equipo técnico.
                Puedes responder sobre: carga de trabajo por técnico, rendimiento,
                asignaciones, productividad, tiempos de atención, órdenes retrasadas.
                Responde de forma gerencial y analítica.
                Prioriza la optimización de recursos y la eficiencia del equipo.
            `
        },
        garantias: {
            nombre: 'Garantías',
            descripcion: 'Casos de garantía, seguimiento, proveedores, devoluciones',
            prompt: `
                Eres el asistente del área de Garantías.
                Tu función es ayudar con la gestión de casos de garantía.
                Puedes responder sobre: garantías ingresadas, casos pendientes,
                seguimiento a proveedores, devoluciones, productos defectuosos.
                Responde de forma detallada y de seguimiento.
                Prioriza el cumplimiento de tiempos y la satisfacción del cliente.
            `
        }
    };
    return bots[rol] || bots.admin;
};

// ============================================================
// FUNCIONES DE CONSULTA POR ROL
// ============================================================

// 1. Servicios de un técnico
const getServiciosTecnico = async (tecnico_id) => {
    try {
        const result = await pgPool.query(`
            SELECT 
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.fecha_agendada,
                s.hora_inicio_agendada,
                s.duracion_estimada,
                c.razon_social as cliente_nombre,
                c.documento as cliente_documento,
                s.created_at
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE s.tecnico_id = $1
            ORDER BY s.fecha_agendada ASC NULLS LAST
        `, [tecnico_id]);
        return result.rows;
    } catch (error) {
        console.error('Error en getServiciosTecnico:', error);
        return [];
    }
};

// 2. Servicios del día de un técnico
const getServiciosHoyTecnico = async (tecnico_id) => {
    try {
        const hoy = getFechaActual().iso;
        const result = await pgPool.query(`
            SELECT 
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.fecha_agendada,
                s.hora_inicio_agendada,
                s.duracion_estimada,
                c.razon_social as cliente_nombre,
                c.documento as cliente_documento
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE s.tecnico_id = $1 AND DATE(s.fecha_agendada) = $2
            ORDER BY s.hora_inicio_agendada ASC
        `, [tecnico_id, hoy]);
        return result.rows;
    } catch (error) {
        console.error('Error en getServiciosHoyTecnico:', error);
        return [];
    }
};

// 3. Resumen de un técnico
const getResumenTecnico = async (tecnico_id) => {
    try {
        const result = await pgPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado = 'asignada' THEN 1 END) as asignados,
                COUNT(CASE WHEN estado = 'en_ejecucion' THEN 1 END) as en_ejecucion,
                COUNT(CASE WHEN estado = 'cerrada' THEN 1 END) as completados,
                COUNT(CASE WHEN DATE(fecha_agendada) = CURRENT_DATE THEN 1 END) as hoy
            FROM service_orders s
            WHERE s.tecnico_id = $1
        `, [tecnico_id]);
        return result.rows[0];
    } catch (error) {
        console.error('Error en getResumenTecnico:', error);
        return null;
    }
};

// 4. Todos los técnicos
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
        console.error('Error en getTecnicosDisponibles:', error);
        return [];
    }
};

// 5. Carga de trabajo por técnico
const getCargaTecnicos = async () => {
    try {
        const result = await pgPool.query(`
            SELECT 
                u.id,
                u.nombre1,
                u.apellidos,
                COUNT(s.id) as total_servicios,
                COUNT(CASE WHEN s.estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN s.estado = 'asignada' THEN 1 END) as asignados,
                COUNT(CASE WHEN s.estado = 'en_ejecucion' THEN 1 END) as en_ejecucion,
                COUNT(CASE WHEN s.estado = 'cerrada' THEN 1 END) as completados
            FROM usuarios u
            LEFT JOIN service_orders s ON u.id = s.tecnico_id
            WHERE u.rol = 'tecnico'
            GROUP BY u.id, u.nombre1, u.apellidos
            ORDER BY total_servicios DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error en getCargaTecnicos:', error);
        return [];
    }
};

// 6. Servicios por estado (general)
const getServiciosByEstado = async (estado) => {
    try {
        const result = await pgPool.query(`
            SELECT 
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.fecha_agendada,
                c.razon_social as cliente_nombre,
                u.usuario as tecnico_nombre,
                s.created_at
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN usuarios u ON s.tecnico_id = u.id
            WHERE s.estado = $1
            ORDER BY s.fecha_agendada ASC NULLS LAST
            LIMIT 30
        `, [estado]);
        return result.rows;
    } catch (error) {
        console.error('Error en getServiciosByEstado:', error);
        return [];
    }
};

// 7. Cotizaciones pendientes (para Ventas)
const getCotizacionesPendientes = async () => {
    try {
        // Si tienes tabla de cotizaciones, ajusta la consulta
        const result = await pgPool.query(`
            SELECT 
                id,
                numero_solicitud,
                cliente_nombre,
                fecha_creacion,
                estado
            FROM solicitudes_alquiler 
            WHERE estado = 'pendiente'
            ORDER BY fecha_creacion ASC
            LIMIT 20
        `);
        return result.rows;
    } catch (error) {
        console.error('Error en getCotizacionesPendientes:', error);
        return [];
    }
};

// 8. Facturas vencidas (para Cartera)
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
            WHERE estado = 'emitida' AND fecha_emision < NOW() - INTERVAL '30 days'
            ORDER BY fecha_emision ASC
            LIMIT 20
        `);
        return result.rows;
    } catch (error) {
        console.error('Error en getFacturasVencidas:', error);
        return [];
    }
};

// 9. Garantías pendientes
const getGarantiasPendientes = async () => {
    try {
        // Si tienes tabla de garantías, ajusta la consulta
        const result = await pgPool.query(`
            SELECT 
                id,
                numero_solicitud,
                cliente_nombre,
                fecha_creacion,
                estado
            FROM solicitudes_alquiler 
            WHERE estado = 'pendiente' AND tipo = 'garantia'
            ORDER BY fecha_creacion ASC
            LIMIT 20
        `);
        return result.rows;
    } catch (error) {
        console.error('Error en getGarantiasPendientes:', error);
        return [];
    }
};

// 10. Estadísticas generales
const getEstadisticasGenerales = async () => {
    try {
        const result = await pgPool.query(`
            SELECT 
                (SELECT COUNT(*) FROM service_orders) as total_servicios,
                (SELECT COUNT(*) FROM service_orders WHERE estado = 'pendiente') as pendientes,
                (SELECT COUNT(*) FROM service_orders WHERE estado = 'asignada') as asignados,
                (SELECT COUNT(*) FROM service_orders WHERE estado = 'en_ejecucion') as en_ejecucion,
                (SELECT COUNT(*) FROM service_orders WHERE estado = 'cerrada') as completados,
                (SELECT COUNT(*) FROM usuarios WHERE rol = 'tecnico' AND activo = true) as tecnicos_activos,
                (SELECT COUNT(*) FROM sync_clientes WHERE activo = true) as clientes_activos,
                (SELECT COUNT(*) FROM products WHERE estado = true) as productos_activos,
                (SELECT COUNT(*) FROM invoices WHERE estado = 'emitida') as facturas_pendientes,
                (SELECT COUNT(*) FROM solicitudes_alquiler WHERE estado = 'pendiente') as solicitudes_pendientes
        `);
        return result.rows[0];
    } catch (error) {
        console.error('Error en getEstadisticasGenerales:', error);
        return null;
    }
};

// ============================================================
// MAPA DE TOOLS
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
    getEstadisticasGenerales
};

// ============================================================
// DETECCIÓN DE INTENCIÓN POR ROL
// ============================================================

const detectarIntencion = (mensaje, rol) => {
    const msg = mensaje.toLowerCase();
    
    // ============================================================
    // ADMIN
    // ============================================================
    if (rol === 'admin') {
        if (msg.includes('estadistica') || msg.includes('general') || msg.includes('resumen ejecutivo')) {
            return { tool: 'getEstadisticasGenerales', params: {} };
        }
        if (msg.includes('tecnico') && (msg.includes('carga') || msg.includes('trabajo') || msg.includes('ocupado'))) {
            return { tool: 'getCargaTecnicos', params: {} };
        }
        if (msg.includes('tecnico') && (msg.includes('disponible') || msg.includes('libre') || msg.includes('activo'))) {
            return { tool: 'getTecnicosDisponibles', params: {} };
        }
        if (msg.includes('pendiente') || msg.includes('por atender')) {
            return { tool: 'getServiciosByEstado', params: { estado: 'pendiente' } };
        }
    }
    
    // ============================================================
    // TÉCNICO
    // ============================================================
    if (rol === 'tecnico') {
        if (msg.includes('hoy') && (msg.includes('servicio') || msg.includes('os') || msg.includes('orden'))) {
            return { tool: 'getServiciosHoyTecnico', params: {} };
        }
        if (msg.includes('resumen') || msg.includes('estadistica') || msg.includes('cuantos')) {
            return { tool: 'getResumenTecnico', params: {} };
        }
        if (msg.includes('todos') && (msg.includes('servicio') || msg.includes('os') || msg.includes('orden'))) {
            return { tool: 'getServiciosTecnico', params: {} };
        }
        if (msg.includes('pendiente') || msg.includes('por hacer')) {
            return { tool: 'getServiciosTecnico', params: {} };
        }
    }
    
    // ============================================================
    // VENTAS
    // ============================================================
    if (rol === 'ventas') {
        if (msg.includes('cotizacion') || msg.includes('cotización')) {
            return { tool: 'getCotizacionesPendientes', params: {} };
        }
        if (msg.includes('cliente') && (msg.includes('contactar') || msg.includes('llamar') || msg.includes('seguimiento'))) {
            return { tool: 'getCotizacionesPendientes', params: {} };
        }
        if (msg.includes('pedido') && (msg.includes('pendiente') || msg.includes('retraso'))) {
            return { tool: 'getServiciosByEstado', params: { estado: 'pendiente' } };
        }
    }
    
    // ============================================================
    // CARTERA
    // ============================================================
    if (rol === 'cartera') {
        if (msg.includes('factura') && (msg.includes('vencida') || msg.includes('vencer') || msg.includes('pendiente'))) {
            return { tool: 'getFacturasVencidas', params: {} };
        }
        if (msg.includes('pago') && (msg.includes('pendiente') || msg.includes('moroso') || msg.includes('deuda'))) {
            return { tool: 'getFacturasVencidas', params: {} };
        }
        if (msg.includes('cartera') || msg.includes('cobro')) {
            return { tool: 'getFacturasVencidas', params: {} };
        }
    }
    
    // ============================================================
    // JEFE DE TÉCNICOS
    // ============================================================
    if (rol === 'jefe_tecnicos') {
        if (msg.includes('carga') && msg.includes('tecnico')) {
            return { tool: 'getCargaTecnicos', params: {} };
        }
        if (msg.includes('rendimiento') || msg.includes('productividad')) {
            return { tool: 'getCargaTecnicos', params: {} };
        }
        if (msg.includes('disponible') && msg.includes('tecnico')) {
            return { tool: 'getTecnicosDisponibles', params: {} };
        }
        if (msg.includes('retraso') || msg.includes('demora')) {
            return { tool: 'getServiciosByEstado', params: { estado: 'pendiente' } };
        }
    }
    
    // ============================================================
    // GARANTÍAS
    // ============================================================
    if (rol === 'garantias') {
        if (msg.includes('garantia') && (msg.includes('pendiente') || msg.includes('ingresada'))) {
            return { tool: 'getGarantiasPendientes', params: {} };
        }
        if (msg.includes('proveedor') || msg.includes('fabricante')) {
            return { tool: 'getGarantiasPendientes', params: {} };
        }
        if (msg.includes('devolucion') || msg.includes('rechazado')) {
            return { tool: 'getGarantiasPendientes', params: {} };
        }
    }
    
    return { tool: null, params: {} };
};

// ============================================================
// GESTIÓN DE SESIONES
// ============================================================

const sesiones = new Map();

const getSesion = (userId) => {
    if (!sesiones.has(userId)) {
        sesiones.set(userId, {
            historial: [],
            contexto: { rol: '', nombre: '' },
            ultimaActividad: Date.now()
        });
    }
    return sesiones.get(userId);
};

// ============================================================
// CHAT PRINCIPAL CON BOT POR ROL
// ============================================================

const chatConModo = async (userId, mensaje, modo = 'asistente', rol = 'usuario', tecnico_id = null) => {
    try {
        let promptSistema = '';
        let datos = null;
        let toolUsada = null;
        const fecha = getFechaActual();
        const botConfig = getBotConfig(rol);

        if (modo === 'asistente') {
            // Detectar intención según rol
            const intencion = detectarIntencion(mensaje, rol);
            
            if (intencion.tool && tools[intencion.tool]) {
                try {
                    let params = { ...intencion.params };
                    // Si es técnico, pasar su ID automáticamente
                    if (rol === 'tecnico' && tecnico_id) {
                        if (intencion.tool === 'getServiciosHoyTecnico' || 
                            intencion.tool === 'getResumenTecnico' || 
                            intencion.tool === 'getServiciosTecnico') {
                            params.tecnico_id = tecnico_id;
                        }
                    }
                    datos = await tools[intencion.tool](params);
                    toolUsada = intencion.tool;
                } catch (error) {
                    console.error('Error ejecutando tool:', error);
                    datos = null;
                }
            }

            // Construir prompt con el bot específico del rol
            promptSistema = `
                ${botConfig.prompt}

                FECHA ACTUAL: ${fecha.fecha}
                HORA ACTUAL: ${fecha.hora}
                ROL DEL USUARIO: ${rol}
                NOMBRE DEL USUARIO: ${userId}

                REGLAS IMPORTANTES:
                1. SIEMPRE usa la fecha actual ${fecha.fecha} como referencia.
                2. Si tienes datos de la base de datos, USA ESOS DATOS para responder.
                3. Si NO tienes datos, responde: "No tengo información registrada sobre eso."
                4. NUNCA inventes información que no esté en los datos.
                5. Sé conciso, profesional y útil.
                6. Si el usuario es técnico, responde sobre SUS servicios personales.
                7. Si eres de ventas, enfócate en cotizaciones y clientes.
                8. Si eres de cartera, enfócate en cobros y facturas.
                9. Si eres jefe de técnicos, enfócate en rendimiento y carga de trabajo.
                10. Si eres de garantías, enfócate en casos y seguimiento.
            `;

            if (datos) {
                if (Array.isArray(datos) && datos.length === 0) {
                    promptSistema += `\n\nNo se encontraron datos. Responde: "No hay información disponible para tu consulta."`;
                } else {
                    promptSistema += `\n\nDATOS DE LA BASE DE DATOS (USA ESTOS DATOS PARA RESPONDER):\n${JSON.stringify(datos, null, 2)}`;
                    promptSistema += `\n\nResponde basándote EXCLUSIVAMENTE en estos datos.`;
                }
            } else {
                promptSistema += `\n\nNo se ejecutó ninguna consulta a la base de datos. Responde: "No tengo información sobre eso."`;
            }

            // Historial de la sesión
            const sesion = getSesion(userId);
            if (sesion.historial.length > 0) {
                const ultimos = sesion.historial.slice(-4);
                promptSistema += `\n\nHistorial reciente:`;
                ultimos.forEach(h => {
                    promptSistema += `\n[${h.role}]: ${h.content.substring(0, 80)}`;
                });
            }

        } else {
            // Modo consulta
            promptSistema = `
                Eres un asistente de consulta rápida. Responde preguntas específicas de forma directa y concisa.
                FECHA ACTUAL: ${fecha.fecha}
                Responde siempre en español.
                No uses contexto del usuario, solo responde la pregunta puntual.
            `;
        }

        const response = await ollama.chat({
            model: MODEL,
            messages: [
                { role: 'system', content: promptSistema },
                { role: 'user', content: mensaje }
            ]
        });

        if (modo === 'asistente') {
            const sesion = getSesion(userId);
            sesion.historial.push(
                { role: 'user', content: mensaje },
                { role: 'assistant', content: response.message.content }
            );
            sesion.ultimaActividad = Date.now();
        }

        return { 
            success: true, 
            respuesta: response.message.content,
            tool: toolUsada,
            datos: datos
        };
    } catch (error) {
        console.error('Error en chat:', error);
        return { success: false, error: error.message };
    }
};

// ============================================================
// GENERAR ALERTAS
// ============================================================

const generarAlertas = async (rol = 'usuario', tecnico_id = null) => {
    try {
        const alertas = [];
        const fecha = getFechaActual();

        if (rol === 'admin' || rol === 'jefe_tecnicos') {
            // Estadísticas generales
            const stats = await getEstadisticasGenerales();
            if (stats) {
                alertas.push({
                    tipo: 'estadisticas',
                    titulo: `Resumen del sistema (${fecha.fecha})`,
                    mensaje: `
Total servicios: ${stats.total_servicios || 0}
Pendientes: ${stats.pendientes || 0}
Asignados: ${stats.asignados || 0}
En ejecución: ${stats.en_ejecucion || 0}
Completados: ${stats.completados || 0}
Técnicos activos: ${stats.tecnicos_activos || 0}
Clientes activos: ${stats.clientes_activos || 0}
                    `,
                    prioridad: 'media',
                    data: stats
                });
            }
        }

        if (rol === 'tecnico' && tecnico_id) {
            const resumen = await getResumenTecnico(tecnico_id);
            if (resumen) {
                alertas.push({
                    tipo: 'resumen_tecnico',
                    titulo: `Tus servicios (${fecha.fecha})`,
                    mensaje: `
Total servicios: ${resumen.total || 0}
Pendientes: ${resumen.pendientes || 0}
Asignados: ${resumen.asignados || 0}
En ejecución: ${resumen.en_ejecucion || 0}
Completados: ${resumen.completados || 0}
Para hoy: ${resumen.hoy || 0}
                    `,
                    prioridad: 'media',
                    data: resumen
                });
            }
        }

        if (rol === 'ventas') {
            const cotizaciones = await getCotizacionesPendientes();
            if (cotizaciones.length > 0) {
                alertas.push({
                    tipo: 'cotizaciones',
                    titulo: `${cotizaciones.length} cotizaciones pendientes`,
                    mensaje: cotizaciones.map(c => 
                        `- ${c.numero_solicitud}: ${c.cliente_nombre}`
                    ).join('\n'),
                    prioridad: 'alta',
                    data: cotizaciones
                });
            }
        }

        if (rol === 'cartera') {
            const facturas = await getFacturasVencidas();
            if (facturas.length > 0) {
                alertas.push({
                    tipo: 'facturas',
                    titulo: `${facturas.length} facturas vencidas`,
                    mensaje: facturas.map(f => 
                        `- ${f.numero_factura}: ${f.cliente_nombre} ($${f.total_general})`
                    ).join('\n'),
                    prioridad: 'alta',
                    data: facturas
                });
            }
        }

        return alertas;
    } catch (error) {
        console.error('Error generando alertas:', error);
        return [];
    }
};

// ============================================================
// EXPORTAR
// ============================================================

module.exports = {
    chatConModo,
    getSesion,
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
    chat: async (prompt, sistema) => {
        const response = await ollama.chat({
            model: MODEL,
            messages: [
                { role: 'system', content: sistema || '' },
                { role: 'user', content: prompt }
            ]
        });
        return { success: true, respuesta: response.message.content };
    },
    verificarConexion: async () => {
        try {
            const response = await ollama.chat({
                model: MODEL,
                messages: [{ role: 'user', content: 'Responde solo "OK"' }]
            });
            return { success: true, message: response.message.content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};