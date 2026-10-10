import React,{useState} from 'react';
import api from '../../../../services/api';
import {emptyServiceSite,serviceMode} from '../serviceLocation';
export default function ServiceSiteFields({value,onChange,disabled=false}){
 const site=value||emptyServiceSite();const external=serviceMode(site)==='external';
 const[results,setResults]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const change=(key,val)=>onChange({...site,[key]:val,...(['address','city'].includes(key)?{latitude:'',longitude:'',confirmed:false}:{} )});
 const search=async()=>{setBusy(true);setError('');setResults([]);try{const r=await api.get('/api/service-orders/location-search',{params:{q:[site.address,site.city,'Colombia'].filter(Boolean).join(', ')}});setResults(r.data.data||[]);if(!r.data.data?.length)setError('No encontramos un punto exacto. Puedes corregir la dirección o continuar con la dirección escrita.');}catch(e){setError(e.response?.data?.message||'El mapa no está disponible. Puedes continuar con la dirección escrita.');}finally{setBusy(false);}};
 const point=String(site.latitude??'')!==''&&String(site.longitude??'')!=='';
 const input='mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3';
 return <section className="space-y-3 rounded-xl border accent-border dark:accent-border p-4">
  <h4 className="font-semibold">Lugar de atención</h4>
  <label className="block text-sm font-semibold">Atención en<select disabled={disabled} value={serviceMode(site)} onChange={e=>{setResults([]);setError('');onChange({...emptyServiceSite(),mode:e.target.value,address:site.address,city:site.city,contact_name:site.contact_name,contact_phone:site.contact_phone});}} className={input}><option value="remote">Remoto</option><option value="local">En el local / taller</option><option value="external">Visita externa</option></select></label>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
   <label className="text-sm font-semibold">Dirección de atención {external?'*':'(opcional)'}<input disabled={disabled} value={site.address} onChange={e=>change('address',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Ciudad / municipio<input disabled={disabled} value={site.city} onChange={e=>change('city',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Persona de contacto<input disabled={disabled} value={site.contact_name} onChange={e=>change('contact_name',e.target.value)} className={input}/></label>
   <label className="text-sm font-semibold">Teléfono de contacto<input disabled={disabled} value={site.contact_phone} onChange={e=>change('contact_phone',e.target.value)} className={input}/></label>
  </div>
  {external&&<>
   <button type="button" disabled={disabled||busy||!site.address.trim()} onClick={search} className="rounded-xl border accent-border accent-text px-3 py-2 text-sm font-semibold">{busy?'Buscando dirección…':'Buscar dirección en OpenStreetMap'}</button>
   <p className="text-xs text-gray-500"></p>
   {error&&<p role="status" className="text-sm">{error}</p>}
   {results.map((r,i)=><div key={i} className="rounded-xl border p-3 space-y-2"><p className="text-sm">{r.label}</p><button type="button" disabled={disabled} onClick={()=>{onChange({...site,latitude:r.latitude,longitude:r.longitude,radius_m:150,confirmed:true});setResults([]);}} className="text-sm accent-text underline">Usar esta ubicación</button></div>)}
   {point&&<><iframe title="Ubicación del servicio en OpenStreetMap" className="w-full h-64 rounded-xl border" referrerPolicy="no-referrer" src={'https://www.openstreetmap.org/export/embed.html?bbox='+[Number(site.longitude)-.005,Number(site.latitude)-.005,Number(site.longitude)+.005,Number(site.latitude)+.005].join(',')+'&layer=mapnik&marker='+site.latitude+','+site.longitude}/><p className="text-xs">© colaboradores de <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p><label className="flex gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={site.confirmed===true} onChange={e=>onChange({...site,confirmed:e.target.checked})}/>El punto corresponde al lugar de atención.</label><button type="button" disabled={disabled} className="text-sm underline" onClick={()=>onChange({...site,latitude:'',longitude:'',confirmed:false})}>Continuar solo con dirección</button></>}
  </>}
  <label className="block text-sm font-semibold">Indicaciones de atención (opcional)<textarea disabled={disabled} rows={2} value={site.instructions} onChange={e=>change('instructions',e.target.value)} className={input} placeholder="Sede, piso, acceso…"/></label>
 </section>;
}
