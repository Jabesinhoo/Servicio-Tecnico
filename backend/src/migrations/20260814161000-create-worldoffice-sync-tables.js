'use strict';

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // ============================================================
    // SYNC PRODUCTOS
    // ============================================================

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sync_productos (
        id_externo BIGINT PRIMARY KEY,

        codigo VARCHAR(100),
        nombre VARCHAR(500),

        precio_venta NUMERIC(18,2) NOT NULL DEFAULT 0,
        iva NUMERIC(10,4) NOT NULL DEFAULT 0,

        activo BOOLEAN NOT NULL DEFAULT TRUE,

        datos_completos JSONB,

        fecha_sincronizacion
          TIMESTAMP WITHOUT TIME ZONE
          NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ============================================================
    // SYNC SERIALES
    // ============================================================

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sync_seriales (
        id_externo BIGINT PRIMARY KEY,

        serial VARCHAR(255),

        id_producto_externo BIGINT,

        datos_completos JSONB,

        fecha_sincronizacion
          TIMESTAMP WITHOUT TIME ZONE
          NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ============================================================
    // SYNC ALQUILERES
    // ============================================================

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sync_alquileres (
        id_externo BIGINT PRIMARY KEY,

        id_cliente_externo BIGINT,

        id_producto_externo BIGINT,

        cantidad NUMERIC(18,4)
          NOT NULL DEFAULT 0,

        datos_completos JSONB,

        fecha_sincronizacion
          TIMESTAMP WITHOUT TIME ZONE
          NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ============================================================
    // CONTROL DE SINCRONIZACIÓN
    // ============================================================

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sync_control (
        tabla VARCHAR(100) PRIMARY KEY,

        ultima_sincronizacion
          TIMESTAMP WITHOUT TIME ZONE
          NOT NULL DEFAULT CURRENT_TIMESTAMP,

        total_registros INTEGER
          NOT NULL DEFAULT 0,

        estado VARCHAR(30)
          NOT NULL DEFAULT 'pendiente'
      );
    `);

    // ============================================================
    // ÍNDICES - CLIENTES
    // ============================================================

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_clientes_documento
      ON sync_clientes(documento);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_clientes_razon_social
      ON sync_clientes(razon_social);
    `);

    // ============================================================
    // ÍNDICES - PRODUCTOS
    // ============================================================

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_productos_codigo
      ON sync_productos(codigo);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_productos_nombre
      ON sync_productos(nombre);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_productos_activo
      ON sync_productos(activo);
    `);

    // ============================================================
    // ÍNDICES - SERIALES
    // ============================================================

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_seriales_serial
      ON sync_seriales(serial);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_seriales_producto
      ON sync_seriales(id_producto_externo);
    `);

    // ============================================================
    // ÍNDICES - ALQUILERES
    // ============================================================

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_alquileres_cliente
      ON sync_alquileres(id_cliente_externo);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS
        idx_sync_alquileres_producto
      ON sync_alquileres(id_producto_externo);
    `);

    console.log(
      '✅ Tablas espejo de World Office creadas correctamente'
    );
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      DROP TABLE IF EXISTS sync_control;
    `);

    await sequelize.query(`
      DROP TABLE IF EXISTS sync_alquileres;
    `);

    await sequelize.query(`
      DROP TABLE IF EXISTS sync_seriales;
    `);

    await sequelize.query(`
      DROP TABLE IF EXISTS sync_productos;
    `);

    console.log(
      '⚠️ Tablas de sincronización World Office eliminadas'
    );
  },
};