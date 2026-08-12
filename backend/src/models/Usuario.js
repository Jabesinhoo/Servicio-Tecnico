'use strict';

module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define('Usuario', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Campos de nombre (para compatibilidad con la tabla existente)
    nombre1: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    nombre2: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    apellidos: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // Campo virtual para obtener el nombre completo
    nombre: {
      type: DataTypes.VIRTUAL,
      get() {
        const n1 = this.getDataValue('nombre1') || '';
        const n2 = this.getDataValue('nombre2') || '';
        const ap = this.getDataValue('apellidos') || '';
        return `${n1} ${n2} ${ap}`.trim();
      },
      set(value) {
        // Si se asigna un nombre completo, intentar separarlo
        if (value) {
          const parts = value.split(' ');
          if (parts.length >= 3) {
            this.setDataValue('nombre1', parts[0]);
            this.setDataValue('nombre2', parts[1]);
            this.setDataValue('apellidos', parts.slice(2).join(' '));
          } else if (parts.length === 2) {
            this.setDataValue('nombre1', parts[0]);
            this.setDataValue('apellidos', parts[1]);
          } else {
            this.setDataValue('nombre1', value);
          }
        }
      },
    },
    usuario: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cedula: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    celular: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Rol (para el nuevo sistema de roles)
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id',
      },
    },
    // Rol (para compatibilidad con el sistema antiguo)
    rol: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'usuario',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Campos de auditoría y seguridad
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    two_factor_secret: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  }, {
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    // Índices para mejorar el rendimiento
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['usuario'],
      },
      {
        fields: ['cedula'],
      },
      {
        fields: ['role_id'],
      },
      {
        fields: ['rol'],
      },
    ],
  });

  // Asociaciones
  Usuario.associate = (models) => {
    Usuario.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'role',
    });

    // Asociaciones para compatibilidad con el sistema existente
    if (models.Client) {
      Usuario.hasMany(models.Client, {
        foreignKey: 'vendedor_id',
        as: 'clientes_vendedor',
      });
    }

    if (models.SalesOrder) {
      Usuario.hasMany(models.SalesOrder, {
        foreignKey: 'vendedor_id',
        as: 'ventas',
      });
    }

    if (models.ServiceOrder) {
      Usuario.hasMany(models.ServiceOrder, {
        foreignKey: 'tecnico_id',
        as: 'servicios_tecnico',
      });
      Usuario.hasMany(models.ServiceOrder, {
        foreignKey: 'creado_por',
        as: 'servicios_creados',
      });
    }
  };

  // ============================================================
  // MÉTODOS DE INSTANCIA
  // ============================================================

  // Obtener nombre completo
  Usuario.prototype.getNombreCompleto = function() {
    const n1 = this.nombre1 || '';
    const n2 = this.nombre2 || '';
    const ap = this.apellidos || '';
    return `${n1} ${n2} ${ap}`.trim();
  };

  // Verificar si tiene un permiso específico
  Usuario.prototype.hasPermission = async function(permissionName) {
    // Si el usuario es admin por rol antiguo, tiene todos los permisos
    if (this.rol === 'admin') return true;

    if (!this.role_id) return false;
    
    // Cargar el rol con sus permisos si no están cargados
    if (!this.role || !this.role.permissions) {
      const { Role } = require('../models');
      const role = await Role.findByPk(this.role_id, {
        include: ['permissions'],
      });
      if (!role) return false;
      this.role = role;
    }
    
    return this.role.permissions.some(p => p.name === permissionName);
  };

  // Obtener todos los permisos del usuario
  Usuario.prototype.getPermissions = async function() {
    // Si es admin, devolver todos los permisos
    if (this.rol === 'admin') {
      const { Permission } = require('../models');
      return await Permission.findAll({ where: { active: true } });
    }

    if (!this.role_id) return [];
    
    if (!this.role || !this.role.permissions) {
      const { Role } = require('../models');
      const role = await Role.findByPk(this.role_id, {
        include: ['permissions'],
      });
      if (!role) return [];
      this.role = role;
    }
    
    return this.role.permissions || [];
  };

  // Verificar si tiene algún permiso de una lista
  Usuario.prototype.hasAnyPermission = async function(permissionNames) {
    for (const name of permissionNames) {
      if (await this.hasPermission(name)) return true;
    }
    return false;
  };

  // Verificar si tiene todos los permisos de una lista
  Usuario.prototype.hasAllPermissions = async function(permissionNames) {
    for (const name of permissionNames) {
      if (!(await this.hasPermission(name))) return false;
    }
    return true;
  };

  // ============================================================
  // MÉTODOS DE CLASE
  // ============================================================

  // Verificar si un usuario tiene un permiso específico
  Usuario.hasPermission = async function(userId, permissionName) {
    const user = await this.findByPk(userId, {
      include: [{
        model: sequelize.models.Role,
        as: 'role',
        include: ['permissions'],
      }],
    });
    
    if (!user) return false;
    if (user.rol === 'admin') return true;
    if (!user.role) return false;
    
    return user.role.permissions.some(p => p.name === permissionName);
  };

  // Obtener usuarios por rol
  Usuario.findByRole = async function(roleName) {
    const Role = require('./Role');
    const role = await Role.findOne({
      where: { name: roleName, active: true },
    });
    
    if (!role) return [];
    
    return this.findAll({
      where: { role_id: role.id, activo: true },
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
  };

  // Obtener usuarios con permisos específicos
  Usuario.findWithPermission = async function(permissionName) {
    const Permission = require('./Permission');
    const permission = await Permission.findOne({
      where: { name: permissionName, active: true },
    });
    
    if (!permission) return [];
    
    const roles = await sequelize.models.Role.findAll({
      include: [{
        model: Permission,
        as: 'permissions',
        where: { id: permission.id },
        through: { attributes: [] },
      }],
    });
    
    const roleIds = roles.map(r => r.id);
    
    if (roleIds.length === 0) return [];
    
    return this.findAll({
      where: {
        role_id: { [sequelize.Op.in]: roleIds },
        activo: true,
      },
      include: [{
        model: sequelize.models.Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });
  };

  // ============================================================
  // HOOKS
  // ============================================================

  // Antes de crear, asegurar que el usuario tenga un rol
  Usuario.beforeCreate(async (usuario) => {
    if (!usuario.rol && !usuario.role_id) {
      // Asignar rol por defecto
      const Role = require('./Role');
      const defaultRole = await Role.getDefault();
      if (defaultRole) {
        usuario.role_id = defaultRole.id;
        usuario.rol = defaultRole.name;
      } else {
        usuario.rol = 'usuario';
      }
    }
    
    // Sincronizar role_id y rol
    if (usuario.role_id && !usuario.rol) {
      const Role = require('./Role');
      const role = await Role.findByPk(usuario.role_id);
      if (role) {
        usuario.rol = role.name;
      }
    }
  });

  // Antes de actualizar, sincronizar role_id y rol
  Usuario.beforeUpdate(async (usuario) => {
    if (usuario.changed('role_id') && usuario.role_id) {
      const Role = require('./Role');
      const role = await Role.findByPk(usuario.role_id);
      if (role) {
        usuario.rol = role.name;
      }
    }
  });

  return Usuario;
};