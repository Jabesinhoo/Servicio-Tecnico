// backend/src/scheduler/index.js
const cron = require('node-cron');
const { Pool } = require('pg');
const worldoffice = require('../services/worldoffice.service');
const { syncAllData } = require('../services/worldoffice.service');

// Configuración de PostgreSQL
const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

// ============================================================
// TAREA 1: Sincronización con World Office (CADA 5 MINUTOS)
// ============================================================
cron.schedule('*/5 * * * *', async () => {
    console.log(`🔄 [${new Date().toISOString()}] Ejecutando sincronización programada...`);
    
    try {
        const results = await syncAllData(pgPool);
        console.log(`✅ Sincronización completada: ${results.clientes} clientes, ${results.productos} productos`);
    } catch (error) {
        console.error('❌ Error en sincronización programada:', error.message);
        
        // Guardar error en logs
        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje)
            VALUES ('scheduler', 'error', $1)
        `, [`Error en sincronización: ${error.message}`]);
    }
});

// ============================================================
// TAREA 2: Limpieza de logs antiguos (CADA DÍA A LAS 2 AM)
// ============================================================
cron.schedule('0 2 * * *', async () => {
    console.log(`🧹 [${new Date().toISOString()}] Limpiando logs antiguos...`);
    
    try {
        // Eliminar logs de más de 30 días
        await pgPool.query(`
            DELETE FROM sync_logs 
            WHERE fecha < NOW() - INTERVAL '30 days'
        `);
        console.log('✅ Logs antiguos eliminados');
    } catch (error) {
        console.error('❌ Error limpiando logs:', error.message);
    }
});

// ============================================================
// TAREA 3: Verificar integridad de datos (CADA DÍA A LAS 3 AM)
// ============================================================
cron.schedule('0 3 * * *', async () => {
    console.log(`🔍 [${new Date().toISOString()}] Verificando integridad de datos...`);
    
    try {
        // Verificar clientes sin documento
        const result = await pgPool.query(`
            SELECT COUNT(*) as cantidad 
            FROM sync_clientes 
            WHERE documento IS NULL OR documento = ''
        `);
        
        if (parseInt(result.rows[0].cantidad) > 0) {
            console.log(`⚠️ ${result.rows[0].cantidad} clientes sin documento`);
            
            await pgPool.query(`
                INSERT INTO sync_logs (tabla, tipo, mensaje, registros_afectados)
                VALUES ('clientes', 'warning', 'Clientes sin documento', $1)
            `, [parseInt(result.rows[0].cantidad)]);
        }
        
        // Verificar productos sin código
        const result2 = await pgPool.query(`
            SELECT COUNT(*) as cantidad 
            FROM sync_productos 
            WHERE codigo IS NULL OR codigo = ''
        `);
        
        if (parseInt(result2.rows[0].cantidad) > 0) {
            console.log(`⚠️ ${result2.rows[0].cantidad} productos sin código`);
        }
        
        console.log('✅ Verificación completada');
    } catch (error) {
        console.error('❌ Error en verificación:', error.message);
    }
});

// ============================================================
// TAREA 4: Backup de datos sincronizados (CADA SEMANA - DOMINGO 4 AM)
// ============================================================
cron.schedule('0 4 * * 0', async () => {
    console.log(`💾 [${new Date().toISOString()}] Creando backup de datos sincronizados...`);
    
    try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, '../../backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(backupDir, filename);
        
        // Obtener datos
        const clientes = await pgPool.query('SELECT * FROM sync_clientes');
        const productos = await pgPool.query('SELECT * FROM sync_productos');
        
        const backup = {
            fecha: new Date().toISOString(),
            clientes: clientes.rows,
            productos: productos.rows
        };
        
        fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
        console.log(`✅ Backup guardado: ${filename}`);
    } catch (error) {
        console.error('❌ Error en backup:', error.message);
    }
});

// ============================================================
// INICIAR EL SCHEDULER
// ============================================================
console.log('📅 Scheduler iniciado');
console.log('   🔄 Sincronización: cada 5 minutos');
console.log('   🧹 Limpieza de logs: 2:00 AM');
console.log('   🔍 Verificación de datos: 3:00 AM');
console.log('   💾 Backup semanal: Domingo 4:00 AM');

// Exportar para poder detenerlo si es necesario
module.exports = {
    stop: () => {
        cron.getTasks().forEach(task => task.stop());
        console.log('📅 Scheduler detenido');
    }
};