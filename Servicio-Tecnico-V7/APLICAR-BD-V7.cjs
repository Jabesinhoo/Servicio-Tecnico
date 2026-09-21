const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) throw new Error('Falta ProjectRoot');

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(root, 'backend', '.env') });

const pool = require(path.join(root, 'backend', 'src', 'db', 'pool'));

(async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, 'sql', '20260921-servicios-v7.sql'),
    'utf8'
  );

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('OK DB: migración V7 aplicada.');
  } catch (error) {
    console.error('V7 DB migration error:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
