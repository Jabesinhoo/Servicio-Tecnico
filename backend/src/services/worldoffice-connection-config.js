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
  return error;
}

async function resolveTarget(config, { lookup = dns.lookup, netbiosLookup = windowsAddress, platform = process.platform } = {}) {
  if (net.isIP(config.server)) return config;
  try { await lookup(config.server); return config; }
  catch (error) {
    if (error.code !== 'ENOTFOUND') throw error;
    if (platform === 'win32') {
      const address = await netbiosLookup(config.server);
      if (address) return { ...config, server: address };
    }
    throw connectionFailure(error, config.server);
  }
}
module.exports = { connectionTarget, resolveTarget, connectionFailure };
