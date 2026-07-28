// scripts/test-worldoffice.js
require('dotenv').config();
const worldoffice = require('../src/services/worldoffice.service');

async function testConnection() {
    console.log('🧪 Probando conexión a World Office...\n');
    
    try {
        // 1. Probar conexión
        await worldoffice.connect();
        console.log('✅ Conexión exitosa!\n');
        
        // 2. Obtener clientes
        console.log('📋 Obteniendo clientes...');
        const clientes = await worldoffice.getClientes();
        console.log(`✅ ${clientes.length} clientes encontrados`);
        if (clientes.length > 0) {
            console.log('   Ejemplo:', clientes[0]);
        }
        console.log('');
        
        // 3. Obtener productos
        console.log('📦 Obteniendo productos...');
        const productos = await worldoffice.getProductos();
        console.log(`✅ ${productos.length} productos encontrados`);
        if (productos.length > 0) {
            console.log('   Ejemplo:', productos[0]);
        }
        console.log('');
        
        // 4. Obtener seriales
        console.log('🔢 Obteniendo seriales...');
        const seriales = await worldoffice.getSeriales();
        console.log(`✅ ${seriales.length} seriales encontrados`);
        if (seriales.length > 0) {
            console.log('   Ejemplo:', seriales[0]);
        }
        console.log('');
        
        // 5. Obtener alquileres
        console.log('📄 Obteniendo alquileres...');
        const alquileres = await worldoffice.getAlquileres();
        console.log(`✅ ${alquileres.length} alquileres encontrados`);
        if (alquileres.length > 0) {
            console.log('   Ejemplo:', alquileres[0]);
        }
        console.log('');
        
        // 6. Sincronización completa
        console.log('🔄 Ejecutando sincronización completa...');
        const sync = await worldoffice.syncAllData();
        console.log('✅ Sincronización completada:');
        console.log(`   📊 Clientes: ${sync.totales.clientes}`);
        console.log(`   📊 Productos: ${sync.totales.productos}`);
        console.log(`   📊 Seriales: ${sync.totales.seriales}`);
        console.log(`   📊 Alquileres: ${sync.totales.alquileres}`);
        
        // Cerrar conexión
        await worldoffice.close();
        console.log('\n✅ Prueba completada con éxito!');
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testConnection();