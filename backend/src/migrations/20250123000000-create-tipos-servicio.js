// backend/src/migrations/20250123000000-create-tipos-servicio.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla tipos_servicio
    await queryInterface.createTable('tipos_servicio', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      valor_base: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },
      duracion_estimada: {
        type: Sequelize.INTEGER, // en minutos
        defaultValue: 60,
      },
      requiere_diagnostico: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      requiere_repuestos: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      requiere_aprobacion: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      categoria: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      "createdAt": {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      "updatedAt": {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tipos_servicio');
  }
};