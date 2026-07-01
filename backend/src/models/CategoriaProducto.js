'use strict';
module.exports = (sequelize, DataTypes) => {
  const CategoriaProducto = sequelize.define('CategoriaProducto', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'categorias_productos',
    timestamps: true,
  });

  CategoriaProducto.associate = (models) => {
    // Relaciones
  };

  return CategoriaProducto;
};