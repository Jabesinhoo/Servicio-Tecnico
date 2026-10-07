'use strict';
const {profileFromRaw,object}=require('../domain/worldoffice-client-profile');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function clientSummary(db,id,origin='local'){
 let local=null,sync=null;
 if(origin==='melissa'){
  if(!/^\d+$/.test(String(id)))throw Object.assign(new Error('Cliente no válido'),{status:400});
  sync=(await db.query('SELECT id_externo,documento,razon_social,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,client_profile,datos_completos FROM sync_clientes WHERE id_externo=$1',[id])).rows[0];
 }else{
  if(!UUID.test(String(id)))throw Object.assign(new Error('Cliente no válido'),{status:400});
  local=(await db.query(`SELECT id,tipo_persona,documento,razon_social,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,telefono,email,direccion,ciudad,codigo_worldoffice,to_jsonb(c)->>'telefono_2' AS telefono_2 FROM clients c WHERE id=$1`,[id])).rows[0];
  if(local&&(await db.query("SELECT to_regclass('public.sync_clientes') AS t")).rows[0]?.t){
   if(local.codigo_worldoffice)sync=(await db.query('SELECT id_externo,client_profile,datos_completos FROM sync_clientes WHERE id_externo=$1',[local.codigo_worldoffice])).rows[0];
   if(!sync&&local.documento)sync=(await db.query('SELECT id_externo,client_profile,datos_completos FROM sync_clientes WHERE documento=$1 ORDER BY id_externo LIMIT 1',[local.documento])).rows[0];
  }
 }
 if(!local&&!sync)throw Object.assign(new Error('Cliente no encontrado'),{status:404});
 const normalized=sync?profileFromRaw(sync.datos_completos):{};
 for(const[k,v]of Object.entries(object(sync?.client_profile)))if(v!==null&&v!==undefined&&String(v).trim()!=='')normalized[k]=v;
 if(sync&&!normalized.telefono){const related=(await db.query('SELECT profile_relations FROM sync_clientes WHERE id_externo=$1',[sync.id_externo])).rows[0];Object.assign(normalized,profileFromRaw(sync.datos_completos,related?.profile_relations));}
 const source=local||sync;const result={id:String(source.id||source.id_externo),origen:local?'local':'melissa',id_externo:local?null:String(sync.id_externo)};
 for(const key of ['tipo_persona','documento','razon_social','primer_nombre','segundo_nombre','primer_apellido','segundo_apellido','telefono','telefono_2','email','direccion','ciudad','contacto'])result[key]=source[key]||normalized[key]||null;
 result.worldoffice_id=sync?String(sync.id_externo):(local?.codigo_worldoffice?String(local.codigo_worldoffice):null);
 result.telefono=result.telefono||result.telefono_2||null;
 result.display_name=result.razon_social||[result.primer_nombre,result.segundo_nombre,result.primer_apellido,result.segundo_apellido].filter(Boolean).join(' ')||result.documento;
 return result;
}
module.exports={clientSummary};
