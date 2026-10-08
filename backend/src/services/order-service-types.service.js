'use strict';
const {readRequirements}=require('./service-type-inventory.service');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
function validateTypeIds(ids){if(!Array.isArray(ids)||!ids.length||ids.length>30)fail('Selecciona entre 1 y 30 tipos de servicio.');if(ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))||new Set(ids.map(id=>id.toLowerCase())).size!==ids.length)fail('La selección de tipos de servicio contiene referencias inválidas o repetidas.');return ids;}
function sameSelection(types,ids){return types.length===ids.length&&types.every((t,n)=>String(t.id).toLowerCase()===String(ids[n]).toLowerCase());}
async function prepareServiceTypes(client,body,existing=null){
 if(body.service_type_ids===undefined)return null;
 const ids=validateTypeIds(body.service_type_ids);let types;
 if(existing?.service_types?.length&&sameSelection(existing.service_types,ids))types=existing.service_types;
 else {const rows=(await client.query('SELECT * FROM tipos_servicio WHERE id=ANY($1::uuid[]) AND activo=true FOR SHARE',[ids])).rows;if(rows.length!==ids.length)fail('Uno de los tipos seleccionados no existe o está inactivo.');const requirements=await readRequirements(client,ids);types=ids.map(id=>{const t=rows.find(t=>t.id.toLowerCase()===id.toLowerCase());return {id:t.id,nombre:t.nombre,categoria:t.categoria,descripcion:t.descripcion,valor_base:Number(t.valor_base||0),duracion_estimada:Number(t.duracion_estimada||60),requiere_diagnostico:!!t.requiere_diagnostico,inventory_requirements:requirements.filter(i=>i.service_type_id===t.id).map(({stock_actual,service_type_id,...i})=>i)};});}
 const duration=types.reduce((sum,t)=>sum+Number(t.duracion_estimada||60),0);if(!Number.isInteger(duration)||duration<1||duration>1440)fail('La duración total debe estar entre 1 y 1440 minutos.');
 body.service_type_id=types[0].id;body.service_type_name=types.map(t=>t.nombre).join(' + ').slice(0,180);body.service_type_category=types.map(t=>t.categoria).filter(Boolean).join(', ').slice(0,120);body.estimated_minutes=duration;body.estimated_duration=duration;body.duracion_estimada=duration;if(body.base_value===undefined)body.base_value=types.reduce((sum,t)=>sum+Number(t.valor_base||0),0);
 return types;
}
async function saveIntakeTypes(client,intakeId,types){await client.query('UPDATE service_order_intakes SET service_types=$2::jsonb WHERE id=$1',[intakeId,JSON.stringify(types)]);}
async function replaceOrderServices(client,orderId,types,details={}){
 await client.query('DELETE FROM service_order_services WHERE service_order_id=$1',[orderId]);
 for(const type of types)await client.query(`INSERT INTO service_order_services(service_order_id,tipo_servicio_id,tipo_servicio_nombre,descripcion_problema,observaciones,precio_estimado,requiere_diagnostico,requiere_repuestos,"createdAt","updatedAt",inventory_requirements,estimated_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,false,now(),now(),$8::jsonb,$9)`,[orderId,type.id,type.nombre,details.request_description||null,details.scope_text||type.descripcion||null,type.valor_base||0,!!type.requiere_diagnostico,JSON.stringify(type.inventory_requirements||[]),type.duracion_estimada]);
}
module.exports={validateTypeIds,sameSelection,prepareServiceTypes,saveIntakeTypes,replaceOrderServices};
