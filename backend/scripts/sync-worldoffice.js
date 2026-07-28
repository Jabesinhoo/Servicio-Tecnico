// backend/scripts/sync-worldoffice.js
require('dotenv').config();
const worldoffice = require('../src/services/worldoffice.service');

async function sync() {
    console.log('🔄 Sincronizando con World Office...\n');
    
    try {
        // 1. Obtener datos
        const data = await worldoffice.syncAllData();
        
        // 2. Guardar en archivo JSON (para depuración)
        const fs = require('fs');
        const path = require('path');
        const syncDir = path.join(__dirname, '../sync-data');
        
        if (!fs.existsSync(syncDir)) {
            fs.mkdirSync(syncDir, { recursive: true });
        }
        
        const filename = `sync_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(syncDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`📁 Datos guardados en: ${filepath}`);
        
        // 3. Mostrar resumen
        console.log('\n📊 RESUMEN:');
        console.log(`   Clientes: ${data.totales.clientes}`);
        console.log(`   Productos: ${data.totales.productos}`);
        console.log(`   Seriales: ${data.totales.seriales}`);
        console.log(`   Alquileres: ${data.totales.alquileres}`);
        console.log(`   Inventario: ${data.totales.inventario}`);
        
        // 4. Cerrar conexión
        await worldoffice.close();
        console.log('\n✅ Sincronización completada con éxito!');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error.message);
        process.exit(1);
    }
}

sync();