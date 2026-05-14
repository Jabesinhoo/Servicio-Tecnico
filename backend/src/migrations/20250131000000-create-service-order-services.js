// backend/src/migrations/20250131000000-create-service-order-services.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('service_order_services', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      service_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'service_orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tipo_servicio_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      tipo_servicio_nombre: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      descripcion_problema: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      precio_estimado: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },
      equipo_relacionado: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      requiere_diagnostico: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      requiere_repuestos: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      repuestos_necesarios: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('service_order_services');
  }
};