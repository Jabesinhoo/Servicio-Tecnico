// backend/src/migrations/20250201000000-update-service-orders-flow.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columnas para el flujo de aprobación
    const columns = [
      { name: 'origen', type: Sequelize.ENUM('local', 'ventas', 'tecnico', 'proyecto'), defaultValue: 'local' },
      { name: 'aprobado_por', type: Sequelize.UUID, allowNull: true },
      { name: 'fecha_aprobacion', type: Sequelize.DATE, allowNull: true },
      { name: 'rechazado_por', type: Sequelize.UUID, allowNull: true },
      { name: 'fecha_rechazo', type: Sequelize.DATE, allowNull: true },
      { name: 'motivo_rechazo', type: Sequelize.TEXT, allowNull: true },
      { name: 'reagendado_veces', type: Sequelize.INTEGER, defaultValue: 0 },
    ];

    for (const column of columns) {
      const [exists] = await queryInterface.sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'service_orders' AND column_name = '${column.name}'
      `);
      if (exists.length === 0) {
        await queryInterface.addColumn('service_orders', column.name, column.def || column.type);
        console.log(`✅ Columna ${column.name} agregada`);
      }
    }

    // Actualizar ENUM de estado
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_service_orders_estado" ADD VALUE IF NOT EXISTS 'aprobado';
      ALTER TYPE "enum_service_orders_estado" ADD VALUE IF NOT EXISTS 'rechazado';
      ALTER TYPE "enum_service_orders_estado" ADD VALUE IF NOT EXISTS 'cancelado';
    `);
  },

  async down(queryInterface, Sequelize) {
    const columns = ['origen', 'aprobado_por', 'fecha_aprobacion', 'rechazado_por', 'fecha_rechazo', 'motivo_rechazo', 'reagendado_veces'];
    for (const column of columns) {
      await queryInterface.removeColumn('service_orders', column);
    }
  }
};