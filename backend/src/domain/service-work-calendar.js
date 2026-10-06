'use strict';
const OFFSET=5*3600000;
function clock(value){const parts=String(value).split(':').map(Number);return parts[0]*60+parts[1]+(parts[2]||0)/60;}
function windowsFor(date,ids,rows){const day=new Date(date+'T12:00:00-05:00').getUTCDay();let common=[[0,1440]];
 for(const id of ids){const windows=rows.filter(r=>r.tecnico_id===id&&Number(r.dia_semana)===day&&r.activo!==false).map(r=>[clock(r.hora_inicio),clock(r.hora_fin)]).filter(([a,b])=>b>a);common=common.flatMap(([a,b])=>windows.map(([c,d])=>[Math.max(a,c),Math.min(b,d)]).filter(([x,y])=>y>x));}
 const midnight=new Date(date+'T00:00:00-05:00').getTime();return common.map(([a,b])=>[midnight+a*60000,midnight+b*60000]);}
function dateLocal(ms){return new Date(ms-OFFSET).toISOString().slice(0,10);}
function fitsHours(start,end,ids,rows){return dateLocal(start)===dateLocal(end-1)&&windowsFor(dateLocal(start),ids,rows).some(([a,b])=>start>=a&&end<=b);}
function chooseSlot({start,duration,ids,rows,busy=[],days=45}){const initial=new Date(start).getTime();const length=duration*60000;for(let day=0;day<days;day++){const date=dateLocal(initial+day*86400000);for(const[a,b]of windowsFor(date,ids,rows).sort((x,y)=>x[0]-y[0])){let cursor=Math.ceil(Math.max(a,initial)/900000)*900000;while(cursor+length<=b){const conflicts=busy.filter(r=>ids.includes(r.technician_id)&&new Date(r.start_at).getTime()<cursor+length&&new Date(r.end_at).getTime()>cursor);if(!conflicts.length)return{startAt:new Date(cursor).toISOString(),endAt:new Date(cursor+length).toISOString()};cursor=Math.ceil(Math.max(...conflicts.map(r=>new Date(r.end_at).getTime()))/900000)*900000;}}}return null;}
module.exports={clock,windowsFor,fitsHours,chooseSlot,dateLocal};
