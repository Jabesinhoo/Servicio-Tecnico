'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    // ============================================================
    // 1. COMPLETAR METADATOS DE APROBACIÓN / RECHAZO
    // ============================================================

    await sequelize.query(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS aprobado_por UUID NULL;
    `);

    await sequelize.query(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ NULL;
    `);

    await sequelize.query(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS rechazado_por UUID NULL;
    `);

    await sequelize.query(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS fecha_rechazo TIMESTAMPTZ NULL;
    `);

    await sequelize.query(`
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT NULL;
    `);

    // ============================================================
    // 2. INTEGRIDAD REFERENCIAL
    // ============================================================

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'service_orders_aprobado_por_fkey'
        ) THEN
          ALTER TABLE service_orders
          ADD CONSTRAINT service_orders_aprobado_por_fkey
          FOREIGN KEY (aprobado_por)
          REFERENCES usuarios(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'service_orders_rechazado_por_fkey'
        ) THEN
          ALTER TABLE service_orders
          ADD CONSTRAINT service_orders_rechazado_por_fkey
          FOREIGN KEY (rechazado_por)
          REFERENCES usuarios(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // ============================================================
    // 3. CATÁLOGO OFICIAL DE ESTADOS
    // ============================================================

    await sequelize.query(`
      ALTER TYPE enum_service_orders_estado
      ADD VALUE IF NOT EXISTS 'aprobado';
    `);

    await sequelize.query(`
      ALTER TYPE enum_service_orders_estado
      ADD VALUE IF NOT EXISTS 'rechazado';
    `);

    await sequelize.query(`
      ALTER TYPE enum_service_orders_estado
      ADD VALUE IF NOT EXISTS 'cancelado';
    `);

    console.log('✅ Ciclo de vida de órdenes alineado correctamente');
  },

  async down() {
    console.log(
      '⚠️ Rollback manual requerido: PostgreSQL no elimina valores ENUM de forma segura automáticamente.'
    );
  }
};