import React,{useState} from 'react';
import {emptyServiceSite,parseServicePoint,serviceMode} from '../serviceLocation';
export default function ServiceSiteFields({value,onChange,disabled=false}){
 const site=value||emptyServiceSite();const external=serviceMode(site)==='external';const[link,setLink]=useState('');const[error,setError]=useState('');const[preview,setPreview]=useState(false);
 const change=(key,val)=>{setPreview(false);onChange({...site,[key]:val,confirmed:false});};
 const applyPoint=()=>{const point=parseServicePoint(link);if(!point){setError('Pega las coordenadas “latitud, longitud” o un enlace completo con el punto. Los enlaces cortos de Maps deben abrirse para copiar sus coordenadas.');return;}setError('');setPreview(false);onChange({...site,...point,confirmed:false});};
 const lat=Number(site.latitude),lon=Number(site.longitude);const pointValid=String(site.latitude).trim()!==''&&String(site.longitude).trim()!==''&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
 const input='mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3';
 return <section className="space-y-3 rounded-xl border accent-border dark:accent-border p-4">
  <h4 className="font-semibold">Lugar de atención y punto de llegada</h4>
  <p className="text-sm text-gray-500">Confirma dónde se atenderá el servicio. La dirección del cliente puede ser distinta del taller o de la sede de visita.</p>
  <label className="block text-sm font-semibold">Atención en<select disabled={disabled} value={serviceMode(site)} onChange={e=>onChange({...emptyServiceSite(),mode:e.target.value,contact_name:site.contact_name,contact_phone:site.contact_phone})} className={input}><option value="remote">Remoto</option><option value="local">En el local / taller</option><option value="external">Visita externa</option></select></label>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
   <label className="text-sm font-semibold">Dirección de atención {external?'*':'(opcional)'}<input disabled={disabled} value={site.address} onChange={e=>change('address',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Ciudad / municipio<input disabled={disabled} value={site.city} onChange={e=>change('city',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Contacto en el lugar<input disabled={disabled} value={site.contact_name} onChange={e=>change('contact_name',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Teléfono de contacto<input disabled={disabled} value={site.contact_phone} onChange={e=>change('contact_phone',e.target.value)} className={input}/></label>
  </div>
  {external&&<>
  {!!site.address&&<a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([site.address,site.city].filter(Boolean).join(', '))} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold accent-text underline">Buscar esta dirección en Maps</a>}
  <p className="text-xs text-gray-500">Si World Office no tiene coordenadas, busca el punto en Maps y copia su latitud y longitud (clic derecho en el mapa). Pégalas aquí o escríbelas abajo.</p>
  <div className="flex flex-col sm:flex-row gap-2"><input disabled={disabled} aria-label="Coordenadas o enlace del punto" value={link} onChange={e=>setLink(e.target.value)} placeholder="10.96854, -74.78132 / enlace completo" className={input}/><button type="button" disabled={disabled} onClick={applyPoint} className="rounded-xl border px-3 py-2 text-sm font-semibold shrink-0">Usar punto</button></div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
   <label className="text-sm font-semibold">Latitud *<input disabled={disabled} type="number" step="any" value={site.latitude} onChange={e=>change('latitude',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Longitud *<input disabled={disabled} type="number" step="any" value={site.longitude} onChange={e=>change('longitude',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Radio permitido (m)<input disabled={disabled} type="number" min="25" max="2000" value={site.radius_m} onChange={e=>change('radius_m',e.target.value)} className={input}/></label>
  </div>
  {pointValid&&<><button type="button" onClick={()=>setPreview(!preview)} className="text-sm accent-text underline">{preview?'Ocultar mapa':'Ver punto en mapa'}</button>{preview&&<iframe title="Punto del servicio" className="w-full h-64 rounded-xl border" referrerPolicy="strict-origin-when-cross-origin" src={'https://www.openstreetmap.org/export/embed.html?bbox='+[Math.max(-180,lon-.005),Math.max(-90,lat-.005),Math.min(180,lon+.005),Math.min(90,lat+.005)].join(',')+'&layer=mapnik&marker='+lat+','+lon}/>}</>}
  </>}
  <label className="block text-sm font-semibold">Indicaciones de atención<textarea disabled={disabled} rows={2} value={site.instructions} onChange={e=>change('instructions',e.target.value)} className={input} placeholder="Sede, piso, persona que recibe, acceso…"/></label>
  {external&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={disabled||!pointValid} checked={site.confirmed===true} onChange={e=>onChange({...site,confirmed:e.target.checked})} className="mt-1"/><span>Confirmo que estas coordenadas corresponden al lugar donde se realizará el servicio.</span></label>}
 </section>;
}
