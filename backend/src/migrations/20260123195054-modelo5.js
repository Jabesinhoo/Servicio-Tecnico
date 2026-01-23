"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("sales_order_items", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      sales_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "sales_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      cantidad: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      precio_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      requiere_servicio: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("sales_order_items");
  },
};
