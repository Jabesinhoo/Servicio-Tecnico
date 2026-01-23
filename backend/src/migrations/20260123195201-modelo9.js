"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invoices", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      numero_factura: { type: Sequelize.STRING(30), allowNull: false, unique: true },

      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "clients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      sales_order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "sales_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      service_order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "service_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      fecha_emision: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },

      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      impuestos: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      estado_pago: {
        type: Sequelize.ENUM("pendiente", "pagado", "parcial"),
        allowNull: false,
        defaultValue: "pendiente",
      },

      metodo_pago: { type: Sequelize.STRING(50) },
      fecha_ultimo_pago: { type: Sequelize.DATE },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoices");
  },
};
