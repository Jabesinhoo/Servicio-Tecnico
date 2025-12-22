"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("usuarios", "usuario", {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    });

    await queryInterface.addColumn("usuarios", "cedula", {
      type: Sequelize.STRING(30),
      allowNull: false,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("usuarios", "cedula");
    await queryInterface.removeColumn("usuarios", "usuario");
  },
};
