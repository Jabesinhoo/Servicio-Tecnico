// backend/scripts/test-connection.js
require('dotenv').config();
const sql = require('mssql');

async function test() {
    console.log('🧪 Probando conexión a World Office...\n');

    // Opción 1: integratedSecurity: true
    const config1 = {
        server: 'SERTECNO',
        instanceName: 'WORLDOFFICE14',
        database: 'Melissa_2023',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            instanceName: 'WORLDOFFICE14',
            integratedSecurity: true
        }
    };

    // Opción 2: Usuario de Windows explícito
    const config2 = {
        server: 'SERTECNO',
        instanceName: 'WORLDOFFICE14',
        database: 'Melissa_2023',
        user: 'DESKTOP-82EPPD6\\USUARIO',
        password: '',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            instanceName: 'WORLDOFFICE14'
        }
    };

    // Opción 3: Solo nombre de usuario
    const config3 = {
        server: 'SERTECNO',
        instanceName: 'WORLDOFFICE14',
        database: 'Melissa_2023',
        user: 'USUARIO',
        password: '',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            instanceName: 'WORLDOFFICE14'
        }
    };

    // Opción 4: Con autenticación SQL Server
    const config4 = {
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

    // Opción 5: Sin instancia, solo servidor
    const config5 = {
        server: 'SERTECNO',
        database: 'Melissa_2023',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    // Opción 6: Con localhost
    const config6 = {
        server: 'localhost',
        instanceName: 'WORLDOFFICE14',
        database: 'Melissa_2023',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            instanceName: 'WORLDOFFICE14'
        }
    };

    const configs = [
        { name: 'integratedSecurity: true', config: config1 },
        { name: 'Usuario Windows (DESKTOP-82EPPD6\\USUARIO)', config: config2 },
        { name: 'Usuario Windows (USUARIO)', config: config3 },
        { name: 'SQL Server (Jabes/Jabes2026)', config: config4 },
        { name: 'Sin instancia (SERTECNO)', config: config5 },
        { name: 'localhost\\WORLDOFFICE14', config: config6 }
    ];

    let connected = false;

    for (const { name, config } of configs) {
        try {
            console.log(`📡 Probando: ${name}...`);
            console.log(`   Servidor: ${config.server || config.options?.instanceName ? `${config.server}\\${config.options.instanceName}` : config.server}`);
            console.log(`   Base de datos: ${config.database}`);
            
            const pool = await sql.connect(config);
            console.log(`   ✅ CONEXIÓN EXITOSA!`);
            
            // Probar consulta simple
            const result = await pool.request().query('SELECT @@VERSION as version');
            console.log(`   📊 SQL: ${result.recordset[0].version.substring(0, 50)}...`);
            
            await pool.close();
            console.log(`   ✅ ¡Funciona con ${name}!\n`);
            connected = true;
            break;
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }

    if (!connected) {
        console.log('❌ Todas las pruebas fallaron.');
        console.log('\n💡 RECOMENDACIONES:');
        console.log('1. Verifica que el servidor SERTECNO esté encendido');
        console.log('2. Abre SSMS y prueba conectar manualmente');
        console.log('3. Pregunta al administrador si el servidor está en la red');
        console.log('4. Verifica que el servicio SQL Server esté corriendo');
    }
}

test();