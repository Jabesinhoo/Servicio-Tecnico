'use strict';

const fs = require('fs');
const path = require('path');

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
    'worldoffice_financial_discovery_runs',
    'worldoffice_financial_mappings',
    'worldoffice_financial_read_events',
    'service_order_financial_controls',
    'service_order_financial_verifications',
  ];

  const result =
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
      result.rows.map(
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
      'FALTAN TABLAS V18:',
      missing.join(', ')
    );
    process.exitCode = 2;
    return;
  }

  const sourceCheck =
    await pool.query(
      `
        SELECT
          pg_get_constraintdef(oid)
            AS definition
        FROM pg_constraint
        WHERE
          conname =
            'service_order_financial_verifications_source_ck'
        LIMIT 1
      `
    );

  const sourceDefinition =
    sourceCheck.rows[0]
      ?.definition ||
    '';

  if (
    !sourceDefinition.includes(
      'worldoffice_live'
    )
  ) {
    console.error(
      'El CHECK de verification_source no incluye worldoffice_live.'
    );

    process.exitCode = 2;
    return;
  }

  const mapping =
    await pool.query(
      `
        SELECT
          id,
          profile_name,
          source_schema,
          source_object,
          active,
          observation_only,
          updated_at
        FROM
          worldoffice_financial_mappings
        ORDER BY
          active DESC,
          updated_at DESC
        LIMIT 5
      `
    );

  const discovery =
    await pool.query(
      `
        SELECT
          id,
          database_name,
          object_count,
          candidate_count,
          completed_at
        FROM
          worldoffice_financial_discovery_runs
        ORDER BY
          completed_at DESC
        LIMIT 1
      `
    );

  console.log(
    'V18 HEALTHCHECK'
  );

  console.log(
    'Tablas:',
    requiredTables.length,
    'OK'
  );

  console.log(
    'worldoffice_live source: OK'
  );

  console.log(
    'Mapeos:',
    mapping.rows
  );

  console.log(
    'Ultimo discovery:',
    discovery.rows[0] ||
      null
  );

  console.log(
    'OK: healthcheck local/postgres completo.'
  );

  console.log(
    'Este healthcheck NO consulta SQL Server.'
  );
}

main()
  .catch(
    (error) => {
      console.error(
        'V18 healthcheck error:',
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
