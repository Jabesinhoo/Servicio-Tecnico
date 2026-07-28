// backend/src/services/producto-serial.service.js
const { Pool } = require('pg');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// Obtener todos los productos sincronizados
const getProductosSync = async () => {
    const result = await pgPool.query(`
        SELECT 
            id_externo,
            codigo,
            nombre,
            precio_venta,
            activo
        FROM sync_productos
        WHERE activo = true
        ORDER BY nombre
    `);
    return result.rows;
};

// Obtener un producto por su codigo
const getProductoByCodigo = async (codigo) => {
    const result = await pgPool.query(`
        SELECT 
            id_externo,
            codigo,
            nombre,
            precio_venta,
            activo
        FROM sync_productos
        WHERE codigo = $1
    `, [codigo]);
    return result.rows[0];
};

// Crear un nuevo serial para un producto
const crearSerial = async (productoId, serial, observaciones = '') => {
    const result = await pgPool.query(`
        INSERT INTO productos_seriales (
            producto_id,
            serial,
            estado,
            ubicacion,
            observaciones,
            fecha_ingreso,
            ultimo_movimiento
        ) VALUES ($1, $2, 'disponible', 'bodega', $3, NOW(), NOW())
        RETURNING *
    `, [productoId, serial, observaciones]);
    return result.rows[0];
};

// Obtener seriales de un producto
const getSerialesByProducto = async (productoId) => {
    const result = await pgPool.query(`
        SELECT 
            ps.*,
            sp.codigo,
            sp.nombre as producto_nombre
        FROM productos_seriales ps
        LEFT JOIN sync_productos sp ON ps.producto_id = sp.id_externo
        WHERE ps.producto_id = $1
        ORDER BY ps.fecha_ingreso DESC
    `, [productoId]);
    return result.rows;
};

// Buscar un serial especifico
const buscarSerial = async (serial) => {
    const result = await pgPool.query(`
        SELECT 
            ps.*,
            sp.codigo,
            sp.nombre as producto_nombre
        FROM productos_seriales ps
        LEFT JOIN sync_productos sp ON ps.producto_id = sp.id_externo
        WHERE ps.serial = $1
    `, [serial]);
    return result.rows[0];
};

// Cambiar estado de un serial
const cambiarEstadoSerial = async (serialId, nuevoEstado, ubicacion = null) => {
    const result = await pgPool.query(`
        UPDATE productos_seriales 
        SET 
            estado = $1,
            ubicacion = COALESCE($2, ubicacion),
            ultimo_movimiento = NOW(),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [nuevoEstado, ubicacion, serialId]);
    return result.rows[0];
};

// Registrar movimiento en historial
const registrarMovimientoSerial = async (serialId, tipo, origen, destino, usuarioId, observaciones = '') => {
    const result = await pgPool.query(`
        INSERT INTO seriales_historial (
            serial_id,
            tipo_movimiento,
            origen,
            destino,
            usuario_id,
            observaciones,
            fecha
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
    `, [serialId, tipo, origen, destino, usuarioId, observaciones]);
    return result.rows[0];
};

// Obtener historial de un serial
const getHistorialSerial = async (serialId) => {
    const result = await pgPool.query(`
        SELECT 
            sh.*,
            u.nombre1 as usuario_nombre
        FROM seriales_historial sh
        LEFT JOIN usuarios u ON sh.usuario_id = u.id
        WHERE sh.serial_id = $1
        ORDER BY sh.fecha DESC
    `, [serialId]);
    return result.rows;
};

// Buscar productos por nombre o codigo
const buscarProductos = async (termino) => {
    const searchTerm = `%${termino.toLowerCase()}%`;
    const result = await pgPool.query(`
        SELECT 
            id_externo,
            codigo,
            nombre,
            precio_venta,
            activo
        FROM sync_productos
        WHERE 
            LOWER(codigo) LIKE $1 OR
            LOWER(nombre) LIKE $1
        ORDER BY nombre
        LIMIT 20
    `, [searchTerm]);
    return result.rows;
};

module.exports = {
    getProductosSync,
    getProductoByCodigo,
    crearSerial,
    getSerialesByProducto,
    buscarSerial,
    cambiarEstadoSerial,
    registrarMovimientoSerial,
    getHistorialSerial,
    buscarProductos
};