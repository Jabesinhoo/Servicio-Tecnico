// backend/src/controllers/sync.controller.js
const { Pool } = require('pg');
const worldoffice = require('../services/worldoffice.service');
const fs = require('fs');
const path = require('path');

// Conexión a PostgreSQL
const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// Ejecutar sincronización manual
exports.runSync = async (req, res) => {
    try {
        console.log('Sincronización manual iniciada por usuario:', req.user?.usuario || 'desconocido');
        
        const results = await worldoffice.syncAllData(pgPool);
        
        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje, registros_afectados)
            VALUES ('manual', 'info', 'Sincronización manual ejecutada por ${req.user?.usuario || 'admin'}', $1)
        `, [results.clientes + results.productos + results.seriales + results.alquileres]);

        res.json({
            success: true,
            message: 'Sincronización completada',
            data: results
        });
    } catch (error) {
        console.error('Error en sincronización manual:', error);
        
        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje)
            VALUES ('manual', 'error', $1)
        `, [error.message]);

        res.status(500).json({
            success: false,
            message: 'Error al sincronizar',
            error: error.message
        });
    }
};

// Obtener estado de la última sincronización
exports.getStatus = async (req, res) => {
    try {
        const result = await pgPool.query(`
            SELECT 
                tabla,
                ultima_sincronizacion,
                total_registros,
                estado,
                observaciones
            FROM sync_control
            ORDER BY ultima_sincronizacion DESC
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado',
            error: error.message
        });
    }
};

// Obtener logs de sincronización
exports.getLogs = async (req, res) => {
    try {
        const { limit = 100, tabla, tipo } = req.query;
        
        let query = `
            SELECT * FROM sync_logs
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (tabla) {
            query += ` AND tabla = $${paramIndex++}`;
            params.push(tabla);
        }

        if (tipo) {
            query += ` AND tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        query += ` ORDER BY fecha DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));

        const result = await pgPool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener logs',
            error: error.message
        });
    }
};

// Obtener estadísticas de datos sincronizados
exports.getStats = async (req, res) => {
    try {
        const [clientes, productos, seriales, alquileres] = await Promise.all([
            pgPool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE activo = true) as activos FROM sync_clientes'),
            pgPool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE activo = true) as activos FROM sync_productos'),
            pgPool.query('SELECT COUNT(*) as total FROM sync_seriales'),
            pgPool.query('SELECT COUNT(*) as total FROM sync_alquileres')
        ]);

        res.json({
            success: true,
            data: {
                clientes: {
                    total: parseInt(clientes.rows[0].total),
                    activos: parseInt(clientes.rows[0].activos)
                },
                productos: {
                    total: parseInt(productos.rows[0].total),
                    activos: parseInt(productos.rows[0].activos)
                },
                seriales: {
                    total: parseInt(seriales.rows[0].total)
                },
                alquileres: {
                    total: parseInt(alquileres.rows[0].total)
                },
                ultima_sincronizacion: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

// Buscar en datos sincronizados
exports.search = async (req, res) => {
    try {
        const { q, tabla = 'clientes', limit = 50 } = req.query;

        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: [],
                message: 'Ingrese al menos 2 caracteres para buscar'
            });
        }

        const searchTerm = `%${q.toLowerCase()}%`;
        let query = '';
        let params = [];

        if (tabla === 'clientes' || tabla === 'all') {
            query = `
                SELECT 
                    id_externo,
                    documento,
                    razon_social,
                    primer_nombre,
                    primer_apellido,
                    activo,
                    'cliente' as tipo
                FROM sync_clientes
                WHERE 
                    LOWER(documento) LIKE $1 OR
                    LOWER(razon_social) LIKE $1 OR
                    LOWER(primer_nombre) LIKE $1 OR
                    LOWER(primer_apellido) LIKE $1
                LIMIT $2
            `;
            params = [searchTerm, parseInt(limit)];
        } else if (tabla === 'productos') {
            query = `
                SELECT 
                    id_externo,
                    codigo,
                    nombre,
                    precio_venta,
                    activo,
                    'producto' as tipo
                FROM sync_productos
                WHERE 
                    LOWER(codigo) LIKE $1 OR
                    LOWER(nombre) LIKE $1
                LIMIT $2
            `;
            params = [searchTerm, parseInt(limit)];
        } else {
            return res.status(400).json({
                success: false,
                message: 'Tabla no válida. Use: clientes, productos o all'
            });
        }

        const result = await pgPool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error al buscar:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar',
            error: error.message
        });
    }
};

