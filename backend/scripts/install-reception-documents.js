'use strict';
const path = require('path');
const fs = require('fs');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config();
const pool = require('../src/db/pool');
const { getBrowserPath } = require('../src/services/service-document-pdf.service');
(async () => {
  let client;
  try {
    // Verifica el navegador antes de cambiar la base de datos.
    require('puppeteer-core');
    console.log('Navegador PDF:', getBrowserPath());
    client = await pool.connect();
    const required = ['service_order_intakes', 'service_order_reception_checklists',
      'service_order_reception_acts', 'service_order_evidences', 'service_order_diagnostics',
      'service_order_closures', 'service_order_deliveries', 'service_order_final_evidences',
      'service_order_delivery_evidences', 'service_order_satisfaction', 'service_order_client_notifications',
      'service_order_team_members', 'service_notification_outbox'];
    const result = await client.query(`SELECT name, to_regclass('public.' || name) AS relation
      FROM unnest($1::text[]) AS names(name)`, [required]);
    const missing = result.rows.filter(row => !row.relation).map(row => row.name);
    if (missing.length) throw new Error('Faltan tablas de etapas anteriores: ' + missing.join(', '));
    for (const file of ['20261005-service-equipment-intake.sql', '20260901-formal-service-documents-v16.sql']) {
      await client.query(fs.readFileSync(path.join('sql', file), 'utf8'));
      console.log('OK SQL:', file);
    }
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
