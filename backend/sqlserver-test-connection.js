'use strict';

require('dotenv').config();

const sql = require('mssql');

function boolFromEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).trim().toLowerCase() === 'true';
}

const config = {
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  server: process.env.SQLSERVER_HOST,
  database: process.env.SQLSERVER_DATABASE,

  connectionTimeout: Number(
    process.env.SQLSERVER_CONNECTION_TIMEOUT || 20000
  ),

  requestTimeout: Number(
    process.env.SQLSERVER_REQUEST_TIMEOUT || 60000
  ),

  pool: {
    max: 2,
    min: 0,
    idleTimeoutMillis: 10000
  },

  options: {
    instanceName: process.env.SQLSERVER_INSTANCE || undefined,

    encrypt: boolFromEnv(
      process.env.SQLSERVER_ENCRYPT,
      false
    ),

    trustServerCertificate: boolFromEnv(
      process.env.SQLSERVER_TRUST_CERTIFICATE,
      true
    ),

    enableArithAbort: true,
    useUTC: false
  }
};

async function main() {
  let connection;

  try {
    console.log('========================================');
    console.log('PRUEBA SQL SERVER / WORLD OFFICE');
    console.log('========================================');

    console.log({
      enabled: process.env.SQLSERVER_ENABLED,
      host: process.env.SQLSERVER_HOST,
      instance: process.env.SQLSERVER_INSTANCE,
      database: process.env.SQLSERVER_DATABASE,
      user: process.env.SQLSERVER_USER,
      passwordLoaded: Boolean(process.env.SQLSERVER_PASSWORD)
    });

    if (
      String(process.env.SQLSERVER_ENABLED)
        .trim()
        .toLowerCase() !== 'true'
    ) {
      throw new Error(
        'SQL Server está deshabilitado. SQLSERVER_ENABLED debe ser true.'
      );
    }

    if (
      !config.user ||
      !config.password ||
      !config.server ||
      !config.database
    ) {
      throw new Error(
        'Faltan variables obligatorias de SQL Server en .env'
      );
    }

    console.log('\nConectando a SQL Server...');

    connection = await sql.connect(config);

    console.log('✅ Conexión establecida correctamente.');

    const result = await connection
      .request()
      .query(`
        SELECT
          DB_NAME() AS database_name,
          SUSER_SNAME() AS login_name,
          @@SERVERNAME AS server_name,
          GETDATE() AS server_date
      `);

    console.log('\n✅ Información del servidor:');
    console.table(result.recordset);

    const tables = await connection
      .request()
      .query(`
        SELECT TOP 20
          TABLE_SCHEMA,
          TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `);

    console.log('\n✅ Primeras tablas visibles para este usuario:');
    console.table(tables.recordset);

    console.log('\n========================================');
    console.log('PRUEBA COMPLETADA CORRECTAMENTE');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ ERROR DE CONEXIÓN / CONSULTA');
    console.error('Código:', error.code || 'N/A');
    console.error('Nombre:', error.name || 'N/A');
    console.error('Mensaje:', error.message);

    if (error.originalError?.message) {
      console.error(
        'Original:',
        error.originalError.message
      );
    }

    process.exitCode = 1;

  } finally {
    try {
      if (connection) {
        await sql.close();
        console.log('\n🔒 Conexión cerrada.');
      }
    } catch (closeError) {
      console.error(
        'Error cerrando conexión:',
        closeError.message
      );
    }
  }
}

main();
