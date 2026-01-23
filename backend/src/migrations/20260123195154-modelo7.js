"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_times", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      service_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "service_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      tipo_tiempo: {
        type: Sequelize.ENUM("trabajo", "desplazamiento"),
        allowNull: false,
      },

      hora_inicio: { type: Sequelize.DATE, allowNull: false },
      hora_fin: { type: Sequelize.DATE, allowNull: false },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("service_times");
  },
};
