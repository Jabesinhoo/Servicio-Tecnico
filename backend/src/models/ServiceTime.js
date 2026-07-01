'use strict';
module.exports = (sequelize, DataTypes) => {
  const InventoryMovement = sequelize.define(
    "InventoryMovement",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      tipo_movimiento: {
        type: DataTypes.ENUM("entrada", "salida"),
        allowNull: false,
      },
      origen_tipo: {
        type: DataTypes.ENUM("compra", "venta", "servicio", "ajuste"),
        allowNull: false,
      },
      origen_id: { type: DataTypes.UUID, allowNull: true },
      cantidad: { type: DataTypes.INTEGER, allowNull: false },
      fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      usuario_id: { type: DataTypes.UUID, allowNull: true },
      observaciones: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "inventory_movements",
      timestamps: true,
    }
  );

  InventoryMovement.associate = (models) => {
    InventoryMovement.belongsTo(models.Product, { foreignKey: "product_id" });
    InventoryMovement.belongsTo(models.Usuario, { foreignKey: "usuario_id" });
  };

  return InventoryMovement;
};