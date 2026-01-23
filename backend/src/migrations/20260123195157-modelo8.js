"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_movements", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      tipo_movimiento: {
        type: Sequelize.ENUM("entrada", "salida"),
        allowNull: false,
      },

      origen_tipo: {
        type: Sequelize.ENUM("compra", "venta", "servicio", "ajuste"),
        allowNull: false,
      },

      origen_id: { type: Sequelize.UUID, allowNull: true },

      cantidad: { type: Sequelize.INTEGER, allowNull: false },

      fecha: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },

      usuario_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      observaciones: { type: Sequelize.TEXT },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_movements");
  },
};
