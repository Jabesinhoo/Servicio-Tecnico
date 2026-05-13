// backend/src/controllers/tipo-servicio.controller.js
const pool = require('../db/pool');

// Obtener todos los tipos de servicio
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tipos_servicio 
      ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting tipos servicio:', error);
    res.status(500).json({ message: 'Error al obtener los tipos de servicio' });
  }
};

// Obtener tipos de servicio activos
exports.getActivos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tipos_servicio 
      WHERE activo = true 
      ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting active tipos servicio:', error);
    res.status(500).json({ message: 'Error al obtener los tipos de servicio' });
  }
};

// Obtener por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM tipos_servicio WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting tipo servicio:', error);
    res.status(500).json({ message: 'Error al obtener el tipo de servicio' });
  }
};

// Crear tipo de servicio
exports.create = async (req, res) => {
  try {
    const { nombre, descripcion, valor_base, duracion_estimada, 
            requiere_diagnostico, requiere_repuestos, requiere_aprobacion, 
            categoria, activo } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    
    const result = await pool.query(`
      INSERT INTO tipos_servicio (
        id, nombre, descripcion, valor_base, duracion_estimada,
        requiere_diagnostico, requiere_repuestos, requiere_aprobacion,
        categoria, activo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *
    `, [nombre, descripcion, valor_base || 0, duracion_estimada || 60,
        requiere_diagnostico || false, requiere_repuestos || false, requiere_aprobacion || false,
        categoria, activo !== false]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tipo servicio:', error);
    res.status(500).json({ message: 'Error al crear el tipo de servicio' });
  }
};

// Actualizar tipo de servicio
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, valor_base, duracion_estimada, 
            requiere_diagnostico, requiere_repuestos, requiere_aprobacion, 
            categoria, activo } = req.body;
    
    const result = await pool.query(`
      UPDATE tipos_servicio 
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          valor_base = COALESCE($3, valor_base),
          duracion_estimada = COALESCE($4, duracion_estimada),
          requiere_diagnostico = COALESCE($5, requiere_diagnostico),
          requiere_repuestos = COALESCE($6, requiere_repuestos),
          requiere_aprobacion = COALESCE($7, requiere_aprobacion),
          categoria = COALESCE($8, categoria),
          activo = COALESCE($9, activo),
          "updatedAt" = NOW()
      WHERE id = $10
      RETURNING *
    `, [nombre, descripcion, valor_base, duracion_estimada,
        requiere_diagnostico, requiere_repuestos, requiere_aprobacion,
        categoria, activo, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tipo servicio:', error);
    res.status(500).json({ message: 'Error al actualizar el tipo de servicio' });
  }
};


exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      DELETE FROM tipos_servicio WHERE id = $1 RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    res.json({ message: 'Tipo de servicio eliminado permanentemente' });
  } catch (error) {
    console.error('Error deleting tipo servicio:', error);
    res.status(500).json({ message: 'Error al eliminar el tipo de servicio' });
  }
};