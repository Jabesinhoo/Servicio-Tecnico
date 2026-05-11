// backend/src/controllers/user.controller.js
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios
exports.getAll = async (req, res) => {
  try {
    const { rol } = req.query;
    let query = `
      SELECT id, nombre1, nombre2, apellidos, usuario, email, cedula, celular, rol, activo, "createdAt"
      FROM usuarios 
      WHERE 1=1
    `;
    const params = [];
    
    if (rol) {
      query += ` AND rol = $1`;
      params.push(rol);
    }
    
    query += ` ORDER BY nombre1 ASC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// Obtener usuarios por rol (endpoint específico)
exports.getByRole = async (req, res) => {
  try {
    const { rol } = req.query;
    
    if (!rol) {
      return res.status(400).json({ message: 'El rol es requerido' });
    }
    
    const result = await pool.query(`
      SELECT id, nombre1, nombre2, apellidos, usuario, email, cedula, celular, rol, activo, "createdAt"
      FROM usuarios 
      WHERE rol = $1 AND activo = true
      ORDER BY nombre1 ASC
    `, [rol]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ message: 'Error al obtener usuarios por rol' });
  }
};

// Obtener usuario por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, nombre1, nombre2, apellidos, usuario, email, cedula, celular, rol, activo, "createdAt"
      FROM usuarios 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

// Crear usuario
exports.create = async (req, res) => {
  try {
    const { nombre1, nombre2, apellidos, usuario, cedula, email, celular, password, rol } = req.body;
    
    // Validaciones
    if (!nombre1 || !apellidos || !usuario || !cedula || !email || !password) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener mínimo 6 caracteres' });
    }
    
    // Verificar existencia
    const existing = await pool.query(`
      SELECT id FROM usuarios WHERE usuario = $1 OR email = $2 OR cedula = $3
    `, [usuario, email, cedula]);
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Usuario, email o cédula ya existen' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(`
      INSERT INTO usuarios (
        id, nombre1, nombre2, apellidos, usuario, cedula, email, celular, password, rol, activo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()
      )
      RETURNING id, nombre1, nombre2, apellidos, usuario, email, rol
    `, [nombre1, nombre2 || null, apellidos, usuario, cedula, email, celular || null, hashedPassword, rol || 'usuario']);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// Actualizar usuario
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre1, nombre2, apellidos, celular, rol, activo, password } = req.body;
    
    let query = `
      UPDATE usuarios 
      SET nombre1 = COALESCE($1, nombre1),
          nombre2 = COALESCE($2, nombre2),
          apellidos = COALESCE($3, apellidos),
          celular = COALESCE($4, celular),
          rol = COALESCE($5, rol),
          activo = COALESCE($6, activo),
          "updatedAt" = NOW()
    `;
    const params = [nombre1, nombre2, apellidos, celular, rol, activo];
    let paramIndex = 7;
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $${paramIndex++}`;
      params.push(hashedPassword);
    }
    
    query += ` WHERE id = $${paramIndex} RETURNING id, nombre1, nombre2, apellidos, usuario, email, rol, activo`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// Eliminar usuario (soft delete)
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE usuarios SET activo = false, "updatedAt" = NOW()
      WHERE id = $1 RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error al desactivar usuario' });
  }
};