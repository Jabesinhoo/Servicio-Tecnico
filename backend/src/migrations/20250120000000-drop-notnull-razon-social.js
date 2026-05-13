// backend/src/migrations/20250120000000-drop-notnull-razon-social.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('clients', 'razon_social', {
      type: Sequelize.STRING(180),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('clients', 'razon_social', {
      type: Sequelize.STRING(180),
      allowNull: false
    });
  }
};