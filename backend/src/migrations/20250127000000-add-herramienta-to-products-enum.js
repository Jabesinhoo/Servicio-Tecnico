// backend/src/migrations/20250127000000-add-herramienta-to-products-enum.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_products_tipo" ADD VALUE 'herramienta';
    `);
  },

  async down(queryInterface, Sequelize) {
    // No se puede eliminar un valor de ENUM fácilmente
    console.log('No se puede revertir esta migración');
  }
};