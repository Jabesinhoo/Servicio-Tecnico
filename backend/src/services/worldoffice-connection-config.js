'use strict';
const dns = require('node:dns').promises;
const net = require('node:net');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);

function connectionTarget(env = process.env) {
  const configured = String(env.SQLSERVER_ADDRESS || env.SQLSERVER_HOST || '').trim();
  const [server, embeddedInstance] = configured.split('\\');
  if (!server) throw Object.assign(new Error('Falta SQLSERVER_HOST o SQLSERVER_ADDRESS.'), { code: 'WORLDOFFICE_CONFIG_INCOMPLETE', status: 503 });
  const portText = String(env.SQLSERVER_PORT || '').trim();
  const port = portText ? Number(portText) : undefined;
  if (portText && (!Number.isInteger(port) || port < 1 || port > 65535)) throw Object.assign(new Error('SQLSERVER_PORT debe ser un puerto TCP entre 1 y 65535.'), { code: 'WORLDOFFICE_CONFIG_INCOMPLETE', status: 503 });
  const instanceName = port ? undefined : String(env.SQLSERVER_INSTANCE || embeddedInstance || '').trim() || undefined;
  return { server, ...(port ? { port } : {}), options: { instanceName } };
}

async function windowsAddress(host) {
  if (!/^[a-z0-9_.-]+$/i.test(host)) return null;
  let output;
  try { output = (await execute('ping.exe', ['-4', '-n', '1', '-w', '1000', host], { timeout: 5000, windowsHide: true })).stdout; }
  catch (error) { output = error.stdout || ''; }
  // Windows ping can resolve a LAN/NetBIOS name even when Node DNS cannot.
  const address = String(output).match(/\[(\d+\.\d+\.\d+\.\d+)\]/)?.[1];
  return address && net.isIP(address) ? address : null;
}

function connectionFailure(error, server) {
  const text = [error?.message, error?.originalError?.message, error?.cause?.message].filter(Boolean).join(' ');
  if (error?.code === 'ENOTFOUND' || /getaddrinfo ENOTFOUND/i.test(text)) {
    return Object.assign(new Error('World Office no está disponible: no se encuentra su servidor en la red. Puedes continuar sin factura y vincularla después.'), { status: 503, code: 'WORLDOFFICE_HOST_NOT_FOUND', server, cause: error });
  }
  if (['EINSTLOOKUP','ETIMEOUT','ESOCKET'].includes(error?.code)) {
    return Object.assign(new Error('World Office no está disponible: revisa la red o VPN y el puerto TCP del servidor. Ejecuta node scripts/diagnose-worldoffice-connection.js --save desde backend. Puedes continuar sin factura.'), {status:503, code:'WORLDOFFICE_CONNECTION_UNAVAILABLE', server, cause:error});
  }
  return error;
}

async function resolveTarget(config, { lookup = dns.lookup, netbiosLookup = windowsAddress, platform = process.platform, nativeResolve = nativeTcpTarget } = {}) {
  // Native Windows SQL Client can resolve LAN names and named-instance TCP ports
  // that Node DNS/SQL Browser cannot. No credentials are placed in arguments.
  if (platform === 'win32' && config.options?.instanceName && config.user && config.password) {
    try {
      const target = await nativeResolve(config);
      return { ...config, server: target.server, port: target.port, options: {...config.options, instanceName: undefined} };
    } catch (_) { /* Preserve the normal Node connection path and its error. */ }
  }
  if (net.isIP(config.server)) return config;
  try { const resolved = await lookup(config.server); return { ...config, server: resolved.address || config.server }; }
  catch (error) {
    if (error.code !== 'ENOTFOUND') throw error;
    if (platform === 'win32') {
      const address = await netbiosLookup(config.server);
      if (address) return { ...config, server: address };
    }
    throw connectionFailure(error, config.server);
  }
}
const nativeTargets = new Map();
async function nativeTcpTarget(config) {
  const key = JSON.stringify([config.server, config.options?.instanceName, config.database, config.user, config.password, config.options?.encrypt, config.options?.trustServerCertificate]);
  const cached = nativeTargets.get(key);
  if (cached && cached.expires > Date.now()) return cached.target;
  const script = `
$ErrorActionPreference='Stop'
try {
 Add-Type -AssemblyName System.Data
 $b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
 $b.DataSource=$env.WO_TARGET
 $b.InitialCatalog=$env.WO_DATABASE
 $b.UserID=$env.WO_USER
 $b.Password=$env.WO_PASSWORD
 $b.ConnectTimeout=8
 $b.Encrypt=($env.WO_ENCRYPT -eq 'true')
 $b.TrustServerCertificate=($env.WO_TRUST -eq 'true')
 $c=New-Object System.Data.SqlClient.SqlConnection($b.ConnectionString)
 $c.Open()
 $q=$c.CreateCommand()
 $q.CommandTimeout=8
 $q.CommandText="SELECT CONVERT(varchar(48),CONNECTIONPROPERTY('local_net_address')), CONVERT(int,CONNECTIONPROPERTY('local_tcp_port'))"
 $reader=$q.ExecuteReader()
 if ($reader.Read()) { @{server=$reader.GetString(0);port=$reader.GetInt32(1)} | ConvertTo-Json -Compress }
} catch { [Console]::Error.WriteLine('Native SQL TCP discovery failed'); exit 1 }
finally { if ($c) { $c.Dispose() } }
`;
  const result = await execute('powershell.exe', ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')], {
    timeout:20000, windowsHide:true,
    env:{...process.env, WO_TARGET:'tcp:'+config.server+'\\'+config.options.instanceName,
      WO_DATABASE:config.database || 'master', WO_USER:config.user, WO_PASSWORD:config.password,
      WO_ENCRYPT:String(Boolean(config.options.encrypt)), WO_TRUST:String(Boolean(config.options.trustServerCertificate))}
  });
  const target=JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));
  if (!net.isIP(target.server) || !Number.isInteger(target.port) || target.port<1 || target.port>65535) throw new Error('Invalid native SQL TCP target');
  if (nativeTargets.size>8) nativeTargets.clear();
  nativeTargets.set(key,{target,expires:Date.now()+60000});
  return target;
}
module.exports = { connectionTarget, resolveTarget, connectionFailure, nativeTcpTarget };
