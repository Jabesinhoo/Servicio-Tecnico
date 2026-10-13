'use strict';
const specs={
 sync_productos:['id_externo','codigo','nombre','precio_venta','iva','activo','datos_completos'],
 sync_seriales:['id_externo','serial','id_producto_externo','datos_completos'],
 sync_alquileres:['id_externo','id_cliente_externo','id_producto_externo','cantidad','datos_completos']
};
async function saveExternalMirror(pool,table,rows){
 const columns=specs[table];if(!columns)throw new Error('Tabla de sincronización no permitida.');
 if(!rows.length)return 0;
 const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[table]);
  const limits=(await db.query(`SELECT column_name,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND data_type='character varying'`,[table])).rows;
  for(const values of rows)for(const limit of limits){const index=columns.indexOf(limit.column_name);if(index>=0&&values[index]!=null&&[...String(values[index])].length>limit.character_maximum_length)throw new Error(`${table}.${limit.column_name}: registro World Office ${values[0]} supera ${limit.character_maximum_length} caracteres. Ejecuta node scripts/install-sync-text.js; se conservan los datos anteriores.`);}
  const sql=`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(id_externo) DO UPDATE SET ${columns.slice(1).map(c=>c+'=EXCLUDED.'+c).join(',')},fecha_sincronizacion=NOW()`;
  for(const values of rows)await db.query(sql,values);
  await db.query('COMMIT');return rows.length;
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
}
module.exports={saveExternalMirror};
