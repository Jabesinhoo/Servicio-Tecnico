export const serviceMode = site => ({customer:'external',other:'external',workshop:'local'})[site?.mode] || site?.mode;
export const emptyServiceSite = () => ({mode:'external',address:'',city:'',contact_name:'',contact_phone:'',instructions:'',latitude:'',longitude:'',radius_m:150,confirmed:false});
export function serviceSiteError(site){
 if(!site)return null;
 const mode=serviceMode(site);
 if(!['remote','local','external'].includes(mode))return 'Selecciona la modalidad de atención.';
 if(mode!=='external')return null;
 if(!site.address?.trim())return 'Registra la dirección del lugar de atención.';
 const valid=(v,min,max)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
 if(!valid(site.latitude,-90,90)||!valid(site.longitude,-180,180))return 'Registra las coordenadas del lugar de atención.';
 if(!valid(site.radius_m,25,2000))return 'El radio permitido debe estar entre 25 y 2000 metros.';
 if(site.confirmed!==true)return 'Confirma que el punto corresponde al lugar del servicio.';
 return null;
}
export function parseServicePoint(value){
 const text=String(value||'').trim();let pair=text;
 if(/^https?:/i.test(text)){
  let url;try{url=new URL(text);}catch{return null;}
  const place=[...url.href.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)].at(-1);
  if(place)pair=place[1]+','+place[2];
  else if(url.searchParams.has('mlat')&&url.searchParams.has('mlon'))pair=url.searchParams.get('mlat')+','+url.searchParams.get('mlon');
  else pair=url.searchParams.get('q')||url.searchParams.get('query')||'';
 }
 const match=pair.match(/^(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/i);
 if(!match)return null;const latitude=Number(match[1]),longitude=Number(match[2]);
 if(latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)return null;
 return {latitude,longitude};
}
