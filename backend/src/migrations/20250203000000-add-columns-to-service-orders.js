// backend/src/migrations/20250203000000-add-columns-to-service-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar columna prioridad
    const [prioridadExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
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
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'notas_internas'
    `);
    if (notasInternasExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'notas_internas', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      console.log('✅ Columna notas_internas agregada');
    }

    // Agregar columna origen
    const [origenExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'origen'
    `);
    if (origenExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'origen', {
        type: Sequelize.ENUM('local', 'ventas', 'tecnico', 'proyecto'),
        defaultValue: 'local',
      });
      console.log('✅ Columna origen agregada');
    }

    // Agregar columnas para aprobación/rechazo
    const [aprobadoPorExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'aprobado_por'
    `);
    if (aprobadoPorExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'aprobado_por', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      console.log('✅ Columna aprobado_por agregada');
    }

    const [fechaAprobacionExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'fecha_aprobacion'
    `);
    if (fechaAprobacionExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'fecha_aprobacion', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      console.log('✅ Columna fecha_aprobacion agregada');
    }

    const [rechazadoPorExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'rechazado_por'
    `);
    if (rechazadoPorExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'rechazado_por', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      console.log('✅ Columna rechazado_por agregada');
    }

    const [fechaRechazoExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'fecha_rechazo'
    `);
    if (fechaRechazoExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'fecha_rechazo', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      console.log('✅ Columna fecha_rechazo agregada');
    }

    const [motivoRechazoExists] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_orders' AND column_name = 'motivo_rechazo'
    `);
    if (motivoRechazoExists.length === 0) {
      await queryInterface.addColumn('service_orders', 'motivo_rechazo', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      console.log('✅ Columna motivo_rechazo agregada');
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = ['prioridad', 'notas_internas', 'origen', 'aprobado_por', 'fecha_aprobacion', 'rechazado_por', 'fecha_rechazo', 'motivo_rechazo'];
    for (const column of columns) {
      await queryInterface.removeColumn('service_orders', column).catch(() => {});
    }
  }
};