// backend/src/services/worldoffice.service.js
const sql = require('mssql');
const {connectionTarget,resolveTarget,connectionFailure}=require('./worldoffice-connection-config');
const {extractClients}=require('./worldoffice-client-extraction.service');
const {saveClientMirror}=require('./worldoffice-client-mirror.service');
require('dotenv').config();

// Configuración de conexión a World Office
// ============================================================
// CONFIGURACIÓN SQL SERVER / WORLD OFFICE
// ============================================================

const requiredSqlServerEnv = [
    'SQLSERVER_DATABASE',
    'SQLSERVER_USER',
    'SQLSERVER_PASSWORD',
];

for (const key of requiredSqlServerEnv) {
    if (!process.env[key]) {
        throw new Error(
            `Falta la variable de entorno requerida: ${key}`
        );
    }
}

const config = {
    ...connectionTarget(),
    database: process.env.SQLSERVER_DATABASE,
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,

    connectionTimeout: Number(
        process.env.SQLSERVER_CONNECTION_TIMEOUT || 20000
    ),

    requestTimeout: Number(
        process.env.SQLSERVER_REQUEST_TIMEOUT || 60000
    ),

    options: {
        ...connectionTarget().options,

        encrypt:
            String(process.env.SQLSERVER_ENCRYPT)
                .trim()
                .toLowerCase() === 'true',

        trustServerCertificate:
            String(process.env.SQLSERVER_TRUST_CERTIFICATE)
                .trim()
                .toLowerCase() === 'true',

        enableArithAbort: true,
        useUTC: false,
    },

    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool = null;
let connecting = null;

const connect = async () => {
    if (pool?.connected) return pool;
    if (connecting) return connecting;
    connecting = (async () => {
        let candidate;
        try {
            const target = await resolveTarget(config);
            console.log('🔄 Conectando a World Office (Melissa)...');
            candidate = new sql.ConnectionPool(target);
            candidate.on('error', error => { pool = null; console.error('World Office: conexión interrumpida:', error.code); });
            await candidate.connect();
            pool = candidate;
            console.log('✅ Conectado a World Office');
            return pool;
        } catch (error) {
            await candidate?.close().catch(() => {});
            pool = null;
            const failure = connectionFailure(error, config.server);
            console.error('❌ Error al conectar:', failure.message);
            throw failure;
        } finally { connecting = null; }
    })();
    return connecting;
};

// ============================================================
// FUNCIONES DE EXTRACCIÓN
// ============================================================

// Obtener clientes desde Terceros
const getClientes = async () => {
    return extractClients(await connect());
};

// Obtener productos desde Inventarios
const getProductos = async () => {
    try {
        const pool = await connect();
        const result = await pool.request().query(`
            SELECT 
                IdInventario,
                CódigoInventario as Codigo,
                Descripción as Nombre,
                Precio1 as Precio,
                Iva,
                Activo
            FROM Inventarios
        `);
        return result.recordset;
    } catch (error) {
        console.error('❌ Error al obtener productos:', error.message);
        return [];
    }
};

// Obtener seriales desde Inventarios_Seriales
const getSeriales = async () => {
    try {
        const pool = await connect();
        const result = await pool.request().query(`
            SELECT 
                IdSerial,
                Serial,
                IdInventario
            FROM Inventarios_Seriales
        `);
        return result.recordset;
    } catch (error) {
        console.error('❌ Error al obtener seriales:', error.message);
        return [];
    }
};

// Obtener alquileres desde Alquiler_Aplicacion
const getAlquileres = async () => {
    try {
        const pool = await connect();
        const result = await pool.request().query(`
            SELECT 
                Id,
                IdCliente,
                IdInventario,
                cant
            FROM Alquiler_Aplicacion
        `);
        return result.recordset;
    } catch (error) {
        console.error('❌ Error al obtener alquileres:', error.message);
        return [];
    }
};

// ============================================================
// SINCRONIZACIÓN CON POSTGRESQL (USANDO DELETE EN LUGAR DE TRUNCATE)
// ============================================================

const syncAllData = async (pgPool) => {
    if (!pgPool || typeof pgPool.query !== 'function') {
        throw new Error(
            'syncAllData requiere una conexión válida a PostgreSQL'
        );
    }
    try {
        console.log('📦 Iniciando sincronización con World Office...');
        console.log('⏱️  ' + new Date().toISOString());

        await connect();

        // Extraer datos
        const [clientes, productos, seriales, alquileres] = await Promise.all([
            getClientes().catch(e => { console.error('Error en clientes:', e.message); return []; }),
            getProductos().catch(e => { console.error('Error en productos:', e.message); return []; }),
            getSeriales().catch(e => { console.error('Error en seriales:', e.message); return []; }),
            getAlquileres().catch(e => { console.error('Error en alquileres:', e.message); return []; })
        ]);

        const results = {};

        // ============================================================
        // 1. CLIENTES
        // ============================================================
        results.clientes = await saveClientMirror(pgPool, clientes);
        console.log(`✅ Clientes completos: ${results.clientes}`);

        // ============================================================
        // 2. PRODUCTOS
        // ============================================================
        if (productos.length > 0) {
            await pgPool.query('DELETE FROM sync_productos');

            for (const producto of productos) {
                const esActivo = producto.Activo === -1 || producto.Activo === true;

                await pgPool.query(`
                    INSERT INTO sync_productos (
                        id_externo, codigo, nombre, precio_venta, iva, activo, datos_completos
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    producto.IdInventario,
                    producto.Codigo,
                    producto.Nombre,
                    producto.Precio || 0,
                    producto.Iva || 0,
                    esActivo,
                    JSON.stringify(producto)
                ]);
            }
            results.productos = productos.length;
            console.log(`✅ Productos: ${results.productos}`);
        }

        // ============================================================
        // 3. SERIALES
        // ============================================================
        if (seriales.length > 0) {
            await pgPool.query('DELETE FROM sync_seriales');

            for (const serial of seriales) {
                await pgPool.query(`
                    INSERT INTO sync_seriales (
                        id_externo, serial, id_producto_externo, datos_completos
                    ) VALUES ($1, $2, $3, $4)
                `, [
                    serial.IdSerial,
                    serial.Serial,
                    serial.IdInventario,
                    JSON.stringify(serial)
                ]);
            }
            results.seriales = seriales.length;
            console.log(`✅ Seriales: ${results.seriales}`);
        }

        // ============================================================
        // 4. ALQUILERES
        // ============================================================
        if (alquileres.length > 0) {
            await pgPool.query('DELETE FROM sync_alquileres');

            for (const alquiler of alquileres) {
                await pgPool.query(`
                    INSERT INTO sync_alquileres (
                        id_externo, id_cliente_externo, id_producto_externo, cantidad, datos_completos
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    alquiler.Id,
                    alquiler.IdCliente,
                    alquiler.IdInventario,
                    alquiler.cant || 0,
                    JSON.stringify(alquiler)
                ]);
            }
            results.alquileres = alquileres.length;
            console.log(`✅ Alquileres: ${results.alquileres}`);
        }

        // ============================================================
        // 5. ACTUALIZAR CONTROL
        // ============================================================
        await pgPool.query(`
            INSERT INTO sync_control (tabla, total_registros, estado)
            VALUES 
                ('clientes', $1, 'ok'),
                ('productos', $2, 'ok'),
                ('seriales', $3, 'ok'),
                ('alquileres', $4, 'ok')
            ON CONFLICT (tabla) DO UPDATE SET
                ultima_sincronizacion = NOW(),
                total_registros = EXCLUDED.total_registros,
                estado = 'ok'
        `, [results.clientes || 0, results.productos || 0, results.seriales || 0, results.alquileres || 0]);

        // ============================================================
        // 6. LOGS
        // ============================================================
        await pgPool.query(`
            INSERT INTO sync_logs (tabla, tipo, mensaje, registros_afectados)
            VALUES 
                ('clientes', 'info', 'Sincronización completada', $1),
                ('productos', 'info', 'Sincronización completada', $2),
                ('seriales', 'info', 'Sincronización completada', $3),
                ('alquileres', 'info', 'Sincronización completada', $4)
        `, [results.clientes || 0, results.productos || 0, results.seriales || 0, results.alquileres || 0]);

        console.log('✅ Sincronización completada:');
        console.log(`   📊 Clientes: ${results.clientes || 0}`);
        console.log(`   📊 Productos: ${results.productos || 0}`);
        console.log(`   📊 Seriales: ${results.seriales || 0}`);
        console.log(`   📊 Alquileres: ${results.alquileres || 0}`);

        return results;

    } catch (error) {
        console.error('❌ Error en sincronización:', error.message);
        throw error;
    }
};

// Cerrar conexión
const close = async () => {
    if (pool) {
        await pool.close();
        pool = null;
        console.log('🔒 Conexión a World Office cerrada');
    }
};

module.exports = {
    connect,
    getClientes,
    getProductos,
    getSeriales,
    getAlquileres,
    syncAllData,
    close
};