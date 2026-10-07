"use strict";
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function normalizeServiceSite(input){
 if(input===undefined||input===null)return null;
 const fail=message=>{throw Object.assign(new Error(message),{status:400,code:'SERVICE_SITE_INVALID'});};
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Lugar de atención no válido');
 const mode=({customer:'external',other:'external',workshop:'local'})[input.mode]||input.mode;
 if(!['remote','local','external'].includes(mode))fail('Selecciona el lugar de atención');
 const address=text(input.address,1000);if(mode==='external'&&!address)fail('Registra la dirección del lugar de atención');
 const coord=(value,min,max)=>{if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
 const latitude=mode==='external'?coord(input.latitude,-90,90):null,longitude=mode==='external'?coord(input.longitude,-180,180):null;
 if(mode==='external'&&((latitude===null)!==(longitude===null)))fail('El punto de atención está incompleto');
 const radius=coord(input.radius_m??150,25,2000);if(radius===null)fail('El radio permitido debe estar entre 25 y 2000 metros');
 if(mode==='external'&&latitude!==null&&input.confirmed!==true)fail('Confirma que el punto corresponde al lugar del servicio');
 return {mode,address,city:text(input.city,180),contact_name:text(input.contact_name,180),contact_phone:text(input.contact_phone,100),
  instructions:text(input.instructions,2000),latitude,longitude,radius_m:radius,confirmed:mode!=='external'||latitude!==null,arrival_method:latitude!==null?'gps':'address'};
}
function custodyRequiresLocation(site,enabled=true){return Boolean(enabled)&&!['remote','local','workshop'].includes(site?.mode);}
module.exports={normalizeServiceSite,custodyRequiresLocation};
