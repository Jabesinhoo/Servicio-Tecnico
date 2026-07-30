// backend/src/services/ia.tools.js
const { Pool } = require('pg');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// ============================================================
// HERRAMIENTAS QUE LA IA PUEDE USAR
// ============================================================

const tools = {
    // 1. Obtener servicios del día
    obtenerServiciosHoy: async (params) => {
        const { tecnico_id } = params || {};
        const hoy = new Date().toISOString().split('T')[0];
        
        let query = `
            SELECT 
                s.id,
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.created_at,
                c.razon_social as cliente_nombre,
                c.documento as cliente_documento,
                u.usuario as tecnico_nombre
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN usuarios u ON s.tecnico_id = u.id
            WHERE DATE(s.created_at) = $1 OR DATE(s.fecha_agendada) = $1
        `;
        const paramsArray = [hoy];
        
        if (tecnico_id) {
            query += ` AND s.tecnico_id = $2`;
            paramsArray.push(tecnico_id);
        }
        
        query += ` ORDER BY s.created_at DESC`;
        
        const result = await pgPool.query(query, paramsArray);
        return {
            success: true,
            data: result.rows,
            total: result.rows.length,
            fecha: hoy
        };
    },

    // 2. Obtener servicios por estado
    obtenerServiciosPorEstado: async (params) => {
        const { estado, limite = 10 } = params;
        
        const query = `
            SELECT 
                s.id,
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.created_at,
                c.razon_social as cliente_nombre,
                u.usuario as tecnico_nombre
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN usuarios u ON s.tecnico_id = u.id
            WHERE s.estado = $1
            ORDER BY s.created_at DESC
            LIMIT $2
        `;
        
        const result = await pgPool.query(query, [estado, limite]);
        return {
            success: true,
            data: result.rows,
            total: result.rows.length,
            estado: estado
        };
    },

    // 3. Buscar cliente por documento o nombre
    buscarCliente: async (params) => {
        const { termino } = params;
        
        const query = `
            SELECT 
                id,
                razon_social,
                documento,
                telefono,
                email,
                ciudad,
                activo
            FROM clients
            WHERE 
                documento ILIKE $1 OR 
                razon_social ILIKE $1 OR
                primer_nombre ILIKE $1 OR
                primer_apellido ILIKE $1
            LIMIT 10
        `;
        
        const result = await pgPool.query(query, [`%${termino}%`]);
        return {
            success: true,
            data: result.rows,
            total: result.rows.length,
            termino: termino
        };
    },

    // 4. Obtener estadísticas del día
    obtenerEstadisticas: async () => {
        const hoy = new Date().toISOString().split('T')[0];
        
        const queries = [
            pgPool.query(`SELECT COUNT(*) as total FROM service_orders WHERE DATE(created_at) = $1`, [hoy]),
            pgPool.query(`SELECT COUNT(*) as pendientes FROM service_orders WHERE estado = 'pendiente' AND DATE(created_at) = $1`, [hoy]),
            pgPool.query(`SELECT COUNT(*) as en_ejecucion FROM service_orders WHERE estado = 'en_ejecucion' AND DATE(created_at) = $1`, [hoy]),
            pgPool.query(`SELECT COUNT(*) as completados FROM service_orders WHERE estado = 'cerrada' AND DATE(created_at) = $1`, [hoy]),
            pgPool.query(`SELECT COUNT(*) as clientes FROM clients WHERE activo = true`),
        ];
        
        const results = await Promise.all(queries);
        
        return {
            success: true,
            data: {
                fecha: hoy,
                total_servicios: parseInt(results[0].rows[0].total),
                pendientes: parseInt(results[1].rows[0].pendientes),
                en_ejecucion: parseInt(results[2].rows[0].en_ejecucion),
                completados: parseInt(results[3].rows[0].completados),
                clientes_activos: parseInt(results[4].rows[0].clientes)
            }
        };
    },

    // 5. Obtener detalle de un servicio específico
    obtenerDetalleServicio: async (params) => {
        const { codigo_os } = params;
        
        const query = `
            SELECT 
                s.*,
                c.razon_social as cliente_nombre,
                c.documento as cliente_documento,
                c.telefono as cliente_telefono,
                c.email as cliente_email,
                u.usuario as tecnico_nombre
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN usuarios u ON s.tecnico_id = u.id
            WHERE s.codigo_os = $1
        `;
        
        const result = await pgPool.query(query, [codigo_os]);
        return {
            success: true,
            data: result.rows[0] || null,
            encontrado: result.rows.length > 0
        };
    },

    // 6. Obtener próximos servicios (agendados)
    obtenerProximosServicios: async (params) => {
        const { dias = 3 } = params;
        
        const query = `
            SELECT 
                s.id,
                s.codigo_os,
                s.estado,
                s.descripcion_inicial,
                s.fecha_agendada,
                s.hora_inicio_agendada,
                c.razon_social as cliente_nombre,
                u.usuario as tecnico_nombre
            FROM service_orders s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN usuarios u ON s.tecnico_id = u.id
            WHERE 
                s.fecha_agendada IS NOT NULL AND
                s.fecha_agendada >= CURRENT_DATE AND
                s.fecha_agendada <= CURRENT_DATE + INTERVAL '${dias} days'
            ORDER BY s.fecha_agendada ASC, s.hora_inicio_agendada ASC
        `;
        
        const result = await pgPool.query(query);
        return {
            success: true,
            data: result.rows,
            total: result.rows.length,
            dias: dias
        };
    }
};

