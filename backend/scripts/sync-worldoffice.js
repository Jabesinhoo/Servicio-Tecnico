'use strict';

// backend/scripts/sync-worldoffice.js

require('dotenv').config();

const fs =
  require('fs');

const path =
  require('path');

const worldoffice =
  require('../src/services/worldoffice.service');

const pgPool =
  require('../src/db/pool');

async function sync() {
  try {
    console.log(
      '🔄 Sincronizando con World Office...\n'
    );

    // ============================================================
    // 1. EJECUTAR SINCRONIZACIÓN
    // ============================================================

    const data =
      await worldoffice.syncAllData(
        pgPool
      );

    // ============================================================
    // 2. GUARDAR RESUMEN DE DEPURACIÓN
    // ============================================================

    const syncDir =
      path.join(
        __dirname,
        '../sync-data'
      );

    if (
      !fs.existsSync(syncDir)
    ) {
      fs.mkdirSync(
        syncDir,
        {
          recursive: true,
        }
      );
    }

    const filename =
      `sync_${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.json`;

    const filepath =
      path.join(
        syncDir,
        filename
      );

    /*
     * Guardamos únicamente el resultado devuelto
     * por syncAllData.
     *
     * Nunca guardar variables de entorno ni
     * credenciales en este archivo.
     */
    fs.writeFileSync(
      filepath,
      JSON.stringify(
        data,
        null,
        2
      ),
      {
        encoding: 'utf8',
      }
    );

    console.log(
      `📄 Resultado guardado en: ${filepath}`
    );

    // ============================================================
    // 3. RESUMEN
    // ============================================================

    console.log(
      '\n📊 RESUMEN'
    );

    console.log(
      `Clientes: ${data.totales.clientes}`
    );

    console.log(
      `Productos: ${data.totales.productos}`
    );

    console.log(
      `Seriales: ${data.totales.seriales}`
    );

    console.log(
      `Alquileres: ${data.totales.alquileres}`
    );

    if (
      data.totales.inventario !== undefined
    ) {
      console.log(
        `Inventario: ${data.totales.inventario}`
      );
    }

    console.log(
      '\n✅ Sincronización completada correctamente'
    );

  } catch (error) {
    console.error(
      '\n❌ Error sincronizando World Office:'
    );

    console.error(
      error.message
    );

    console.error(
      error.stack
    );

    process.exitCode = 1;

  } finally {
    try {
      await worldoffice.close();
    } catch (_) {}

    try {
      await pgPool.end();
    } catch (_) {}

    console.log(
      '\n🔒 Conexiones cerradas'
    );
  }
}

sync();