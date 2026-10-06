"use strict";
const {profileFromRaw}=require('../domain/worldoffice-client-profile');
const identifier = name => '['+String(name).replace(/]/g,']]')+']';
const PROFILE_TABLE = /contact|direcc|sucur|telefono|correo|email|ciudad|municip|depart|pais|tipoident|tipodoc|formapago|listaprecio|actividadecon|regimen|clasific|zona|sector|barrio/i;
async function extractClients(connection){
 const response=await connection.request().query('SELECT * FROM Terceros');
 const clients=response.recordset;
 if(!clients.length)throw new Error('World Office devolvió cero terceros; se conserva el espejo anterior.');
 if(!clients.every(row=>row.IdTercero!==undefined&&row.IdTercero!==null))throw new Error('Terceros no contiene IdTercero en todos los registros');
 const metadata=await connection.request().query(`SELECT fk.object_id AS relation_id, fkc.constraint_column_id AS ordinal,
 sp.name AS parent_schema,tp.name AS parent_table,cp.name AS parent_column,
 sr.name AS reference_schema,tr.name AS reference_table,cr.name AS reference_column,
 CASE WHEN fkc.parent_object_id=OBJECT_ID('Terceros') THEN 'outgoing' ELSE 'incoming' END AS direction
 FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id=fkc.constraint_object_id
 JOIN sys.tables tp ON tp.object_id=fkc.parent_object_id JOIN sys.schemas sp ON sp.schema_id=tp.schema_id
 JOIN sys.columns cp ON cp.object_id=tp.object_id AND cp.column_id=fkc.parent_column_id
 JOIN sys.tables tr ON tr.object_id=fkc.referenced_object_id JOIN sys.schemas sr ON sr.schema_id=tr.schema_id
 JOIN sys.columns cr ON cr.object_id=tr.object_id AND cr.column_id=fkc.referenced_column_id
 WHERE fkc.parent_object_id=OBJECT_ID('Terceros') OR fkc.referenced_object_id=OBJECT_ID('Terceros')
 ORDER BY fk.object_id,fkc.constraint_column_id`);
 const groups=new Map();for(const row of metadata.recordset){if(!groups.has(row.relation_id))groups.set(row.relation_id,[]);groups.get(row.relation_id).push(row);}
 const relations=new Map(clients.map(row=>[String(row.IdTercero),{}]));const included=[];const deferred=[];
 for(const columns of groups.values()){
  const first=columns[0];const outgoing=first.direction==='outgoing';
  const schema=outgoing?first.reference_schema:first.parent_schema;const table=outgoing?first.reference_table:first.parent_table;
  if(table==='Terceros'||!PROFILE_TABLE.test(table)){deferred.push({table:schema+'.'+table,direction:first.direction});continue;}
  const join=columns.map(col=>'t.'+identifier(outgoing?col.parent_column:col.reference_column)+'=r.'+identifier(outgoing?col.reference_column:col.parent_column)).join(' AND ');
  const label=schema+'.'+table+' ('+first.relation_id+')';
  const result=await connection.request().query(`SELECT t.IdTercero AS __wo_owner_id, r.* FROM ${identifier(schema)}.${identifier(table)} r JOIN Terceros t ON ${join}`);
  for(const row of result.recordset){const {__wo_owner_id,...values}=row;const target=relations.get(String(__wo_owner_id));if(target){if(!target[label])target[label]=[];target[label].push(values);}}
  included.push({table:schema+'.'+table,direction:first.direction,columns:columns.map(col=>({parent:col.parent_column,reference:col.reference_column})),source:'foreign_key'});
 }
 const schema={master_table:'Terceros',fields:Object.keys(clients[0]),related_tables:included,other_relations:deferred,extracted_at:new Date().toISOString()};
 Object.defineProperty(clients,'profiles',{value:new Map(clients.map(row=>{const related=relations.get(String(row.IdTercero));return [String(row.IdTercero),{normalized:profileFromRaw(row,related),relations:related}];}))});
 Object.defineProperty(clients,'profileSchema',{value:schema});
 return clients;
}
module.exports={extractClients,identifier};
