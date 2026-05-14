// backend/src/migrations/20250131000001-add-columns-to-service-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columna prioridad
    const [prioridadExists] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'prioridad'
    `);
    
    if (prioridadExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'prioridad', {
        type: Sequelize.ENUM('baja', 'normal', 'alta', 'urgente'),
        defaultValue: 'normal',
      });
      console.log('✅ Columna prioridad agregada');
    }

    // Agregar columna notas_internas
    const [notasInternasExists] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'notas_internas'
    `);
    
    if (notasInternasExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'notas_internas', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      console.log('✅ Columna notas_internas agregada');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('service_orders', 'prioridad');
    await queryInterface.removeColumn('service_orders', 'notas_internas');
  }
};