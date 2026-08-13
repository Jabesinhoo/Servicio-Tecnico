// backend/src/controllers/roles.js
const { Op } = require('sequelize');
const { Role, Permission, Usuario, sequelize } = require('../models');
// Obtener todos los roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      where: { active: true },
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      }],
    });
    
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles',
      error: error.message,
    });
  }
};

// Obtener rol por ID
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findByPk(id, {
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      }],
    });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }
    
    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rol',
      error: error.message,
    });
  }
};

// Crear nuevo rol
const createRole = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { name, description, is_default, permissions } = req.body;
    
    // Verificar si el nombre ya existe
    const existingRole = await Role.findOne({ 
      where: { name },
      transaction: t,
    });
    
    if (existingRole) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Ya existe un rol con ese nombre',
      });
    }
    
    // Si es rol por defecto, quitar el flag de otros roles
    if (is_default) {
      await Role.update(
        { is_default: false },
        { where: {}, transaction: t }
      );
    }
    
    // Crear el rol
    const role = await Role.create({
      name,
      description,
      is_default: is_default || false,
      active: true,
    }, { transaction: t });
    
    // Asignar permisos si se proporcionan
    if (permissions && permissions.length > 0) {
      await role.setPermissions(permissions, { transaction: t });
    }
    
    await t.commit();
    
    // Obtener el rol con sus permisos
    const createdRole = await Role.findByPk(role.id, {
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      }],
    });
    
    res.status(201).json({
      success: true,
      data: createdRole,
      message: 'Rol creado exitosamente',
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol',
      error: error.message,
    });
  }
};

// Actualizar rol
const updateRole = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { name, description, is_default, active, permissions } = req.body;
    
    const role = await Role.findByPk(id, { transaction: t });
    
    if (!role) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }
    
    // Verificar si el nombre ya existe (excepto el mismo rol)
    if (name && name !== role.name) {
      const existingRole = await Role.findOne({
        where: { name },
        transaction: t,
      });
      
      if (existingRole) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un rol con ese nombre',
        });
      }
    }
    
    // Si es rol por defecto, quitar el flag de otros roles
    if (is_default) {
      await Role.update(
        { is_default: false },
        { 
          where: { 
            id: { [Op.ne]: id }
          }, 
          transaction: t 
        }
      );
    }
    
    // Actualizar el rol
    await role.update({
      name: name || role.name,
      description: description !== undefined ? description : role.description,
      is_default: is_default !== undefined ? is_default : role.is_default,
      active: active !== undefined ? active : role.active,
    }, { transaction: t });
    
    // Actualizar permisos si se proporcionan
    if (permissions) {
      await role.setPermissions(permissions, { transaction: t });
    }
    
    await t.commit();
    
    // Obtener el rol actualizado
    const updatedRole = await Role.findByPk(id, {
      include: [{
        model: Permission,
        as: 'permissions',
        through: { attributes: [] },
      }],
    });
    
    res.json({
      success: true,
      data: updatedRole,
      message: 'Rol actualizado exitosamente',
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol',
      error: error.message,
    });
  }
};

// Eliminar rol (soft delete)
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findByPk(id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }
    
    // No permitir eliminar rol por defecto
    if (role.is_default) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el rol por defecto',
      });
    }
    
    // Verificar si hay usuarios con este rol
    const userCount = await Usuario.count({
      where: { role_id: id },
    });
    
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el rol porque está asignado a ${userCount} usuario(s)`,
      });
    }
    
    await role.update({ active: false });
    
    res.json({
      success: true,
      message: 'Rol eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar rol',
      error: error.message,
    });
  }
};

// Obtener todos los permisos agrupados por módulo
const getAllPermissionsGrouped = async (req, res) => {
  try {
    const permissions = await Permission.findAll({
      where: { active: true },
      order: [['module', 'ASC'], ['action', 'ASC']],
    });
    
    // Agrupar por módulo
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener permisos',
      error: error.message,
    });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissionsGrouped,
};