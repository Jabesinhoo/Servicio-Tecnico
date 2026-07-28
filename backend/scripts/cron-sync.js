// backend/scripts/cron-sync.js
require('dotenv').config();
const { Pool } = require('pg');
const worldoffice = require('../src/services/worldoffice.service');
const fs = require('fs');
const path = require('path');

// Configurar directorio de logs
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'sync.log');

// Función para escribir logs
function writeLog(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

async function runSync() {
    const startTime = Date.now();
    writeLog('Iniciando sincronización programada');

    const pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1235',
        database: process.env.DB_NAME || 'tecnicos'
    });

    try {
        await pgPool.query('SELECT 1');
        writeLog('Conectado a PostgreSQL');

        const results = await worldoffice.syncAllData(pgPool);

        const duration = (Date.now() - startTime) / 1000;
        writeLog(`Sincronización completada en ${duration}s`);
        writeLog(`  Clientes: ${results.clientes || 0}`);
        writeLog(`  Productos: ${results.productos || 0}`);
        writeLog(`  Seriales: ${results.seriales || 0}`);
        writeLog(`  Alquileres: ${results.alquileres || 0}`);

        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje, registros_afectados)
            VALUES ('cron', 'info', 'Sincronización automática completada', $1)
        `, [results.clientes + results.productos + results.seriales + results.alquileres]);

    } catch (error) {
        writeLog(`ERROR: ${error.message}`, 'ERROR');
        
        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje)
            VALUES ('cron', 'error', $1)
        `, [error.message]);

    } finally {
        await worldoffice.close();
        await pgPool.end();
        writeLog('Conexiones cerradas');
    }
}

// Ejecutar sincronización
runSync();