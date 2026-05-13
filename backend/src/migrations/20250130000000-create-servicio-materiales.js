// backend/src/migrations/20250130000000-create-servicio-materiales.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('servicio_materiales', {
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
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad_solicitada: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cantidad_entregada: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cantidad_usada: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cantidad_devuelta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      cantidad_desperdiciada: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tecnico_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'usuarios',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_entrega: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fecha_devolucion: {
        type: Sequelize.DATE,
        allowNull: true,
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
    await queryInterface.dropTable('servicio_materiales');
  }
};