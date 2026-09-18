require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id BIGSERIAL PRIMARY KEY,
        tabla VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        mensaje TEXT,
        registros_afectados INTEGER NOT NULL DEFAULT 0,
        fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_logs_fecha
      ON sync_logs (fecha)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_logs_tabla
      ON sync_logs (tabla)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_logs_tipo
      ON sync_logs (tipo)
    `);

    await client.query('COMMIT');

    console.log('OK: sync_logs creada correctamente.');

    const columns = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sync_logs'
      ORDER BY ordinal_position
    `);

    console.log('\n=== COLUMNAS SYNC_LOGS ===');
    console.table(columns.rows);

    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'sync_logs'
      ORDER BY indexname
    `);

    console.log('\n=== INDICES SYNC_LOGS ===');
    console.table(indexes.rows);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n=== TOTAL TABLAS PUBLIC ===');
    console.log(tables.rows.length);

    console.table(tables.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
