'use strict';
const {fitsHours}=require('./service-work-calendar');
function workHourStatus(id,start,end,hours){
 const configured=hours.filter(h=>h.tecnico_id===id&&h.activo!==false);
 if(!configured.length)return{code:'WORK_HOURS_REQUIRED',reason:'No tiene horario laboral configurado. Configúralo en Agenda o en Equipo técnico.'};
 const day=new Date(start-5*3600000).getUTCDay();
 const windows=configured.filter(h=>Number(h.dia_semana)===day).map(h=>({inicio:String(h.hora_inicio).slice(0,5),fin:String(h.hora_fin).slice(0,5)}));
 if(!windows.length)return{code:'NON_WORKING_DAY',reason:'No tiene turno laboral para ese día.',windows};
 if(!fitsHours(start,end,[id],hours))return{code:'OUTSIDE_WORK_HOURS',reason:`El servicio de ${Math.round((end-start)/60000)} min no cabe en los turnos de ese día: ${windows.map(w=>w.inicio+'–'+w.fin).join(', ')} (Colombia).`,windows};
 return {code:null,reason:null,windows};
}
module.exports={workHourStatus};
