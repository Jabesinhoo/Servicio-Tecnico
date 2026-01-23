"use strict";

module.exports = (sequelize, DataTypes) => {
  const ServiceOrder = sequelize.define(
    "ServiceOrder",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      codigo_os: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      client_id: { type: DataTypes.UUID, allowNull: false },

      origen_tipo: {
        type: DataTypes.ENUM("venta", "tecnico", "otro"),
        allowNull: false,
      },

      origen_id: { type: DataTypes.UUID, allowNull: true }, // id de la OV si origen_tipo = venta
      tecnico_id: { type: DataTypes.UUID, allowNull: true },

      descripcion_inicial: { type: DataTypes.TEXT, allowNull: true },

      estado: {
        type: DataTypes.ENUM("pendiente", "asignada", "en_ejecucion", "en_espera", "cerrada"),
        allowNull: false,
        defaultValue: "pendiente",
      },

      fecha_asignacion: { type: DataTypes.DATE, allowNull: true },
      fecha_inicio: { type: DataTypes.DATE, allowNull: true },
      fecha_fin: { type: DataTypes.DATE, allowNull: true },

      diagnostico_final: { type: DataTypes.TEXT, allowNull: true },
      observaciones: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "service_orders",
      timestamps: true,
    }
  );

  ServiceOrder.associate = (models) => {
    ServiceOrder.belongsTo(models.Client, { foreignKey: "client_id" });
    ServiceOrder.belongsTo(models.Usuario, { foreignKey: "tecnico_id" });

    ServiceOrder.hasMany(models.ServiceTime, { foreignKey: "service_order_id" });
    ServiceOrder.hasMany(models.Invoice, { foreignKey: "service_order_id" });
  };

  return ServiceOrder;
};
