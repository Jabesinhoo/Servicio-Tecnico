// backend/src/services/alquiler.service.js
const { Pool } = require('pg');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// ============================================================
// 1. SOLICITUDES DE ALQUILER
// ============================================================

const crearSolicitud = async (data) => {
    const { cliente_id, vendedor_id, fecha_inicio, fecha_fin, observaciones } = data;
    
    const numeroResult = await pgPool.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero_solicitud, 4) AS INTEGER)), 0) + 1 as next
        FROM solicitudes_alquiler
    `);
    const nextNum = numeroResult.rows[0].next;
    const numero_solicitud = `ALQ-${String(nextNum).padStart(6, '0')}`;

    const result = await pgPool.query(`
        INSERT INTO solicitudes_alquiler (
            numero_solicitud,
            cliente_id,
            vendedor_id,
            fecha_inicio,
            fecha_fin,
            observaciones,
            estado
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
        RETURNING *
    `, [numero_solicitud, cliente_id, vendedor_id, fecha_inicio, fecha_fin, observaciones]);

    return result.rows[0];
};

const getSolicitudes = async (filtros = {}) => {
    let query = `
        SELECT 
            s.id,
            s.numero_solicitud,
            s.cliente_id,
            c.razon_social as cliente_nombre,
            c.documento as cliente_documento,
            s.vendedor_id,
            u.usuario as vendedor_nombre,
            s.fecha_inicio,
            s.fecha_fin,
            s.fecha_solicitud,
            s.estado,
            s.documentacion_aprobada,
            s.estudio_credito_aprobado,
            s.pago_realizado,
            s.deposito_realizado,
            s.observaciones,
            s.created_at,
            s.updated_at
        FROM solicitudes_alquiler s
        LEFT JOIN sync_clientes c ON s.cliente_id = c.id_externo
        LEFT JOIN usuarios u ON s.vendedor_id = u.id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filtros.estado) {
        query += ` AND s.estado = $${paramIndex++}`;
        params.push(filtros.estado);
    }

    if (filtros.cliente_id) {
        query += ` AND s.cliente_id = $${paramIndex++}`;
        params.push(filtros.cliente_id);
    }

    if (filtros.vendedor_id) {
        query += ` AND s.vendedor_id = $${paramIndex++}`;
        params.push(filtros.vendedor_id);
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await pgPool.query(query, params);
    return result.rows;
};

const getSolicitudById = async (id) => {
    const result = await pgPool.query(`
        SELECT 
            s.*,
            c.razon_social as cliente_nombre,
            c.documento as cliente_documento,
            c.primer_nombre,
            c.primer_apellido,
            u.usuario as vendedor_nombre
        FROM solicitudes_alquiler s
        LEFT JOIN sync_clientes c ON s.cliente_id = c.id_externo
        LEFT JOIN usuarios u ON s.vendedor_id = u.id
        WHERE s.id = $1
    `, [id]);
    return result.rows[0];
};

