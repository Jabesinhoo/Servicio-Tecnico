module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      numero_factura: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      prefijo: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      fecha_emision: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      cliente_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'clients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      service_order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'service_orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      sales_order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'sales_orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tipo_documento: {
        type: Sequelize.ENUM('factura', 'nota_credito', 'nota_debito'),
        allowNull: false,
        defaultValue: 'factura',
      },
      estado: {
        type: Sequelize.ENUM('borrador', 'emitida', 'pagada', 'anulada'),
        allowNull: false,
        defaultValue: 'emitida',
      },
      total_base: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_iva: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_retencion: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_otros_impuestos: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_general: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'resolutions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Índices para búsquedas rápidas
    await queryInterface.addIndex('invoices', ['numero_factura']);
    await queryInterface.addIndex('invoices', ['cliente_id']);
    await queryInterface.addIndex('invoices', ['service_order_id']);
    await queryInterface.addIndex('invoices', ['estado']);
    await queryInterface.addIndex('invoices', ['fecha_emision']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('invoices');
  },
};