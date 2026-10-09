'use strict';
// New, incremental application migrations only. Never replay the full schema dump.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { Client } = createRequire(path.join(process.cwd(), 'package.json'))('pg');

async function migrate(client, directory) {
  await client.query('SELECT pg_advisory_lock(76430902)');
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS public.tecnicos_schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = fs.readdirSync(directory).filter(name => name.endsWith('.cjs')).sort();
    for (const name of files) {
      if (!/^\d{14}-[a-z0-9-]+\.cjs$/.test(name)) throw new Error(`Nombre de migración inválido: ${name}`);
      const filename = path.join(directory, name);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
      const applied = await client.query('SELECT checksum FROM public.tecnicos_schema_migrations WHERE name=$1', [name]);
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum) throw new Error(`La migración aplicada fue modificada: ${name}`);
        continue;
      }
      const migration = require(filename);
      if (typeof migration.up !== 'function') throw new Error(`Falta up(db): ${name}`);
      await client.query('BEGIN');
      try {
        await client.query("SET LOCAL lock_timeout = '15s'");
        await client.query("SET LOCAL statement_timeout = '120s'");
        await migration.up({query: client.query.bind(client)});
        await client.query('INSERT INTO public.tecnicos_schema_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
        await client.query('COMMIT');
        console.log(`OK migración: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Migraciones de producción verificadas.');
  } finally { await client.query('SELECT pg_advisory_unlock(76430902)'); }
}
async function main() {
  const client = new Client({host:process.env.DB_HOST, port:Number(process.env.DB_PORT||5432),
    database:process.env.DB_NAME, user:process.env.DB_USER, password:process.env.DB_PASSWORD,
    connectionTimeoutMillis:10000});
  try {
    await client.connect();
    const {rows} = await client.query('SELECT current_database() AS name');
    if (rows[0].name !== 'tecnicos') throw new Error('Este runner está destinado exclusivamente a la base tecnicos.');
    await migrate(client,process.argv[2] || path.resolve('migrations/production'));
  } finally { await client.end(); }
}
module.exports = {migrate};
if (require.main === module) main().catch(error=>{console.error('Migraciones:',error.message);process.exitCode=1;});
