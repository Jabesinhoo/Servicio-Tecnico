"use strict";

module.exports = (sequelize, DataTypes) => {
  const SalesOrderItem = sequelize.define(
    "SalesOrderItem",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      sales_order_id: { type: DataTypes.UUID, allowNull: false },
      product_id: { type: DataTypes.UUID, allowNull: false },

      cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      precio_unitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      requiere_servicio: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "sales_order_items",
      timestamps: true,
    }
  );

  SalesOrderItem.associate = (models) => {
    SalesOrderItem.belongsTo(models.SalesOrder, { foreignKey: "sales_order_id" });
    SalesOrderItem.belongsTo(models.Product, { foreignKey: "product_id" });
  };

  return SalesOrderItem;
};
