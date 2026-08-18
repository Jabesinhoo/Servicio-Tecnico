// backend/src/controllers/user.controller.js
const { Usuario, Role, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

// ============================================================
// OBTENER TODOS LOS USUARIOS
// ============================================================
const getUsers = async (req, res) => {
  try {
    const users = await Usuario.findAll({
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
    });
    
    // Formatear respuesta para incluir nombre completo
    const formattedUsers = users.map(user => ({
      ...user.toJSON(),
      nombre_completo: user.getNombreCompleto(),
    }));
    
    res.json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message,
    });
  }
};

// ============================================================
// OBTENER USUARIO POR ID
// ============================================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      },
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message,
    });
  }
};

// ============================================================
// CREAR USUARIO
// ============================================================
const createUser = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { 
      nombre1, nombre2, apellidos, email, password, 
      usuario, cedula, celular, role_id, rol 
    } = req.body;
    
    // Validaciones
    if (!email || !password) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos',
      });
    }
    
    // Verificar si el email ya existe
    const existingUser = await Usuario.findOne({
      where: { email },
      transaction: t,
    });
    
    if (existingUser) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con ese email',
      });
    }
    
    // Verificar si el usuario ya existe
    if (usuario) {
      const existingUsuario = await Usuario.findOne({
        where: { usuario },
        transaction: t,
      });
      
      if (existingUsuario) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese nombre de usuario',
        });
      }
    }
    
    // Verificar si la cédula ya existe
    if (cedula) {
      const existingCedula = await Usuario.findOne({
        where: { cedula },
        transaction: t,
      });
      
      if (existingCedula) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con esa cédula',
        });
      }
    }
    
    // Verificar que el rol existe si se proporciona
    let roleId = role_id;
    let roleName = rol;
    
    if (roleId) {
      const role = await Role.findByPk(roleId, { transaction: t });
      if (!role) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Rol no encontrado',
        });
      }
      roleName = role.name;
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario
    const user = await Usuario.create({
      nombre1: nombre1 || null,
      nombre2: nombre2 || null,
      apellidos: apellidos || null,
      email,
      password: hashedPassword,
      usuario: usuario || null,
      cedula: cedula || null,
      celular: celular || null,
      role_id: roleId || null,
      rol: roleName || 'usuario',
      activo: true,
    }, { transaction: t });
    
    await t.commit();
    
    // Obtener usuario creado con su rol
    const createdUser = await Usuario.findByPk(user.id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
    
    res.status(201).json({
      success: true,
      data: {
        ...createdUser.toJSON(),
        nombre_completo: createdUser.getNombreCompleto(),
      },
      message: 'Usuario creado exitosamente',
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message,
    });
  }
};

// ============================================================
// ACTUALIZAR USUARIO
// ============================================================
const updateUser = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { 
      nombre1, nombre2, apellidos, email, password, 
      usuario, cedula, celular, role_id, rol, activo 
    } = req.body;
    
    const user = await Usuario.findByPk(id, { transaction: t });
    
    if (!user) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // Verificar si el email ya existe (excepto el mismo usuario)
    if (email && email !== user.email) {
      const existingUser = await Usuario.findOne({
        where: { email },
        transaction: t,
      });
      
      if (existingUser) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese email',
        });
      }
    }
    
    // Verificar si el usuario ya existe
    if (usuario && usuario !== user.usuario) {
      const existingUsuario = await Usuario.findOne({
        where: { usuario },
        transaction: t,
      });
      
      if (existingUsuario) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese nombre de usuario',
        });
      }
    }
    
    // Verificar si la cédula ya existe
    if (cedula && cedula !== user.cedula) {
      const existingCedula = await Usuario.findOne({
        where: { cedula },
        transaction: t,
      });
      
      if (existingCedula) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con esa cédula',
        });
      }
    }
    
    // Verificar que el rol existe si se proporciona
    let roleId = role_id;
    let roleName = rol;
    
    if (roleId) {
      const role = await Role.findByPk(roleId, { transaction: t });
      if (!role) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Rol no encontrado',
        });
      }
      roleName = role.name;
    }
    
    // Preparar datos para actualizar
    const updateData = {
      nombre1: nombre1 !== undefined ? nombre1 : user.nombre1,
      nombre2: nombre2 !== undefined ? nombre2 : user.nombre2,
      apellidos: apellidos !== undefined ? apellidos : user.apellidos,
      email: email || user.email,
      usuario: usuario !== undefined ? usuario : user.usuario,
      cedula: cedula !== undefined ? cedula : user.cedula,
      celular: celular !== undefined ? celular : user.celular,
      role_id: roleId !== undefined ? roleId : user.role_id,
      rol: roleName || user.rol,
      activo: activo !== undefined ? activo : user.activo,
    };
    
    // Si se proporciona contraseña, hashearla
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.password_changed_at = new Date();
    }
    
    await user.update(updateData, { transaction: t });
    await t.commit();
    
    // Obtener usuario actualizado con su rol
    const updatedUser = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
    
    res.json({
      success: true,
      data: {
        ...updatedUser.toJSON(),
        nombre_completo: updatedUser.getNombreCompleto(),
      },
      message: 'Usuario actualizado exitosamente',
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message,
    });
  }
};

// ============================================================
// ELIMINAR USUARIO (SOFT DELETE)
// ============================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await Usuario.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // No permitir eliminar al propio usuario
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminarte a ti mismo',
      });
    }
    
    await user.update({ activo: false });
    
    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario',
      error: error.message,
    });
  }
};

// ============================================================
// ASIGNAR ROL A USUARIO
// ============================================================
const assignRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;
    
    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del rol es requerido',
      });
    }
    
    const user = await Usuario.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    const role = await Role.findByPk(role_id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }
    
    await user.update({ 
      role_id, 
      rol: role.name 
    });
    
    // Obtener usuario actualizado
    const updatedUser = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
    
    res.json({
      success: true,
      data: {
        ...updatedUser.toJSON(),
        nombre_completo: updatedUser.getNombreCompleto(),
      },
      message: 'Rol asignado exitosamente',
    });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar rol',
      error: error.message,
    });
  }
};

// ============================================================
// OBTENER USUARIOS POR ROL
// ============================================================
const getUsersByRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    
    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del rol es requerido',
      });
    }
    
    const users = await Usuario.findByRole(roleName);
    
    res.json({
      success: true,
      data: users.map(user => ({
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      })),
    });
  } catch (error) {
    console.error('Error al obtener usuarios por rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios por rol',
      error: error.message,
    });
  }
};

// ============================================================
// CAMBIAR CONTRASEÑA
// ============================================================
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva son requeridas',
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
    }
    
    const user = await Usuario.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta',
      });
    }
    
    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await user.update({
      password: hashedPassword,
      password_changed_at: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTAR
// ============================================================
module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRole,
  getUsersByRole,
  changePassword,
};