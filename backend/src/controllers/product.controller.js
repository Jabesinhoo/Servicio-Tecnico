// backend/src/controllers/product.controller.js
const pool = require('../db/pool');

// Obtener todos los productos
exports.getAll = async (req, res) => {
  try {
    const { tipo, search } = req.query;
    let query = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM products p
      LEFT JOIN categorias_productos c ON p.categoria_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (tipo) {
      query += ` AND p.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    if (search) {
      query += ` AND (p.nombre ILIKE $${paramIndex++} OR p.codigo ILIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.nombre ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

// Obtener producto por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM products p
      LEFT JOIN categorias_productos c ON p.categoria_id = c.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ message: 'Error al obtener producto' });
  }
};



exports.create = async (req, res) => {
  try {
    const {
      codigo, nombre, descripcion, tipo, precio_venta, costo,
      stock_actual, stock_minimo, proveedor, categoria_id, imagenes
    } = req.body;

    if (!codigo || !nombre || !tipo) {
      return res.status(400).json({ message: 'Código, nombre y tipo son requeridos' });
    }

    // Manejar categoria_id: si es string vacío o null, poner null
    const categoriaIdValue = (categoria_id && categoria_id !== '') ? categoria_id : null;

    // Limpiar las imágenes para guardar solo los datos necesarios
    const imagenesLimpias = (imagenes || []).map(img => ({
      id: img.id,
      url: img.url,
      name: img.name
    }));

    const result = await pool.query(`
      INSERT INTO products (
        id, codigo, nombre, descripcion, tipo, precio_venta, costo,
        stock_actual, stock_minimo, proveedor, categoria_id, imagenes,
        estado, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW()
      )
      RETURNING *
    `, [codigo, nombre, descripcion, tipo, precio_venta || 0, costo || 0,
        stock_actual || 0, stock_minimo || 0, proveedor || null, categoriaIdValue, JSON.stringify(imagenesLimpias)]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Error al crear producto: ' + error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo, nombre, descripcion, tipo, precio_venta, costo,
      stock_actual, stock_minimo, proveedor, categoria_id, imagenes, estado
    } = req.body;

    // Manejar categoria_id: si es string vacío o null, poner null
    const categoriaIdValue = (categoria_id && categoria_id !== '') ? categoria_id : null;

    // Limpiar las imágenes
    const imagenesLimpias = (imagenes || []).map(img => ({
      id: img.id,
      url: img.url,
      name: img.name
    }));

    const result = await pool.query(`
      UPDATE products 
      SET codigo = COALESCE($1, codigo),
          nombre = COALESCE($2, nombre),
          descripcion = COALESCE($3, descripcion),
          tipo = COALESCE($4, tipo),
          precio_venta = COALESCE($5, precio_venta),
          costo = COALESCE($6, costo),
          stock_actual = COALESCE($7, stock_actual),
          stock_minimo = COALESCE($8, stock_minimo),
          proveedor = COALESCE($9, proveedor),
          categoria_id = $10,
          imagenes = $11,
          estado = COALESCE($12, estado),
          "updatedAt" = NOW()
      WHERE id = $13
      RETURNING *
    `, [codigo, nombre, descripcion, tipo, precio_venta, costo,
        stock_actual, stock_minimo, proveedor, categoriaIdValue, JSON.stringify(imagenesLimpias), estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error al actualizar producto: ' + error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo, nombre, descripcion, tipo, precio_venta, costo,
      stock_actual, stock_minimo, proveedor, categoria_id, imagenes, estado
    } = req.body;

    // Limpiar las imágenes
    const imagenesLimpias = (imagenes || []).map(img => ({
      id: img.id,
      url: img.url,
      name: img.name
    }));

    const result = await pool.query(`
      UPDATE products 
      SET codigo = COALESCE($1, codigo),
          nombre = COALESCE($2, nombre),
          descripcion = COALESCE($3, descripcion),
          tipo = COALESCE($4, tipo),
          precio_venta = COALESCE($5, precio_venta),
          costo = COALESCE($6, costo),
          stock_actual = COALESCE($7, stock_actual),
          stock_minimo = COALESCE($8, stock_minimo),
          proveedor = COALESCE($9, proveedor),
          categoria_id = $10,
          imagenes = $11,
          estado = COALESCE($12, estado),
          "updatedAt" = NOW()
      WHERE id = $13
      RETURNING *
    `, [codigo, nombre, descripcion, tipo, precio_venta, costo,
        stock_actual, stock_minimo, proveedor, categoria_id, JSON.stringify(imagenesLimpias), estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error al actualizar producto: ' + error.message });
  }
};



exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`DELETE FROM products WHERE id = $1 RETURNING id`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
};

// Productos con stock bajo
exports.getLowStock = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM products p
      LEFT JOIN categorias_productos c ON p.categoria_id = c.id
      WHERE p.stock_actual <= p.stock_minimo AND p.estado = true
      ORDER BY (p.stock_minimo - p.stock_actual) DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting low stock products:', error);
    res.status(500).json({ message: 'Error al obtener productos con stock bajo' });
  }
};