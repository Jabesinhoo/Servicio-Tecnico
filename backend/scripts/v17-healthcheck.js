'use strict';

const path = require('path');
const fs = require('fs');

const envPath =
  path.resolve(
    __dirname,
    '../.env'
  );

if (fs.existsSync(envPath)) {
  require('dotenv').config({
    path: envPath,
    quiet: true,
  });
}

const pool =
  require('../src/db/pool');

async function main() {
  const requiredTables = [
    'service_order_financial_controls',
    'service_order_financial_verifications',
    'service_order_financial_events',
    'service_order_documents',
    'service_order_document_events',
    'service_notification_outbox',
  ];

  const tableResult =
    await pool.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name =
            ANY($1::text[])
      `,
      [
        requiredTables,
      ]
    );

  const found =
    new Set(
      tableResult.rows.map(
        (row) =>
          row.table_name
      )
    );

  const missing =
    requiredTables.filter(
      (table) =>
        !found.has(table)
    );

  if (missing.length) {
    console.error(
      'FALTAN TABLAS:',
      missing.join(', ')
    );

    process.exitCode = 2;
    return;
  }

  const summary =
    await pool.query(
      `
        SELECT
          clearance_status,
          COUNT(*)::int AS total
        FROM service_order_financial_controls
        GROUP BY clearance_status
        ORDER BY clearance_status
      `
    );

  const inconsistencies =
    await pool.query(
      `
        SELECT
          fc.service_order_id,
          so.codigo_os,
          fc.clearance_status,
          fc.verification_required,
          fc.last_verified_at,
          COUNT(v.id)::int
            AS verification_count
        FROM
          service_order_financial_controls fc
        JOIN
          service_orders so
          ON
            so.id =
              fc.service_order_id
        LEFT JOIN
          service_order_financial_verifications v
          ON
            v.service_order_id =
              fc.service_order_id
        WHERE
          fc.verification_required =
            TRUE
          AND
          fc.clearance_status =
            'cleared'
        GROUP BY
          fc.service_order_id,
          so.codigo_os,
          fc.clearance_status,
          fc.verification_required,
          fc.last_verified_at
        HAVING
          fc.last_verified_at IS NULL
          AND
          COUNT(v.id) = 0
      `
    );

  const deliveredBlocked =
    await pool.query(
      `
        SELECT
          so.codigo_os,
          fc.clearance_status,
          d.delivered_at
        FROM
          service_order_deliveries d
        JOIN
          service_orders so
          ON
            so.id =
              d.service_order_id
        JOIN
          service_order_financial_controls fc
          ON
            fc.service_order_id =
              d.service_order_id
        WHERE
          d.status =
            'delivered'
          AND
          fc.verification_required =
            TRUE
          AND
          fc.clearance_status
            NOT IN (
              'cleared',
              'not_required'
            )
        ORDER BY
          d.delivered_at DESC
        LIMIT 20
      `
    );

  console.log(
    'V17 HEALTHCHECK'
  );

  console.log(
    'Tablas:',
    requiredTables.length,
    'OK'
  );

  console.log(
    'Estados financieros:',
    summary.rows
  );

  console.log(
    'Liberaciones sin evidencia:',
    inconsistencies.rowCount
  );

  console.log(
    'Entregas históricas con control no liberado:',
    deliveredBlocked.rowCount
  );

  if (
    inconsistencies.rowCount >
      0 ||
    deliveredBlocked.rowCount >
      0
  ) {
    console.log(
      'ADVERTENCIA: hay datos para revisión. El script NO modifica nada.'
    );
  } else {
    console.log(
      'OK: no se detectaron contradicciones financieras básicas.'
    );
  }
}

main()
  .catch(
    (error) => {
      console.error(
        'V17 healthcheck error:',
        error
      );
      process.exitCode = 1;
    }
  )
  .finally(
    async () => {
      try {
        await pool.end();
      } catch (_) {}
    }
  );