// ============================================================
// REGISTRO DE HERRAMIENTAS PARA LA IA
// ============================================================

const toolDefinitions = [
    {
        name: 'obtenerServiciosHoy',
        description: 'Obtiene la lista de servicios del día actual. Útil para saber qué servicios están programados o creados hoy.',
        parameters: {
            type: 'object',
            properties: {
                tecnico_id: {
                    type: 'string',
                    description: 'ID del técnico para filtrar (opcional)'
                }
            }
        }
    },
    {
        name: 'obtenerServiciosPorEstado',
        description: 'Obtiene servicios filtrados por estado (pendiente, en_ejecucion, cerrada, etc.)',
        parameters: {
            type: 'object',
            properties: {
                estado: {
                    type: 'string',
                    description: 'Estado del servicio: pendiente, asignada, en_ejecucion, en_espera, cerrada'
                },
                limite: {
                    type: 'integer',
                    description: 'Número máximo de resultados (por defecto 10)'
                }
            },
            required: ['estado']
        }
    },
    {
        name: 'buscarCliente',
        description: 'Busca clientes por nombre, razón social o documento',
        parameters: {
            type: 'object',
            properties: {
                termino: {
                    type: 'string',
                    description: 'Texto a buscar (nombre, documento, o razón social)'
                }
            },
            required: ['termino']
        }
    },
    {
        name: 'obtenerEstadisticas',
        description: 'Obtiene estadísticas del día: total servicios, pendientes, en ejecución, completados, clientes activos'
    },
    {
        name: 'obtenerDetalleServicio',
        description: 'Obtiene el detalle completo de un servicio específico por su código',
        parameters: {
            type: 'object',
            properties: {
                codigo_os: {
                    type: 'string',
                    description: 'Código de la orden de servicio (ej: OS-2026-0001)'
                }
            },
            required: ['codigo_os']
        }
    },
    {
        name: 'obtenerProximosServicios',
        description: 'Obtiene los próximos servicios agendados en los próximos días',
        parameters: {
            type: 'object',
            properties: {
                dias: {
                    type: 'integer',
                    description: 'Número de días hacia adelante (por defecto 3)'
                }
            }
        }
    }
];

// ============================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================

const ejecutarHerramienta = async (nombre, params = {}) => {
    if (tools[nombre]) {
        try {
            return await tools[nombre](params);
        } catch (error) {
            console.error(`Error ejecutando herramienta ${nombre}:`, error);
            return {
                success: false,
                error: `Error al ejecutar ${nombre}: ${error.message}`
            };
        }
    }
    return {
        success: false,
        error: `Herramienta ${nombre} no encontrada`
    };
};

// ============================================================
// GENERAR PROMPT CON HERRAMIENTAS DISPONIBLES
// ============================================================

const getToolsPrompt = () => {
    return `
Puedes usar las siguientes herramientas para consultar información del sistema:

1. obtenerServiciosHoy(): Obtiene los servicios del día actual
2. obtenerServiciosPorEstado(estado): Obtiene servicios por estado (pendiente, en_ejecucion, cerrada, etc.)
3. buscarCliente(termino): Busca clientes por nombre o documento
4. obtenerEstadisticas(): Obtiene estadísticas del día
5. obtenerDetalleServicio(codigo_os): Obtiene detalle de un servicio específico
6. obtenerProximosServicios(dias): Obtiene próximos servicios agendados

Cuando un usuario pregunte por información del sistema, usa estas herramientas para obtener datos reales.
Siempre devuelve la información de forma clara y organizada.
`;
};

module.exports = {
    tools,
    toolDefinitions,
    ejecutarHerramienta,
    getToolsPrompt
};