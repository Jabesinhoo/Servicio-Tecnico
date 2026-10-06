"use strict";
const {profileFromRaw,object}=require('../domain/worldoffice-client-profile');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function clientProfile(db,id,origin='local'){
 let local=null,sync=null;
 if(origin==='melissa'){
  if(!/^\d+$/.test(String(id)))throw Object.assign(new Error('Referencia World Office no válida'),{status:400});
  if(!(await db.query("SELECT to_regclass('public.sync_clientes') AS table_name")).rows[0]?.table_name)throw Object.assign(new Error('Todavía no hay clientes sincronizados desde World Office. Ejecuta la sincronización de clientes.'),{status:409});
  sync=(await db.query('SELECT * FROM sync_clientes WHERE id_externo::text=$1',[String(id)])).rows[0];
 }else{
  if(!UUID.test(String(id)))throw Object.assign(new Error('Referencia de cliente no válida'),{status:400});
  local=(await db.query('SELECT * FROM clients WHERE id=$1',[id])).rows[0];
  if(local&&(await db.query("SELECT to_regclass('public.sync_clientes') AS table_name")).rows[0]?.table_name)sync=(await db.query(`SELECT * FROM sync_clientes WHERE id_externo::text=$1 OR (NULLIF($2,'') IS NOT NULL AND documento::text=$2)
   ORDER BY CASE WHEN id_externo::text=$1 THEN 0 ELSE 1 END,id_externo LIMIT 1`,[String(local.codigo_worldoffice||''),String(local.documento||'')])).rows[0];
 }
 if(!local&&!sync)throw Object.assign(new Error('Cliente no encontrado'),{status:404});
 const normalized=sync?{...profileFromRaw(sync.datos_completos,sync.profile_relations),...object(sync.client_profile)}:{};
 const result={...normalized,...(local||{})};
 // Prefer nonempty local data and fill absent fields from the current World Office mirror.
 for(const [key,value] of Object.entries(normalized))if(result[key]===null||result[key]===undefined||result[key]==='')result[key]=value;
 if(sync&&!local)Object.assign(result,{id:String(sync.id_externo),id_externo:String(sync.id_externo),origen:'melissa',cliente_key:'melissa:'+sync.id_externo,
  documento:sync.documento,razon_social:sync.razon_social,primer_nombre:sync.primer_nombre,segundo_nombre:sync.segundo_nombre,primer_apellido:sync.primer_apellido,segundo_apellido:sync.segundo_apellido,
  tipo_persona:sync.primer_nombre||sync.primer_apellido?'natural':'juridica',activo:sync.activo});
 else Object.assign(result,{origen:'local',cliente_key:'local:'+local.id});
 let signatures=[];
 try{
  if((await db.query("SELECT to_regclass('public.client_service_signatures') AS table_name")).rows[0]?.table_name){
  const target=local?.id||(sync?(await db.query(`SELECT id FROM clients WHERE codigo_worldoffice::text=$1 OR (documento::text=$2 AND (SELECT count(*) FROM clients WHERE documento::text=$2)=1) ORDER BY CASE WHEN codigo_worldoffice::text=$1 THEN 0 ELSE 1 END LIMIT 1`,[String(sync.id_externo),String(sync.documento||'')])).rows[0]?.id:null);
  if(target)signatures=(await db.query(`SELECT s.id,s.signer_name,s.signer_document,s.signer_kind,s.captured_at,s.source_table,o.codigo_os FROM client_service_signatures s JOIN service_orders o ON o.id=s.service_order_id WHERE s.client_id=$1 ORDER BY s.captured_at DESC LIMIT 100`,[target])).rows;
  }
 }catch(e){throw e;}

 return {...result,signature_history:signatures,worldoffice_raw:sync?object(sync.datos_completos):null,worldoffice_relations:sync?object(sync.profile_relations):{},
  worldoffice_schema:sync?.profile_schema||null,worldoffice_synced_at:sync?.fecha_sincronizacion||null,worldoffice_id:sync?String(sync.id_externo):null};
}
module.exports={clientProfile};
