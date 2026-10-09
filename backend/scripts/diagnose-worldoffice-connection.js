'use strict';
const path = require('node:path');
const fs = require('node:fs');
const sql = require('mssql');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { connectionTarget, resolveTarget, connectionFailure } = require('../src/services/worldoffice-connection-config');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); if (index < 0) return undefined; const value = args[index + 1]; if (!value || value.startsWith('--')) throw new Error('Falta el valor de ' + name); return value; };

(async () => {
  let connection;
  try {
    const address = option('--address'), port = option('--port');
    const target = connectionTarget({ ...process.env, ...(address ? { SQLSERVER_ADDRESS: address } : {}), ...(port ? { SQLSERVER_PORT: port } : {}) });
    console.log('Servidor configurado:', target.server, target.port ? 'TCP ' + target.port : 'instancia ' + (target.options.instanceName || 'predeterminada'));
    const resolved = await resolveTarget(target);
    if (resolved.server !== target.server) console.log('Windows encontró el servidor en:', resolved.server);
    connection = new sql.ConnectionPool({ ...resolved, database: process.env.SQLSERVER_DATABASE, user: process.env.SQLSERVER_USER, password: process.env.SQLSERVER_PASSWORD, connectionTimeout: 15000, requestTimeout: 15000, options: { ...resolved.options, encrypt: process.env.SQLSERVER_ENCRYPT === 'true', trustServerCertificate: process.env.SQLSERVER_TRUST_CERTIFICATE !== 'false', enableArithAbort: true } });
    await connection.connect();
    const result = await connection.request().query('SELECT DB_NAME() AS database_name');
    console.log('OK: conexión SQL Server y autenticación. Base:', result.recordset[0].database_name);
    for (const company of ['Melissa', 'Power_ON', 'SAS']) {
      try { await connection.request().query(`SELECT TOP (1) [Numero_Documento] FROM [${company}].[dbo].[Vista_Auxiliar_Movimientos_Inventario]`); console.log('OK: lectura de facturas en', company); }
      catch (error) { console.log('AVISO: no se pudo leer facturas de', company, '- código:', error.code || 'SQL_ERROR'); }
    }
    if (args.includes('--save')) {
      const envPath = path.resolve(__dirname, '../.env');
      const changes = { SQLSERVER_ADDRESS: resolved.server, ...(resolved.port ? { SQLSERVER_PORT: String(resolved.port) } : {}) };
      let content = fs.readFileSync(envPath, 'utf8');
      fs.copyFileSync(envPath, envPath + '.worldoffice-backup-' + Date.now());
      for (const [key, value] of Object.entries(changes)) {
        const line = key + '=' + JSON.stringify(value);
        const pattern = new RegExp('^\\s*' + key + '\\s*=.*$', 'm');
        content = pattern.test(content) ? content.replace(pattern, () => line) : content.trimEnd() + '\n' + line + '\n';
      }
      fs.writeFileSync(envPath, content);
      console.log('OK: dirección comprobada guardada. Credenciales conservadas. Reinicia el backend.');
    }
  } catch (error) {
    const failure = connectionFailure(error, process.env.SQLSERVER_ADDRESS || process.env.SQLSERVER_HOST);
    console.error('ERROR:', failure.message);
    if (failure.code === 'WORLDOFFICE_HOST_NOT_FOUND') console.error('Hace falta una dirección del servidor accesible desde este computador. Usa la IP real de TECNOSERVER: node scripts/diagnose-worldoffice-connection.js --address IP_DEL_SERVIDOR --save. Debes estar en la red o VPN con acceso al servidor.');
    else console.error('Revisa red/VPN, SQL Server Browser si usas instancia, puerto TCP y credenciales. Si conoces el puerto TCP real, añade --port PUERTO.');
    console.error('No se guardaron cambios de conexión.');
    process.exitCode = 1;
  } finally { await connection?.close().catch(() => {}); }
})();
