// backend/src/migrations/20250121000000-add-total-general-to-service-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si la columna ya existe
    const [result] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'total_general'
    `);
    
    if (result.length === 0) {
      await queryInterface.addColumn('service_orders', 'total_general', {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      });
      console.log('✅ Columna total_general agregada a service_orders');
    } else {
      console.log('⏭️ Columna total_general ya existe');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('service_orders', 'total_general');
  }
};