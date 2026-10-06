'use strict';
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config();
const pool = require('../src/db/pool');
(async () => {
  let client;
  try {
    client = await pool.connect();
    const required = ['notificaciones', 'service_orders', 'service_order_assignments', 'service_order_team_members'];
    const result = await client.query(`SELECT name, to_regclass('public.' || name) AS relation
      FROM unnest($1::text[]) AS names(name)`, [required]);
    const missing = result.rows.filter(row => !row.relation).map(row => row.name);
    if (missing.length) throw new Error('Faltan tablas: ' + missing.join(', '));
    await client.query(fs.readFileSync(path.join('sql', '20261005-service-assignment-notifications.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join('sql', '20261005-service-acceptance-evidences.sql'), 'utf8'));
    console.log('OK: adjuntos de aceptacion instalados.');
    console.log('OK: avisos internos de asignacion instalados. Prueba una nueva asignacion.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
