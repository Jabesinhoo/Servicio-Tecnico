'use strict';
const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const pool=require('../src/db/pool');
(async()=>{let db;try{db=await pool.connect();await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='15s'");
 await require('../migrations/production/20261013100000-worldoffice-mirror-text.cjs').up(db);
 await db.query('COMMIT');console.log('OK: nombres, códigos y seriales sincronizados admiten el texto completo. Registros conservados.');
}catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});console.error('ERROR:',e.message);process.exitCode=1;}finally{db?.release();await pool.end();}})();
