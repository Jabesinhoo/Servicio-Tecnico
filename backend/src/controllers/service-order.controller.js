// backend/src/controllers/service-order.controller.js
const pool = require('../db/pool');

// Listar OS con filtros
exports.list = async (req, res) => {
  try {
    const { estado, tecnico_id, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.rol;

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (estado) {
      whereClauses.push(`so.estado = $${paramIndex++}`);
      params.push(estado);
    }

    if (tecnico_id) {
      whereClauses.push(`so.tecnico_id = $${paramIndex++}`);
      params.push(tecnico_id);
    }

    if (userRole === 'tecnico') {
      whereClauses.push(`so.tecnico_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        so.*,
        c.nombre_razon_social as cliente_nombre,
        u.usuario as tecnico_nombre
      FROM service_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      ${whereSql}
      ORDER BY so."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    const countQuery = `
      SELECT COUNT(*)::int as total 
      FROM service_orders so
      ${whereSql}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.rows[0]?.total || 0,
        pages: Math.ceil((countResult.rows[0]?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error listing service orders:', error);
    res.status(500).json({ message: 'Error al listar órdenes de servicio' });
  }
};

// Obtener OS por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const osQuery = `
      SELECT 
        so.*,
        c.nombre_razon_social as cliente_nombre,
        c.documento as cliente_documento,
        c.telefono as cliente_telefono,
        c.email as cliente_email,
        c.direccion as cliente_direccion,
        u.usuario as tecnico_nombre
      FROM service_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      WHERE so.id = $1
    `;
    const osResult = await pool.query(osQuery, [id]);

    if (osResult.rows.length === 0) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    res.json(osResult.rows[0]);
  } catch (error) {
    console.error('Error getting service order:', error);
    res.status(500).json({ message: 'Error al obtener la orden de servicio' });
  }
};

// Crear nueva OS
exports.create = async (req, res) => {
  try {
    const { client_id, descripcion_inicial, origen_tipo = 'tecnico', origen_id = null } = req.body;

    if (!client_id) {
      return res.status(400).json({ message: 'El cliente es requerido' });
    }

    const year = new Date().getFullYear();
    const countQuery = `SELECT COUNT(*)::int as count FROM service_orders WHERE EXTRACT(YEAR FROM "createdAt") = $1`;
    const countResult = await pool.query(countQuery, [year]);
    const nextNumber = (countResult.rows[0]?.count || 0) + 1;
    const codigo_os = `OS-${year}-${String(nextNumber).padStart(4, '0')}`;

    const query = `
      INSERT INTO service_orders (
        codigo_os, client_id, origen_tipo, origen_id,
        descripcion_inicial, estado, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      codigo_os, client_id, origen_tipo, origen_id,
      descripcion_inicial || null, 'pendiente'
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service order:', error);
    res.status(500).json({ message: 'Error al crear la orden de servicio' });
  }
};

// Cambiar estado de OS
exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const validStates = ['pendiente', 'asignada', 'en_ejecucion', 'en_espera', 'cerrada'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    const query = `
      UPDATE service_orders 
      SET estado = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error changing status:', error);
    res.status(500).json({ message: 'Error al cambiar el estado' });
  }
};

// Asignar técnico
exports.assignTech = async (req, res) => {
  try {
    const { id } = req.params;
    const { tecnico_id } = req.body;

    if (!tecnico_id) {
      return res.status(400).json({ message: 'El técnico es requerido' });
    }

    const query = `
      UPDATE service_orders 
      SET tecnico_id = $1, 
          estado = 'asignada',
          fecha_asignacion = NOW(),
          "updatedAt" = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [tecnico_id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning technician:', error);
    res.status(500).json({ message: 'Error al asignar técnico' });
  }
};

// Agregar repuesto usado
exports.addPart = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, cantidad, observaciones } = req.body;
    const userId = req.user.id;

    if (!product_id || !cantidad) {
      return res.status(400).json({ message: 'Producto y cantidad son requeridos' });
    }

    const stockQuery = `SELECT stock_actual FROM products WHERE id = $1`;
    const stockResult = await pool.query(stockQuery, [product_id]);

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (stockResult.rows[0].stock_actual < cantidad) {
      return res.status(400).json({ message: 'Stock insuficiente' });
    }

    const movementQuery = `
      INSERT INTO inventory_movements (
        product_id, tipo_movimiento, origen_tipo, origen_id,
        cantidad, usuario_id, observaciones, fecha, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING *
    `;
    await pool.query(movementQuery, [
      product_id, 'salida', 'servicio', id,
      cantidad, userId, observaciones || null
    ]);

    const updateStock = `UPDATE products SET stock_actual = stock_actual - $1 WHERE id = $2`;
    await pool.query(updateStock, [cantidad, product_id]);

    res.status(201).json({ message: 'Repuesto agregado correctamente' });
  } catch (error) {
    console.error('Error adding part:', error);
    res.status(500).json({ message: 'Error al agregar repuesto' });
  }
};

// Actualizar OS (diagnóstico, observaciones)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnostico_final, observaciones } = req.body;

    const query = `
      UPDATE service_orders 
      SET diagnostico_final = COALESCE($1, diagnostico_final),
          observaciones = COALESCE($2, observaciones),
          "updatedAt" = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [diagnostico_final, observaciones, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service order:', error);
    res.status(500).json({ message: 'Error al actualizar la orden' });
  }
};

// Eliminar OS
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `DELETE FROM service_orders WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    res.json({ message: 'Orden de servicio eliminada' });
  } catch (error) {
    console.error('Error deleting service order:', error);
    res.status(500).json({ message: 'Error al eliminar la orden' });
  }
};