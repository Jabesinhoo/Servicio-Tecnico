// backend/scripts/sync-to-postgres.js
require('dotenv').config();
const { Pool } = require('pg');
const worldoffice = require('../src/services/worldoffice.service');

async function sync() {
    console.log('🔄 Sincronizando World Office → PostgreSQL...\n');

    // Conexión a PostgreSQL
    const pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1235',
        database: process.env.DB_NAME || 'tecnicos'
    });

    try {
        // Probar conexión a PostgreSQL
        await pgPool.query('SELECT 1');
        console.log('✅ Conectado a PostgreSQL');

        // Ejecutar sincronización
        const results = await worldoffice.syncAllData(pgPool);

        console.log('\n📊 RESULTADOS:');
        console.log(`   Clientes: ${results.clientes || 0}`);
        console.log(`   Productos: ${results.productos || 0}`);
        console.log(`   Seriales: ${results.seriales || 0}`);
        console.log(`   Alquileres: ${results.alquileres || 0}`);

        // Cerrar conexiones
        await worldoffice.close();
        await pgPool.end();

        console.log('\n✅ Sincronización completada con éxito!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        await pgPool.end();
        process.exit(1);
    }
}

sync();