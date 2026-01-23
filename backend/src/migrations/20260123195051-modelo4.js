"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("sales_orders", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      numero_ov: { type: Sequelize.STRING(30), allowNull: false, unique: true },

      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "clients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      vendedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      estado: {
        type: Sequelize.ENUM("borrador", "confirmada", "cancelada"),
        allowNull: false,
        defaultValue: "borrador",
      },

      total_productos: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_servicios: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_general: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("sales_orders");
  },
};
