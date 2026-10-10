"use strict";
const {profileFromRaw}=require('../domain/worldoffice-client-profile');
async function saveClientMirror(pool,clients){
 if(!Array.isArray(clients)||!clients.length)throw new Error('World Office devolvió cero clientes; se conserva el espejo anterior.');
 const ids=new Set();
 for(const row of clients){
  const id=String(row.IdTercero??'');
  if(!/^\d+$/.test(id)||ids.has(id))throw new Error('World Office devolvió IDs de cliente inválidos o duplicados; se conserva el espejo anterior.');
  ids.add(id);
 }
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('worldoffice_client_mirror'))");
  // Preserve IDs and all rental/service references; never clear this shared table.
  for(const row of clients){
   const profile=clients.profiles?.get(String(row.IdTercero))||{normalized:profileFromRaw(row),relations:{}};
   await db.query(`INSERT INTO sync_clientes(id_externo,documento,razon_social,primer_nombre,segundo_nombre,primer_apellido,segundo_apellido,activo,tipo_documento,datos_completos,client_profile,profile_relations,profile_schema)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb)
    ON CONFLICT (id_externo) DO UPDATE SET
      documento=EXCLUDED.documento,razon_social=EXCLUDED.razon_social,
      primer_nombre=EXCLUDED.primer_nombre,segundo_nombre=EXCLUDED.segundo_nombre,
      primer_apellido=EXCLUDED.primer_apellido,segundo_apellido=EXCLUDED.segundo_apellido,
      activo=EXCLUDED.activo,tipo_documento=EXCLUDED.tipo_documento,
      datos_completos=EXCLUDED.datos_completos,client_profile=EXCLUDED.client_profile,
      profile_relations=EXCLUDED.profile_relations,profile_schema=EXCLUDED.profile_schema,
      fecha_sincronizacion=NOW()`,
    [row.IdTercero,row.Identificacion,row.Nombre,row.Primer_Nombre||null,row.Segundo_Nombre||null,row.Primer_Apellido||null,row.Segundo_Apellido||null,row.Activo===-1||row.Activo===true||row.Activo===1,row.IdTipoIdentificacion,
    JSON.stringify(row),JSON.stringify(profile.normalized),JSON.stringify(profile.relations),JSON.stringify(clients.profileSchema||null)]);
  }
  // Fill missing local contact fields for existing orders without replacing manual data.
  await db.query(`UPDATE clients c SET telefono=COALESCE(NULLIF(c.telefono,''),sc.client_profile->>'telefono'),
   email=COALESCE(NULLIF(c.email,''),sc.client_profile->>'email'),direccion=COALESCE(NULLIF(c.direccion,''),sc.client_profile->>'direccion'),
   ciudad=COALESCE(NULLIF(c.ciudad,''),sc.client_profile->>'ciudad'),"updatedAt"=NOW()
   FROM sync_clientes sc WHERE sc.activo=true AND (c.codigo_worldoffice=sc.id_externo::text OR
    (NULLIF(c.documento,'') IS NOT NULL AND c.documento=sc.documento AND (SELECT count(*) FROM sync_clientes same WHERE same.documento=sc.documento)=1))`);
  await db.query('COMMIT');return clients.length;
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
}
module.exports={saveClientMirror};
