'use strict';

module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define('Permission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  // Métodos de clase
  Permission.getByModule = function(module) {
    return this.findAll({
      where: { module, active: true },
      order: [['action', 'ASC']],
    });
  };

  Permission.getAllGrouped = function() {
    return this.findAll({
      where: { active: true },
      order: [['module', 'ASC'], ['action', 'ASC']],
    });
  };

  return Permission;
};