'use strict';

// backend/scripts/test-worldoffice.js

require('dotenv').config();

const worldoffice =
  require('../src/services/worldoffice.service');

const pgPool =
  require('../src/db/pool');

async function testConnection() {
  try {
    console.log(
      '🧪 Probando conexión a World Office...\n'
    );

    // ============================================================
    // 1. SQL SERVER
    // ============================================================

    await worldoffice.connect();

    console.log(
      '✅ Conexión a World Office exitosa!\n'
    );

    // ============================================================
    // 2. CLIENTES
    // ============================================================

    console.log(
      '📋 Obteniendo clientes...'
    );

    const clientes =
      await worldoffice.getClientes();

    console.log(
      `✅ ${clientes.length} clientes encontrados`
    );

    if (clientes.length > 0) {
      console.log(
        '   Ejemplo:',
        clientes[0]
      );
    }

    console.log('');

    // ============================================================
    // 3. PRODUCTOS
    // ============================================================

    console.log(
      '📦 Obteniendo productos...'
    );

    const productos =
      await worldoffice.getProductos();

    console.log(
      `✅ ${productos.length} productos encontrados`
    );

    if (productos.length > 0) {
      console.log(
        '   Ejemplo:',
        productos[0]
      );
    }

    console.log('');

    // ============================================================
    // 4. SERIALES
    // ============================================================

    console.log(
      '🔢 Obteniendo seriales...'
    );

    const seriales =
      await worldoffice.getSeriales();

    console.log(
      `✅ ${seriales.length} seriales encontrados`
    );

    if (seriales.length > 0) {
      console.log(
        '   Ejemplo:',
        seriales[0]
      );
    }

    console.log('');

    // ============================================================
    // 5. ALQUILERES
    // ============================================================

    console.log(
      '📄 Obteniendo alquileres...'
    );

    const alquileres =
      await worldoffice.getAlquileres();

    console.log(
      `✅ ${alquileres.length} alquileres encontrados`
    );

    if (alquileres.length > 0) {
      console.log(
        '   Ejemplo:',
        alquileres[0]
      );
    }

    console.log('');

    // ============================================================
    // 6. VALIDAR POSTGRESQL
    // ============================================================

    console.log(
      '🐘 Probando PostgreSQL...'
    );

    const pgTest =
      await pgPool.query(`
        SELECT
          current_database() AS database_name,
          NOW() AS server_time
      `);

    console.log(
      '✅ PostgreSQL conectado:',
      pgTest.rows[0]
    );

    console.log('');

    // ============================================================
    // 7. SINCRONIZACIÓN COMPLETA
    // ============================================================

    console.log(
      '🔄 Ejecutando sincronización completa...'
    );

    const sync =
      await worldoffice.syncAllData(
        pgPool
      );

    console.log(
      '\n✅ Sincronización completada'
    );

    console.log(
      `   📊 Clientes: ${sync.totales.clientes}`
    );

    console.log(
      `   📊 Productos: ${sync.totales.productos}`
    );

    console.log(
      `   📊 Seriales: ${sync.totales.seriales}`
    );

    console.log(
      `   📊 Alquileres: ${sync.totales.alquileres}`
    );

    console.log(
      '\n✅ Prueba completa finalizada correctamente'
    );

  } catch (error) {
    console.error(
      '\n❌ Error en la prueba:',
      error.message
    );

    console.error(
      error.stack
    );

    process.exitCode = 1;

  } finally {
    // SQL Server
    try {
      await worldoffice.close();
    } catch (_) {}

    // PostgreSQL
    try {
      await pgPool.end();
    } catch (_) {}

    console.log(
      '\n🔒 Conexiones cerradas'
    );
  }
}

testConnection();