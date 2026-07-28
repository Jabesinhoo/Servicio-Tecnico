// backend/scripts/check-tables.js
require('dotenv').config();
const sql = require('mssql');

async function checkTables() {
    console.log('🔍 Verificando estructura de tablas clave...\n');

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

    const tablesToCheck = [
        'Terceros',
        'Inventarios',
        'Inventarios_Seriales',
        'BASE_SERIALES',
        'Alquiler_Aplicacion'
    ];

    try {
        const pool = await sql.connect(config);
        console.log('✅ Conectado!\n');

        for (const table of tablesToCheck) {
            try {
                // Verificar si la tabla existe
                const check = await pool.request().query(`
                    SELECT COUNT(*) as existe 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = '${table}'
                `);

                if (check.recordset[0].existe === 0) {
                    console.log(`⚠️ Tabla "${table}" NO EXISTE`);
                    continue;
                }

                console.log(`\n📋 TABLA: ${table}`);

                // Obtener estructura
                const struct = await pool.request().query(`
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        CHARACTER_MAXIMUM_LENGTH
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${table}'
                    ORDER BY ORDINAL_POSITION
                `);

                console.log(`   ${struct.recordset.length} columnas:`);
                struct.recordset.forEach(col => {
                    const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
                    console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}${maxLen}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
                });

                // Mostrar primeros 3 registros
                const data = await pool.request().query(`SELECT TOP 3 * FROM ${table}`);
                console.log(`\n   📊 Primeros registros:`);
                data.recordset.forEach((row, i) => {
                    console.log(`   ${i + 1}.`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
                });

            } catch (error) {
                console.log(`❌ Error con tabla "${table}":`, error.message);
            }
        }

        await sql.close();
        console.log('\n✅ Listo!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkTables();