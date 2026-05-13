// backend/src/migrations/20250116000000-add-codigo-worldoffice-to-clients.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clients', 'codigo_worldoffice', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('clients', 'codigo_worldoffice');
  }
};