const actualizarEstadoSolicitud = async (id, estado, observaciones = '') => {
    const result = await pgPool.query(`
        UPDATE solicitudes_alquiler 
        SET 
            estado = $1,
            observaciones = COALESCE($2, observaciones),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [estado, observaciones, id]);
    return result.rows[0];
};

const aprobarDocumentacion = async (id, aprobado, observaciones = '') => {
    const result = await pgPool.query(`
        UPDATE solicitudes_alquiler 
        SET 
            documentacion_aprobada = $1,
            observaciones = COALESCE($2, observaciones),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
    `, [aprobado, observaciones, id]);
    return result.rows[0];
};

// ============================================================
// 2. ITEMS DE ALQUILER
// ============================================================

const agregarItemAlquiler = async (data) => {
    const { solicitud_id, producto_id, serial_id, cantidad } = data;
    
    const result = await pgPool.query(`
        INSERT INTO alquiler_items (
            solicitud_id,
            producto_id,
            serial_id,
            cantidad,
            estado_revision
        ) VALUES ($1, $2, $3, $4, 'pendiente')
        RETURNING *
    `, [solicitud_id, producto_id, serial_id, cantidad || 1]);
    return result.rows[0];
};

const getItemsBySolicitud = async (solicitud_id) => {
    const result = await pgPool.query(`
        SELECT 
            ai.id,
            ai.solicitud_id,
            ai.producto_id,
            p.codigo as producto_codigo,
            p.nombre as producto_nombre,
            ai.serial_id,
            ps.serial,
            ai.cantidad,
            ai.estado_revision,
            ai.tecnico_id,
            u.usuario as tecnico_nombre,
            ai.observaciones,
            ai.created_at,
            ai.updated_at
        FROM alquiler_items ai
        LEFT JOIN sync_productos p ON ai.producto_id = p.id_externo
        LEFT JOIN productos_seriales ps ON ai.serial_id = ps.id
        LEFT JOIN usuarios u ON ai.tecnico_id = u.id
        WHERE ai.solicitud_id = $1
        ORDER BY ai.id
    `, [solicitud_id]);
    return result.rows;
};

const asignarTecnicoItem = async (item_id, tecnico_id) => {
    const result = await pgPool.query(`
        UPDATE alquiler_items 
        SET 
            tecnico_id = $1,
            estado_revision = 'en_revision',
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [tecnico_id, item_id]);
    return result.rows[0];
};

// ============================================================
// 3. NOTIFICACIONES
// ============================================================

const crearNotificacion = async (data) => {
    const { usuario_id, tipo, titulo, mensaje, link, solicitud_id } = data;
    
    const result = await pgPool.query(`
        INSERT INTO notificaciones (
            usuario_id,
            tipo,
            titulo,
            mensaje,
            link,
            solicitud_id,
            leido
        ) VALUES ($1, $2, $3, $4, $5, $6, false)
        RETURNING *
    `, [usuario_id, tipo, titulo, mensaje, link, solicitud_id]);
    return result.rows[0];
};

