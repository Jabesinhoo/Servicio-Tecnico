"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_orders", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      codigo_os: { type: Sequelize.STRING(30), allowNull: false, unique: true },

      client_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "clients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      origen_tipo: {
        type: Sequelize.ENUM("venta", "tecnico", "otro"),
        allowNull: false,
      },

      origen_id: { type: Sequelize.UUID, allowNull: true },

      tecnico_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      descripcion_inicial: { type: Sequelize.TEXT },

      estado: {
        type: Sequelize.ENUM("pendiente", "asignada", "en_ejecucion", "en_espera", "cerrada"),
        allowNull: false,
        defaultValue: "pendiente",
      },

      fecha_asignacion: { type: Sequelize.DATE },
      fecha_inicio: { type: Sequelize.DATE },
      fecha_fin: { type: Sequelize.DATE },

      diagnostico_final: { type: Sequelize.TEXT },
      observaciones: { type: Sequelize.TEXT },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("service_orders");
  },
};
