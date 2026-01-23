"use strict";

module.exports = (sequelize, DataTypes) => {
  const ServiceTime = sequelize.define(
    "ServiceTime",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      service_order_id: { type: DataTypes.UUID, allowNull: false },

      tipo_tiempo: {
        type: DataTypes.ENUM("trabajo", "desplazamiento"),
        allowNull: false,
      },

      hora_inicio: { type: DataTypes.DATE, allowNull: false },
      hora_fin: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "service_times",
      timestamps: true,
    }
  );

  ServiceTime.associate = (models) => {
    ServiceTime.belongsTo(models.ServiceOrder, { foreignKey: "service_order_id" });
  };

  return ServiceTime;
};
