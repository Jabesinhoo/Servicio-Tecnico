"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("products", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      codigo: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.TEXT },

      tipo: { type: Sequelize.ENUM("producto_venta", "repuesto", "servicio"), allowNull: false },

      precio_venta: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      stock_actual: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      stock_minimo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      proveedor: { type: Sequelize.STRING(150) },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("products");
  },
};
