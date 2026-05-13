// backend/src/migrations/20250129000000-add-duracion-to-service-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [result] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'duracion_estimada'
    `);
    
    if (result.length === 0) {
      await queryInterface.addColumn('service_orders', 'duracion_estimada', {
        type: Sequelize.INTEGER,
        defaultValue: 60,
        comment: 'Duración estimada en minutos',
      });
    }

    const [result2] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'fecha_agendada'
    `);
    
    if (result2.length === 0) {
      await queryInterface.addColumn('service_orders', 'fecha_agendada', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const [result3] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'hora_inicio_agendada'
    `);
    
    if (result3.length === 0) {
      await queryInterface.addColumn('service_orders', 'hora_inicio_agendada', {
        type: Sequelize.TIME,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('service_orders', 'duracion_estimada');
    await queryInterface.removeColumn('service_orders', 'fecha_agendada');
    await queryInterface.removeColumn('service_orders', 'hora_inicio_agendada');
  }
};