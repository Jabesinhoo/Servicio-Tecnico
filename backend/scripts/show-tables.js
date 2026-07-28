// backend/scripts/show-tables.js
require('dotenv').config();
const sql = require('mssql');

async function showTables() {
    console.log('🔍 Buscando tablas en World Office...\n');

    const config = {
        server: 'SERTECNO',
        instanceName: 'WORLDOFFICE14',
        database: 'Melissa_2023',
        user: 'Jabes',
        password: 'Jabes2026',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            instanceName: 'WORLDOFFICE14'
        }
    };

    try {
        const pool = await sql.connect(config);
        console.log('✅ Conectado!\n');

        // Obtener todas las tablas
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        console.log(`📋 ${result.recordset.length} TABLAS ENCONTRADAS:\n`);
        
        const tables = result.recordset.map(r => r.TABLE_NAME);
        
        // Mostrar en columnas
        const cols = 4;
        tables.forEach((name, i) => {
            process.stdout.write(`   ${(i+1).toString().padStart(2)}. ${name.padEnd(30)}`);
            if ((i + 1) % cols === 0 || i === tables.length - 1) {
                console.log('');
            }
        });

        console.log('\n\n🔍 Buscando tablas relacionadas con clientes, productos, seriales, alquileres...\n');

        // Buscar tablas con nombres similares
        const keywords = ['cliente', 'producto', 'serial', 'alquiler', 'inventario', 'item', 'venta'];
        
        for (const keyword of keywords) {
            const matches = tables.filter(t => t.toLowerCase().includes(keyword));
            if (matches.length > 0) {
                console.log(`📌 Tablas con "${keyword}":`);
                matches.forEach(t => console.log(`   - ${t}`));
                console.log('');
            }
        }

        // Mostrar estructura de algunas tablas candidatas
        const candidates = tables.filter(t => 
            t.toLowerCase().includes('cliente') || 
            t.toLowerCase().includes('producto') ||
            t.toLowerCase().includes('item')
        );

        if (candidates.length > 0) {
            console.log('📊 Estructura de tablas candidatas:\n');
            for (const table of candidates.slice(0, 3)) {
                const struct = await pool.request().query(`
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${table}'
                    ORDER BY ORDINAL_POSITION
                `);
                console.log(`   📋 ${table}:`);
                struct.recordset.forEach(col => {
                    console.log(`      - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
                });
                console.log('');
            }
        }

        await sql.close();
        console.log('✅ Listo!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

showTables();