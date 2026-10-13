'use strict';
exports.up=async db=>{
 const fields={sync_productos:['codigo','nombre'],sync_seriales:['serial']};
 for(const [table,columns] of Object.entries(fields))for(const column of columns){
  const result=await db.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,[table,column]);
  if(result.rows[0]?.data_type==='character varying')await db.query(`ALTER TABLE public.${table} ALTER COLUMN ${column} TYPE text`);
 }
};
