'use strict';
module.exports = (sequelize, DataTypes) => {
  const ServiceTime = sequelize.define('ServiceTime', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    service_order_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    tecnico_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    horas_trabajadas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    descripcion_trabajo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'service_times',
    timestamps: true,
  });

  ServiceTime.associate = (models) => {
    ServiceTime.belongsTo(models.ServiceOrder, { foreignKey: 'service_order_id' });
    ServiceTime.belongsTo(models.Usuario, { foreignKey: 'tecnico_id' });
  };

  return ServiceTime;
};