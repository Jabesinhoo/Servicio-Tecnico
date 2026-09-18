require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOTS = [
  path.join(__dirname, 'src'),
  path.join(__dirname, 'scripts')
];

function walk(dir) {
  let files = [];

  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (/\.(js|cjs|sql)$/i.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

const patterns = [
  /\bFROM\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bJOIN\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bINTO\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bUPDATE\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /\bDELETE\s+FROM\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)/gi
];

const ignored = new Set([
  'select',
  'values',
  'set',
  'where',
  'returning',
  'information_schema',
  'pg_indexes',
  'pg_tables',
  'unnest',
  'jsonb_array_elements',
  'generate_series'
]);

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    const references = new Map();

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const content = fs.readFileSync(file, 'utf8');

        for (const regex of patterns) {
          regex.lastIndex = 0;

          let match;

          while ((match = regex.exec(content))) {
            const table = String(match[1] || '')
              .replace(/["'`;(),]/g, '')
              .trim()
              .toLowerCase();

            if (!table || ignored.has(table)) continue;

            if (!references.has(table)) {
              references.set(table, new Set());
            }

            references
              .get(table)
              .add(path.relative(__dirname, file));
          }
        }
      }
    }

    const dbResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const existing = new Set(
      dbResult.rows.map(r => r.tablename.toLowerCase())
    );

    const rows = [...references.keys()]
      .sort()
      .map(table => ({
        tabla: table,
        existe_en_db: existing.has(table) ? 'SI' : 'NO',
        archivos: [...references.get(table)]
          .slice(0, 4)
          .join(' | ')
      }));

    console.log('\n=== TABLAS REFERENCIADAS POR EL BACKEND ===');
    console.table(rows);

    const missing = rows.filter(
      r => r.existe_en_db === 'NO'
    );

    console.log('\n==========================================');
    console.log('TABLAS REFERENCIADAS PERO AUSENTES');
    console.log('==========================================');

    if (missing.length) {
      console.table(missing);
    } else {
      console.log('NINGUNA.');
    }

    console.log('\n=== RESUMEN ===');
    console.log('Referenciadas:', rows.length);
    console.log('Existentes DB:', existing.size);
    console.log('Faltantes:', missing.length);

  } catch (error) {
    console.error('\nERROR:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
