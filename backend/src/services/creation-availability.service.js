'use strict';
const{fitsHours}=require('../domain/service-work-calendar');
async function creationAvailability(db,{date,time,typeId,typeIds,technicians=[],excludeOrder=null}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||''))throw Object.assign(new Error('Selecciona fecha y hora de Colombia.'),{status:400});
 if(!Array.isArray(technicians)||!technicians.length||technicians.length>20||technicians.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw Object.assign(new Error('Selecciona un equipo técnico válido.'),{status:400});
 const ids=require('./order-service-types.service').validateTypeIds(typeIds||[typeId]);const types=(await db.query('SELECT id,duracion_estimada FROM tipos_servicio WHERE id=ANY($1::uuid[]) AND activo=true',[ids])).rows;if(types.length!==ids.length)throw Object.assign(new Error('Selecciona tipos de servicio activos.'),{status:400});const type={duracion_estimada:types.reduce((sum,t)=>sum+Number(t.duracion_estimada||60),0)};if(type.duracion_estimada>1440)throw Object.assign(new Error('La duración total supera 1440 minutos.'),{status:400});
 const start=Date.parse(date+'T'+time+':00-05:00'),end=start+Number(type.duracion_estimada||60)*60000;if(!Number.isFinite(start)||new Date(start-5*3600000).toISOString().slice(0,10)!==date)throw Object.assign(new Error('Fecha no válida.'),{status:400});
 const hours=(await db.query('SELECT * FROM tecnicos_horarios WHERE tecnico_id=ANY($1::uuid[]) AND activo=true',[technicians])).rows;
 const busy=(await db.query(`SELECT technician_id,start_at,end_at FROM service_order_schedule_blocks WHERE technician_id=ANY($1::uuid[]) AND status='active' AND start_at<$3::timestamptz AND end_at>$2::timestamptz AND ($4::uuid IS NULL OR service_order_id<>$4::uuid)`,[technicians,new Date(start).toISOString(),new Date(end).toISOString(),excludeOrder])).rows;
 const results=technicians.map(id=>({technician_id:id,available:fitsHours(start,end,[id],hours)&&!busy.some(b=>b.technician_id===id),reason:!fitsHours(start,end,[id],hours)?'El servicio completo no cabe en su horario laboral.':busy.some(b=>b.technician_id===id)?'Ya tiene otro servicio en ese intervalo.':null}));return{available:results.every(t=>t.available),duration:Number(type.duracion_estimada||60),technicians:results};
}
module.exports={creationAvailability};
