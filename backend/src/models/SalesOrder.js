"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalesOrder = sequelize.define(
    "SalesOrder",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      numero_ov: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },

      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      vendedor_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      estado: {
        type: DataTypes.ENUM("borrador", "confirmada", "cancelada"),
        allowNull: false,
        defaultValue: "borrador",
      },

      facturada: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      total_productos: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      total_servicios: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      total_general: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "sales_orders",
      timestamps: true,
    }
  );

  SalesOrder.associate = (models) => {
    SalesOrder.belongsTo(models.Client, {
      foreignKey: "client_id",
    });

    SalesOrder.belongsTo(models.Usuario, {
      foreignKey: "vendedor_id",
    });

    SalesOrder.hasMany(models.SalesOrderItem, {
      foreignKey: "sales_order_id",
    });

    SalesOrder.hasMany(models.ServiceOrder, {
      foreignKey: "origen_id",
    });

    SalesOrder.hasMany(models.Invoice, {
      foreignKey: "sales_order_id",
    });
  };

  return SalesOrder;
};