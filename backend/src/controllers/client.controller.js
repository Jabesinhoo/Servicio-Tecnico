// backend/src/controllers/client.controller.js
const pool = require('../db/pool');

// Obtener todos los clientes
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre_razon_social, documento, telefono, email, 
             direccion, ciudad, notas, "createdAt", "updatedAt"
      FROM clients 
      ORDER BY nombre_razon_social ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({ message: 'Error al obtener los clientes' });
  }
};

// Obtener cliente por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, nombre_razon_social, documento, telefono, email, 
             direccion, ciudad, notas, "createdAt", "updatedAt"
      FROM clients 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting client:', error);
    res.status(500).json({ message: 'Error al obtener el cliente' });
  }
};

// Crear cliente
exports.create = async (req, res) => {
  try {
    const { nombre_razon_social, documento, telefono, email, direccion, ciudad, notas } = req.body;
    
    if (!nombre_razon_social || nombre_razon_social.trim() === '') {
      return res.status(400).json({ message: 'La razón social es requerida' });
    }
    
    const result = await pool.query(`
      INSERT INTO clients (
        id, nombre_razon_social, documento, telefono, email, 
        direccion, ciudad, notas, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      )
      RETURNING id, nombre_razon_social, documento, telefono, email, direccion, ciudad, notas
    `, [nombre_razon_social, documento, telefono, email, direccion, ciudad, notas]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Error al crear el cliente' });
  }
};

// Actualizar cliente
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_razon_social, documento, telefono, email, direccion, ciudad, notas } = req.body;
    
    const result = await pool.query(`
      UPDATE clients 
      SET nombre_razon_social = $1,
          documento = $2,
          telefono = $3,
          email = $4,
          direccion = $5,
          ciudad = $6,
          notas = $7,
          "updatedAt" = NOW()
      WHERE id = $8
      RETURNING id, nombre_razon_social, documento, telefono, email, direccion, ciudad, notas
    `, [nombre_razon_social, documento, telefono, email, direccion, ciudad, notas, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Error al actualizar el cliente' });
  }
};

// Eliminar cliente
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Intentando eliminar cliente con ID:', id);
    
    const checkClient = await pool.query(`SELECT id FROM clients WHERE id = $1`, [id]);
    
    if (checkClient.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    // Eliminar órdenes de servicio asociadas
    await pool.query(`DELETE FROM service_orders WHERE client_id = $1`, [id]);
    
    // Eliminar cliente
    const result = await pool.query(`DELETE FROM clients WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    console.log('Cliente eliminado:', id);
    res.json({ message: 'Cliente eliminado correctamente' });
    
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Error al eliminar el cliente: ' + error.message });
  }
};

// Obtener estadísticas del cliente
exports.getClientStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Información básica del cliente
    const clientResult = await pool.query(`
      SELECT id, nombre_razon_social, documento, telefono, email, direccion, ciudad
      FROM clients WHERE id = $1
    `, [id]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    const cliente = clientResult.rows[0];
    
    // Total de servicios
    const totalServiciosResult = await pool.query(`
      SELECT COUNT(*)::int as total FROM service_orders WHERE client_id = $1
    `, [id]);
    
    // Servicios por estado
    const serviciosPorEstado = await pool.query(`
      SELECT estado, COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 
      GROUP BY estado
    `, [id]);
    
    // Servicios por tipo
    const serviciosPorTipo = await pool.query(`
      SELECT origen_tipo as tipo, COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 
      GROUP BY origen_tipo
    `, [id]);
    
    // Servicios por mes
    const serviciosPorMes = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as mes,
        EXTRACT(YEAR FROM "createdAt") as año,
        COUNT(*)::int as cantidad
      FROM service_orders 
      WHERE client_id = $1 
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY año, mes
      ORDER BY año DESC, mes DESC
    `, [id]);
    
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const serviciosPorMesFormateado = serviciosPorMes.rows.map(row => ({
      ...row,
      mes_nombre: `${mesesNombres[row.mes - 1]} ${row.año}`
    }));
    
    // Datos financieros
    const datosFinancieros = await pool.query(`
      SELECT 
        COALESCE(SUM(total_general), 0)::int as total_generado,
        COALESCE(AVG(total_general), 0)::int as promedio,
        COALESCE(MAX(total_general), 0)::int as maximo,
        COALESCE(MIN(total_general), 0)::int as minimo
      FROM service_orders 
      WHERE client_id = $1 AND estado = 'cerrada'
    `, [id]);
    
    // Servicios pendientes
    const serviciosPendientes = await pool.query(`
      SELECT COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 AND estado IN ('pendiente', 'asignada', 'en_ejecucion')
    `, [id]);
    
    // Servicios completados
    const serviciosCompletados = await pool.query(`
      SELECT COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 AND estado = 'cerrada'
    `, [id]);
    
    // Productos más comprados
    const productosMasComprados = await pool.query(`
      SELECT 
        p.id as producto_id,
        p.nombre,
        COALESCE(SUM(soi.cantidad), 0)::int as cantidad
      FROM products p
      LEFT JOIN sales_order_items soi ON p.id = soi.product_id
      LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.client_id = $1
      GROUP BY p.id, p.nombre
      HAVING COALESCE(SUM(soi.cantidad), 0) > 0
      ORDER BY cantidad DESC
      LIMIT 5
    `, [id]);
    
    res.json({
      cliente,
      totalServicios: totalServiciosResult.rows[0]?.total || 0,
      serviciosPorEstado: serviciosPorEstado.rows,
      serviciosPorTipo: serviciosPorTipo.rows,
      serviciosPorMes: serviciosPorMesFormateado,
      totalGenerado: datosFinancieros.rows[0]?.total_generado || 0,
      promedioPorServicio: datosFinancieros.rows[0]?.promedio || 0,
      servicioMasCaro: datosFinancieros.rows[0]?.maximo || 0,
      servicioMasBarato: datosFinancieros.rows[0]?.minimo || 0,
      serviciosPendientes: serviciosPendientes.rows[0]?.cantidad || 0,
      serviciosCompletados: serviciosCompletados.rows[0]?.cantidad || 0,
      productosMasComprados: productosMasComprados.rows,
    });
    
  } catch (error) {
    console.error('Error getting client stats:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del cliente' });
  }
};

// Obtener servicios del cliente
exports.getClientServiceOrders = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT so.*, u.usuario as tecnico_nombre
      FROM service_orders so
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      WHERE so.client_id = $1
      ORDER BY so."createdAt" DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting client services:', error);
    res.status(500).json({ message: 'Error al obtener servicios del cliente' });
  }
};