const getNotificaciones = async (usuario_id, soloNoLeidas = false) => {
    let query = `
        SELECT * FROM notificaciones
        WHERE usuario_id = $1
    `;
    const params = [usuario_id];
    
    if (soloNoLeidas) {
        query += ` AND leido = false`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT 50`;
    
    const result = await pgPool.query(query, params);
    return result.rows;
};

const marcarNotificacionLeida = async (notificacion_id) => {
    const result = await pgPool.query(`
        UPDATE notificaciones 
        SET leido = true
        WHERE id = $1
        RETURNING *
    `, [notificacion_id]);
    return result.rows[0];
};

const marcarTodasLeidas = async (usuario_id) => {
    await pgPool.query(`
        UPDATE notificaciones 
        SET leido = true
        WHERE usuario_id = $1 AND leido = false
    `, [usuario_id]);
};

const contarNotificacionesNoLeidas = async (usuario_id) => {
    const result = await pgPool.query(`
        SELECT COUNT(*) as cantidad
        FROM notificaciones
        WHERE usuario_id = $1 AND leido = false
    `, [usuario_id]);
    return parseInt(result.rows[0].cantidad);
};

// ============================================================
// 4. REVISIONES TECNICAS
// ============================================================

const crearRevisionTecnica = async (data) => {
    const { alquiler_item_id, tecnico_id, estado_producto, observaciones, imagenes, firma_tecnico } = data;
    
    const result = await pgPool.query(`
        INSERT INTO revisiones_tecnicas (
            alquiler_item_id,
            tecnico_id,
            estado_producto,
            observaciones,
            imagenes,
            firma_tecnico
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [alquiler_item_id, tecnico_id, estado_producto, observaciones, imagenes || '[]', firma_tecnico]);
    
    await pgPool.query(`
        UPDATE alquiler_items 
        SET 
            estado_revision = 'aprobado',
            updated_at = NOW()
        WHERE id = $1
    `, [alquiler_item_id]);
    
    return result.rows[0];
};

const getRevisionesByItem = async (alquiler_item_id) => {
    const result = await pgPool.query(`
        SELECT 
            rt.*,
            u.usuario as tecnico_nombre
        FROM revisiones_tecnicas rt
        LEFT JOIN usuarios u ON rt.tecnico_id = u.id
        WHERE rt.alquiler_item_id = $1
        ORDER BY rt.fecha_revision DESC
    `, [alquiler_item_id]);
    return result.rows;
};

// ============================================================
// 5. DESPACHOS DE BODEGA
// ============================================================

const crearDespacho = async (data) => {
    const { solicitud_id, responsable_id, observaciones } = data;
    
    const result = await pgPool.query(`
        INSERT INTO despachos_bodega (
            solicitud_id,
            responsable_id,
            observaciones,
            estado
        ) VALUES ($1, $2, $3, 'pendiente')
        RETURNING *
    `, [solicitud_id, responsable_id, observaciones]);
    return result.rows[0];
};

const completarDespacho = async (despacho_id, observaciones = '') => {
    const result = await pgPool.query(`
        UPDATE despachos_bodega 
        SET 
            estado = 'completado',
            fecha_despacho = NOW(),
            observaciones = COALESCE($1, observaciones)
        WHERE id = $2
        RETURNING *
    `, [observaciones, despacho_id]);
    return result.rows[0];
};

// ============================================================
// 6. DEVOLUCIONES
// ============================================================

const crearDevolucion = async (data) => {
    const { solicitud_id, tipo, vendedor_id, tecnico_id, observaciones } = data;
    
    const result = await pgPool.query(`
        INSERT INTO devoluciones (
            solicitud_id,
            tipo,
            vendedor_id,
            tecnico_id,
            observaciones,
            estado
        ) VALUES ($1, $2, $3, $4, $5, 'pendiente')
        RETURNING *
    `, [solicitud_id, tipo, vendedor_id, tecnico_id, observaciones]);
    return result.rows[0];
};

const completarDevolucion = async (devolucion_id, observaciones = '') => {
    const result = await pgPool.query(`
        UPDATE devoluciones 
        SET 
            estado = 'completado',
            observaciones = COALESCE($1, observaciones),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [observaciones, devolucion_id]);
    return result.rows[0];
};

// ============================================================
// 7. EXPORTAR DATOS PARA INVENTARIO (Excel)
// ============================================================

const exportarParaInventario = async (solicitud_id) => {
    const result = await pgPool.query(`
        SELECT 
            s.numero_solicitud,
            c.razon_social as cliente_nombre,
            c.documento as cliente_documento,
            s.fecha_inicio,
            s.fecha_fin,
            p.codigo as sku,
            p.nombre as producto_nombre,
            ps.serial as sn,
            ai.cantidad,
            ai.estado_revision
        FROM solicitudes_alquiler s
        LEFT JOIN sync_clientes c ON s.cliente_id = c.id_externo
        LEFT JOIN alquiler_items ai ON s.id = ai.solicitud_id
        LEFT JOIN sync_productos p ON ai.producto_id = p.id_externo
        LEFT JOIN productos_seriales ps ON ai.serial_id = ps.id
        WHERE s.id = $1
        ORDER BY p.codigo
    `, [solicitud_id]);
    return result.rows;
};

module.exports = {
    crearSolicitud,
    getSolicitudes,
    getSolicitudById,
    actualizarEstadoSolicitud,
    aprobarDocumentacion,
    agregarItemAlquiler,
    getItemsBySolicitud,
    asignarTecnicoItem,
    crearNotificacion,
    getNotificaciones,
    marcarNotificacionLeida,
    marcarTodasLeidas,
    contarNotificacionesNoLeidas,
    crearRevisionTecnica,
    getRevisionesByItem,
    crearDespacho,
    completarDespacho,
    crearDevolucion,
    completarDevolucion,
    exportarParaInventario
};