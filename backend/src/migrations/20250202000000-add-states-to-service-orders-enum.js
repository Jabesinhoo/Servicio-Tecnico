// backend/src/migrations/20250202000000-add-states-to-service-orders-enum.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar y agregar nuevos estados al ENUM
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_service_orders_estado') THEN
          ALTER TYPE enum_service_orders_estado ADD VALUE IF NOT EXISTS 'aprobado';
          ALTER TYPE enum_service_orders_estado ADD VALUE IF NOT EXISTS 'rechazado';
          ALTER TYPE enum_service_orders_estado ADD VALUE IF NOT EXISTS 'cancelado';
        END IF;
      END $$;
    `);
    console.log('✅ Estados agregados al ENUM de service_orders');
  },

  async down(queryInterface, Sequelize) {
    // No se puede eliminar valores de ENUM fácilmente en PostgreSQL
    console.log('No se puede revertir esta migración');
  }
};