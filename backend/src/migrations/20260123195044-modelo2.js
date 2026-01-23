"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("clients", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      nombre_razon_social: { type: Sequelize.STRING(180), allowNull: false },
      documento: { type: Sequelize.STRING(30) },
      telefono: { type: Sequelize.STRING(30) },
      email: { type: Sequelize.STRING(150) },
      direccion: { type: Sequelize.STRING(250) },
      ciudad: { type: Sequelize.STRING(100) },
      notas: { type: Sequelize.TEXT },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("clients");
  },
};
