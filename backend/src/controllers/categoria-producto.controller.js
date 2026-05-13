// backend/src/controllers/categoria-producto.controller.js
const pool = require('../db/pool');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM categorias_productos 
      WHERE activo = true 
      ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting categorias:', error);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
};

exports.create = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const result = await pool.query(`
      INSERT INTO categorias_productos (id, nombre, descripcion, activo, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
      RETURNING *
    `, [nombre, descripcion]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating categoria:', error);
    res.status(500).json({ message: 'Error al crear categoría' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;
    const result = await pool.query(`
      UPDATE categorias_productos 
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          activo = COALESCE($3, activo),
          "updatedAt" = NOW()
      WHERE id = $4
      RETURNING *
    `, [nombre, descripcion, activo, id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating categoria:', error);
    res.status(500).json({ message: 'Error al actualizar categoría' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM categorias_productos WHERE id = $1`, [id]);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error deleting categoria:', error);
    res.status(500).json({ message: 'Error al eliminar categoría' });
  }
};