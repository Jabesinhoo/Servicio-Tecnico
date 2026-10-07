'use strict';
const cache=new Map();let active=false,last=0;
async function searchAddress(q){
 q=String(q||'').trim();if(q.length<5||q.length>300)throw Object.assign(new Error('Escribe una dirección y ciudad válidas.'),{status:400});
 const found=cache.get(q);if(found&&found.expiry>Date.now())return found.rows;
 if(active||Date.now()-last<1100)throw Object.assign(new Error('Espera un momento antes de buscar otra dirección.'),{status:429});
 active=true;last=Date.now();try{
  const url=new URL(process.env.SERVICE_GEOCODER_URL||'https://photon.komoot.io/api/');url.searchParams.set('q',q);url.searchParams.set('limit','5');
  const r=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'TecnoNachoServicioTecnico/1.0 (https://tecnicos.tecnonacho.com)','Accept':'application/json'}});
  if(!r.ok)throw new Error('Geocoder unavailable');const json=await r.json();
  const rows=(json.features||[]).filter(f=>Array.isArray(f.geometry?.coordinates)&&(!f.properties?.countrycode||f.properties.countrycode.toUpperCase()==='CO')).map(f=>({latitude:Number(f.geometry.coordinates[1]),longitude:Number(f.geometry.coordinates[0]),label:[f.properties?.name,f.properties?.street,f.properties?.housenumber,f.properties?.city,f.properties?.state].filter(Boolean).join(', ')})).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180);
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(q,{rows,expiry:Date.now()+86400000});return rows;
 }catch(e){if(e.status)throw e;throw Object.assign(new Error('No fue posible consultar el mapa. Puedes continuar con la dirección escrita.'),{status:503});}finally{active=false;}
}
module.exports={searchAddress};
