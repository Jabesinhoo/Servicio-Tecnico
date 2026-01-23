"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("servicios", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      descripcion: { type: Sequelize.TEXT, allowNull: true },
      estado: { type: Sequelize.STRING, allowNull: false, defaultValue: "pendiente" },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("servicios");
  },
};
