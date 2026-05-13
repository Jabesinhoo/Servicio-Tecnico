// backend/src/controllers/report.controller.js
const pool = require('../db/pool');

// Reportes de Ventas
exports.getVentasDiarias = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const result = await pool.query(`
      SELECT 
        DATE("createdAt") as fecha,
        COUNT(*) as cantidad,
        COALESCE(SUM(total_general), 0) as total
      FROM sales_orders
      WHERE estado = 'confirmada'
        AND ($1::date IS NULL OR DATE("createdAt") >= $1)
        AND ($2::date IS NULL OR DATE("createdAt") <= $2)
      GROUP BY DATE("createdAt")
      ORDER BY fecha DESC
    `, [fechaInicio || null, fechaFin || null]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getVentasMensuales = async (req, res) => {
  try {
    const { year } = req.query;
    const año = year || new Date().getFullYear();
    const result = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as mes,
        COUNT(*) as cantidad,
        COALESCE(SUM(total_general), 0) as total
      FROM sales_orders
      WHERE estado = 'confirmada'
        AND EXTRACT(YEAR FROM "createdAt") = $1
      GROUP BY EXTRACT(MONTH FROM "createdAt")
      ORDER BY mes ASC
    `, [año]);
    
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const data = result.rows.map(r => ({
      mes: meses[r.mes - 1],
      cantidad: parseInt(r.cantidad),
      total: parseFloat(r.total)
    }));
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getProductosMasVendidos = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const result = await pool.query(`
      SELECT 
        p.id, p.codigo, p.nombre, p.tipo,
        COALESCE(SUM(soi.cantidad), 0) as cantidad_vendida,
        COALESCE(SUM(soi.subtotal), 0) as total_ventas
      FROM products p
      LEFT JOIN sales_order_items soi ON p.id = soi.product_id
      LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.estado = 'confirmada'
      GROUP BY p.id, p.codigo, p.nombre, p.tipo
      ORDER BY cantidad_vendida DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getVentasPorVendedor = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.nombre1, u.apellidos, u.usuario,
        COUNT(so.id) as cantidad_ventas,
        COALESCE(SUM(so.total_general), 0) as total_ventas
      FROM usuarios u
      LEFT JOIN sales_orders so ON u.id = so.vendedor_id AND so.estado = 'confirmada'
      WHERE u.rol = 'ventas' OR u.rol = 'admin'
      GROUP BY u.id, u.nombre1, u.apellidos, u.usuario
      ORDER BY total_ventas DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

// Reportes de Servicios
exports.getServiciosPorEstado = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as cantidad
      FROM service_orders
      GROUP BY estado
      ORDER BY 
        CASE estado
          WHEN 'pendiente' THEN 1
          WHEN 'asignada' THEN 2
          WHEN 'en_ejecucion' THEN 3
          WHEN 'en_espera' THEN 4
          WHEN 'cerrada' THEN 5
        END
    `);
    
    const estadosMap = {
      pendiente: 'Pendiente',
      asignada: 'Asignada',
      en_ejecucion: 'En Ejecución',
      en_espera: 'En Espera',
      cerrada: 'Cerrada'
    };
    
    const data = result.rows.map(r => ({
      estado: estadosMap[r.estado] || r.estado,
      cantidad: parseInt(r.cantidad)
    }));
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getServiciosPorTecnico = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.nombre1, u.apellidos, u.usuario,
        COUNT(so.id) as total_servicios,
        COUNT(CASE WHEN so.estado = 'cerrada' THEN 1 END) as completados,
        COUNT(CASE WHEN so.estado = 'pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN so.estado = 'en_ejecucion' THEN 1 END) as en_ejecucion
      FROM usuarios u
      LEFT JOIN service_orders so ON u.id = so.tecnico_id
      WHERE u.rol = 'tecnico'
      GROUP BY u.id, u.nombre1, u.apellidos, u.usuario
      ORDER BY total_servicios DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getTiemposServicio = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        so.id, so.codigo_os,
        so."createdAt" as fecha_creacion,
        so.fecha_asignacion,
        so.fecha_inicio,
        so.fecha_fin,
        EXTRACT(EPOCH FROM (so.fecha_fin - so.fecha_inicio))/3600 as horas_trabajadas
      FROM service_orders so
      WHERE so.estado = 'cerrada'
        AND so.fecha_inicio IS NOT NULL
        AND so.fecha_fin IS NOT NULL
      ORDER BY so."createdAt" DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getRepuestosMasUsados = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.codigo, p.nombre,
        COALESCE(SUM(im.cantidad), 0) as cantidad_usada
      FROM products p
      LEFT JOIN inventory_movements im ON p.id = im.product_id 
        AND im.origen_tipo = 'servicio'
      WHERE p.tipo = 'repuesto' OR p.tipo = 'herramienta'
      GROUP BY p.id, p.codigo, p.nombre
      ORDER BY cantidad_usada DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

// Reportes de Inventario
exports.getStockActual = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.codigo, p.nombre, p.tipo,
        p.stock_actual, p.stock_minimo,
        c.nombre as categoria,
        p.precio_venta,
        (p.stock_actual * p.costo) as valor_inventario
      FROM products p
      LEFT JOIN categorias_productos c ON p.categoria_id = c.id
      WHERE p.estado = true
      ORDER BY p.nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getStockBajo = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.codigo, p.nombre, p.tipo,
        p.stock_actual, p.stock_minimo,
        (p.stock_minimo - p.stock_actual) as faltante,
        c.nombre as categoria
      FROM products p
      LEFT JOIN categorias_productos c ON p.categoria_id = c.id
      WHERE p.stock_actual <= p.stock_minimo AND p.estado = true
      ORDER BY (p.stock_minimo - p.stock_actual) DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getMovimientosStock = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const result = await pool.query(`
      SELECT 
        im.*,
        p.codigo, p.nombre,
        u.usuario as usuario_nombre
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN usuarios u ON im.usuario_id = u.id
      WHERE ($1::date IS NULL OR DATE(im.fecha) >= $1)
        AND ($2::date IS NULL OR DATE(im.fecha) <= $2)
      ORDER BY im.fecha DESC
      LIMIT 100
    `, [fechaInicio || null, fechaFin || null]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

exports.getValorInventario = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(stock_actual * costo), 0) as valor_total,
        COALESCE(SUM(stock_actual * precio_venta), 0) as valor_venta,
        COUNT(*) as total_productos,
        COUNT(CASE WHEN stock_actual <= stock_minimo THEN 1 END) as productos_stock_bajo
      FROM products
      WHERE estado = true
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

// Reportes de Clientes
exports.getClientesFrecuentes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        CASE 
          WHEN c.tipo_persona = 'juridica' THEN c.razon_social
          ELSE CONCAT(c.primer_nombre, ' ', c.primer_apellido)
        END as nombre,
        c.documento, c.telefono,
        COUNT(DISTINCT so.id) as total_servicios,
        COUNT(DISTINCT sso.id) as total_ventas,
        COALESCE(SUM(so.total_general), 0) as total_gastado
      FROM clients c
      LEFT JOIN service_orders so ON c.id = so.client_id
      LEFT JOIN sales_orders sso ON c.id = sso.client_id AND sso.estado = 'confirmada'
      GROUP BY c.id, c.tipo_persona, c.razon_social, c.primer_nombre, c.primer_apellido, c.documento, c.telefono
      ORDER BY total_gastado DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

// Reportes Financieros
exports.getIngresosGastos = async (req, res) => {
  try {
    const { year } = req.query;
    const año = year || new Date().getFullYear();
    const result = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as mes,
        COALESCE(SUM(CASE WHEN estado = 'confirmada' THEN total_general END), 0) as ingresos
      FROM sales_orders
      WHERE EXTRACT(YEAR FROM "createdAt") = $1
      GROUP BY EXTRACT(MONTH FROM "createdAt")
      ORDER BY mes ASC
    `, [año]);
    
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const data = result.rows.map(r => ({
      mes: meses[r.mes - 1],
      ingresos: parseFloat(r.ingresos)
    }));
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};

// Reportes de Rendimiento
exports.getRendimientoTecnicos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.nombre1, u.apellidos, u.usuario,
        COUNT(so.id) as total_servicios,
        COUNT(CASE WHEN so.estado = 'cerrada' THEN 1 END) as completados,
        ROUND(COUNT(CASE WHEN so.estado = 'cerrada' THEN 1 END)::numeric / NULLIF(COUNT(so.id), 0) * 100, 2) as tasa_exito,
        AVG(EXTRACT(EPOCH FROM (so.fecha_fin - so.fecha_inicio))/3600) as horas_promedio
      FROM usuarios u
      LEFT JOIN service_orders so ON u.id = so.tecnico_id
      WHERE u.rol = 'tecnico'
      GROUP BY u.id, u.nombre1, u.apellidos, u.usuario
      ORDER BY tasa_exito DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al generar reporte' });
  }
};