// Exportar datos sincronizados
exports.exportData = async (req, res) => {
    try {
        const { tabla } = req.params;
        const { formato = 'json' } = req.query;

        let query = '';
        let filename = '';

        switch (tabla) {
            case 'clientes':
                query = 'SELECT * FROM sync_clientes ORDER BY id_externo';
                filename = 'clientes_sincronizados';
                break;
            case 'productos':
                query = 'SELECT * FROM sync_productos ORDER BY id_externo';
                filename = 'productos_sincronizados';
                break;
            case 'seriales':
                query = 'SELECT * FROM sync_seriales ORDER BY id_externo';
                filename = 'seriales_sincronizados';
                break;
            case 'alquileres':
                query = 'SELECT * FROM sync_alquileres ORDER BY id_externo';
                filename = 'alquileres_sincronizados';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tabla no válida. Use: clientes, productos, seriales o alquileres'
                });
        }

        const result = await pgPool.query(query);

        if (formato === 'json') {
            res.json({
                success: true,
                data: result.rows,
                total: result.rows.length
            });
        } else if (formato === 'csv') {
            // Generar CSV
            const headers = Object.keys(result.rows[0] || {});
            let csv = headers.join(',') + '\n';
            
            result.rows.forEach(row => {
                const values = headers.map(h => {
                    let val = row[h];
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
                    if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                    return val;
                });
                csv += values.join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
            res.send(csv);
        } else {
            res.status(400).json({
                success: false,
                message: 'Formato no válido. Use: json o csv'
            });
        }
    } catch (error) {
        console.error('Error al exportar:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar',
            error: error.message
        });
    }
};

// backend/src/controllers/sync.controller.js
// Agregar esta funcion al final del archivo

// Buscar clientes en sync_clientes
exports.buscarClientes = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: [],
                message: 'Ingrese al menos 2 caracteres para buscar'
            });
        }

        const searchTerm = `%${q.toLowerCase()}%`;
        
        const result = await pgPool.query(`
            SELECT 
                id_externo as id,
                documento,
                razon_social,
                primer_nombre,
                primer_apellido,
                activo,
                'juridica' as tipo_persona
            FROM sync_clientes
            WHERE 
                LOWER(documento) LIKE $1 OR
                LOWER(razon_social) LIKE $1 OR
                LOWER(primer_nombre) LIKE $1 OR
                LOWER(primer_apellido) LIKE $1
            ORDER BY 
                CASE 
                    WHEN documento = $2 THEN 1
                    WHEN razon_social ILIKE $3 THEN 2
                    WHEN primer_nombre ILIKE $3 THEN 3
                    ELSE 4
                END
            LIMIT 20
        `, [searchTerm, q, `${q}%`]);

        // Formatear para que coincida con el formato que espera el frontend
        const clientes = result.rows.map(row => ({
            id: row.id,
            tipo_persona: row.tipo_persona || 'natural',
            razon_social: row.razon_social || null,
            primer_nombre: row.primer_nombre || null,
            primer_apellido: row.primer_apellido || null,
            documento: row.documento || null,
            telefono: null,
            email: null,
            ciudad: null,
            activo: row.activo
        }));

        res.json({
            success: true,
            data: clientes,
            total: clientes.length
        });
    } catch (error) {
        console.error('Error al buscar clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar clientes',
            error: error.message
        });
    }
};