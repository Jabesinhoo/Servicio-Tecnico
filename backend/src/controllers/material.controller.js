// backend/src/controllers/material.controller.js
const pool = require('../db/pool');

// Obtener materiales de un servicio
exports.getMaterialesByServicio = async (req, res) => {
  try {
    const { service_order_id } = req.params;
    const result = await pool.query(`
      SELECT 
        sm.*,
        p.codigo, p.nombre as producto_nombre, p.unidad_medida, p.tipo,
        u.nombre1 as tecnico_nombre, u.apellidos as tecnico_apellidos
      FROM servicio_materiales sm
      JOIN products p ON sm.product_id = p.id
      JOIN usuarios u ON sm.tecnico_id = u.id
      WHERE sm.service_order_id = $1
      ORDER BY sm.createdAt DESC
    `, [service_order_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al obtener materiales' });
  }
};

// Solicitar materiales para un servicio
exports.solicitarMateriales = async (req, res) => {
  try {
    const { service_order_id } = req.params;
    const { materiales } = req.body; // Array de {product_id, cantidad_solicitada, observaciones}
    const tecnico_id = req.user.id;

    const resultados = [];
    
    for (const material of materiales) {
      const result = await pool.query(`
        INSERT INTO servicio_materiales (
          service_order_id, product_id, cantidad_solicitada, 
          tecnico_id, observaciones, fecha_entrega
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [service_order_id, material.product_id, material.cantidad_solicitada, 
          tecnico_id, material.observaciones]);
      resultados.push(result.rows[0]);
    }
    
    res.status(201).json(resultados);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al solicitar materiales' });
  }
};

// Entregar materiales (inventario)
exports.entregarMateriales = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_entregada } = req.body;
    
    // Actualizar la entrega
    const result = await pool.query(`
      UPDATE servicio_materiales 
      SET cantidad_entregada = $1,
          fecha_entrega = NOW(),
          "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
    `, [cantidad_entregada, id]);
    
    // Descontar del inventario
    if (result.rows[0]) {
      await pool.query(`
        UPDATE products 
        SET stock_actual = stock_actual - $1,
            "updatedAt" = NOW()
        WHERE id = $2
      `, [cantidad_entregada, result.rows[0].product_id]);
      
      // Registrar movimiento de inventario
      await pool.query(`
        INSERT INTO inventory_movements (
          product_id, tipo_movimiento, origen_tipo, origen_id,
          cantidad, usuario_id, observaciones, fecha
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [result.rows[0].product_id, 'salida', 'servicio', result.rows[0].service_order_id,
          cantidad_entregada, req.user.id, `Entrega para servicio`]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al entregar materiales' });
  }
};

// Reportar uso de materiales (técnico)
exports.reportarUso = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_usada, cantidad_devuelta, cantidad_desperdiciada, observaciones } = req.body;
    const tecnico_id = req.user.id;
    
    const result = await pool.query(`
      UPDATE servicio_materiales 
      SET cantidad_usada = $1,
          cantidad_devuelta = $2,
          cantidad_desperdiciada = $3,
          observaciones = COALESCE($4, observaciones),
          fecha_devolucion = NOW(),
          "updatedAt" = NOW()
      WHERE id = $5 AND tecnico_id = $6
      RETURNING *
    `, [cantidad_usada, cantidad_devuelta, cantidad_desperdiciada, 
        observaciones, id, tecnico_id]);
    
    // Devolver al inventario lo que no se usó
    if (result.rows[0] && cantidad_devuelta > 0) {
      await pool.query(`
        UPDATE products 
        SET stock_actual = stock_actual + $1
        WHERE id = $2
      `, [cantidad_devuelta, result.rows[0].product_id]);
      
      // Registrar movimiento de devolución
      await pool.query(`
        INSERT INTO inventory_movements (
          product_id, tipo_movimiento, origen_tipo, origen_id,
          cantidad, usuario_id, observaciones, fecha
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [result.rows[0].product_id, 'entrada', 'servicio_devolucion', result.rows[0].service_order_id,
          cantidad_devuelta, tecnico_id, `Devolución de materiales no usados`]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al reportar uso' });
  }
};

// Obtener resumen de consumo por técnico
exports.getConsumoTecnico = async (req, res) => {
  try {
    const { tecnico_id, fechaInicio, fechaFin } = req.query;
    
    let query = `
      SELECT 
        u.id as tecnico_id,
        u.nombre1, u.apellidos,
        p.id as producto_id,
        p.codigo, p.nombre as producto_nombre,
        SUM(sm.cantidad_entregada) as total_entregado,
        SUM(sm.cantidad_usada) as total_usado,
        SUM(sm.cantidad_devuelta) as total_devuelto,
        SUM(sm.cantidad_desperdiciada) as total_desperdiciado,
        COUNT(DISTINCT sm.service_order_id) as servicios_atendidos
      FROM servicio_materiales sm
      JOIN usuarios u ON sm.tecnico_id = u.id
      JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (tecnico_id) {
      query += ` AND sm.tecnico_id = $${paramIndex++}`;
      params.push(tecnico_id);
    }
    
    if (fechaInicio) {
      query += ` AND sm.fecha_entrega >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      query += ` AND sm.fecha_entrega <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    query += ` GROUP BY u.id, u.nombre1, u.apellidos, p.id, p.codigo, p.nombre
               ORDER BY total_entregado DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al obtener consumo' });
  }
};