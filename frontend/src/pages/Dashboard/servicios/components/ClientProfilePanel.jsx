import React,{useState} from 'react';
function Field({name,value}){const text=value===null?'Sin dato':typeof value==='object'?JSON.stringify(value,null,2):String(value);return <div className="border-b border-gray-200 dark:border-gray-800 py-2"><p className="text-xs font-semibold text-gray-500 break-all">{name}</p>{text.length>300?<details><summary className="text-sm cursor-pointer">Ver contenido completo ({text.length} caracteres)</summary><pre className="text-xs whitespace-pre-wrap break-all max-h-60 overflow-auto">{text}</pre></details>:<p className="text-sm whitespace-pre-wrap break-words">{text}</p>}</div>;}
export default function ClientProfilePanel({profile,loading=false,error='',onRetry}){
 const[search,setSearch]=useState('');
 if(loading)return <p className="text-sm accent-text">Cargando ficha completa del cliente…</p>;
 if(error)return <div role="alert" className="text-sm text-red-600">{error} {onRetry&&<button type="button" onClick={onRetry} className="underline">Reintentar</button>}</div>;
 if(!profile)return null;
 const fields=Object.entries(profile.worldoffice_raw||{}).filter(([key])=>key.toLowerCase().includes(search.toLowerCase()));
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cliente-'+(profile.worldoffice_id||profile.documento||'ficha')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3">
  <h4 className="text-sm font-semibold">Datos disponibles del cliente</h4>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">{['documento','telefono','telefono_2','email','email_2','direccion','direccion_2','ciudad','departamento','pais','codigo_postal','contacto'].map(key=><Field key={key} name={key.replaceAll('_',' ')} value={profile[key]??null}/>)}</div>
  {profile.worldoffice_raw&&<details><summary className="cursor-pointer text-sm font-semibold accent-text">Todos los campos de World Office ({Object.keys(profile.worldoffice_raw).length})</summary>
   <p className="my-2 text-xs text-gray-500">Última sincronización: {profile.worldoffice_synced_at?new Date(profile.worldoffice_synced_at).toLocaleString('es-CO'):'sin fecha registrada'}</p>
   <input aria-label="Buscar campo de World Office" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar campo por nombre" className="w-full rounded-lg border p-2 bg-transparent text-sm"/>
   <div className="max-h-80 overflow-auto mt-2">{fields.map(([name,value])=><Field key={name} name={name} value={value}/>)}</div>
   {Object.entries(profile.worldoffice_relations||{}).map(([table,rows])=><details key={table} className="my-2"><summary className="cursor-pointer text-sm font-semibold">{table} · {rows.length} registro(s)</summary>{rows.map((row,i)=><div key={i} className="mt-2 rounded-lg border p-2">{Object.entries(row).map(([name,value])=><Field key={name} name={name} value={value}/>)}</div>)}</details>)}
  </details>}
  {!profile.worldoffice_raw&&<p className="text-xs text-gray-500">Cliente local sin ficha vinculada de World Office.</p>}
  <details><summary className="cursor-pointer text-sm">Todos los datos locales y normalizados</summary><div className="max-h-80 overflow-auto">{Object.entries(profile).filter(([name])=>!name.startsWith('worldoffice_')).map(([name,value])=><Field key={name} name={name} value={value}/>)}</div></details>
  {profile.signature_history?.length>0&&<details><summary className="font-semibold cursor-pointer">Actas y firmas vinculadas ({profile.signature_history.length})</summary>{profile.signature_history.map(s=><p key={s.id} className="text-sm border-b py-2">{s.codigo_os} · {s.signer_name} · {s.signer_document} · {s.signer_kind==='third_party'?'Tercero autorizado':'Cliente o representante'} · {new Date(s.captured_at).toLocaleString('es-CO')}</p>)}</details>}
  <button type="button" onClick={download} className="text-xs font-semibold accent-text underline">Descargar ficha completa (JSON)</button>
 </section>;
}
