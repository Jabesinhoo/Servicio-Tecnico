"use strict";

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      nombre: { type: DataTypes.STRING(150), allowNull: false },
      descripcion: { type: DataTypes.TEXT, allowNull: true },

      tipo: {
        type: DataTypes.ENUM("producto_venta", "repuesto", "servicio"),
        allowNull: false,
      },

      precio_venta: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      stock_actual: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      stock_minimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      proveedor: { type: DataTypes.STRING(150), allowNull: true },
      estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "products",
      timestamps: true,
    }
  );

  Product.associate = (models) => {
    Product.hasMany(models.SalesOrderItem, { foreignKey: "product_id" });
    Product.hasMany(models.InventoryMovement, { foreignKey: "product_id" });
  };

  return Product;
};
