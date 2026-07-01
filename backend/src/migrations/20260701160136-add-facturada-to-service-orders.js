'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [result] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'facturada'
    `);
    
    if (result.length === 0) {
      await queryInterface.addColumn('service_orders', 'facturada', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log('✅ Columna facturada agregada a service_orders');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_orders', 'facturada');
  },
};