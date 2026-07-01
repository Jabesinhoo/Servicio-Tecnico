'use strict';
module.exports = (sequelize, DataTypes) => {
  const Resolution = sequelize.define('Resolution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    numero_resolucion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    prefijo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    rango_inicio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rango_fin: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    siguiente_numero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    fecha_emision: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_vencimiento: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'resolutions',
    timestamps: true,
  });

  Resolution.associate = (models) => {
    Resolution.hasMany(models.Invoice, { foreignKey: 'resolution_id' });
  };

  return Resolution;
};