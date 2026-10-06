import React, { useEffect, useState } from 'react';
import api from '../../../../services/api';
export const ACCEPTANCE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx';
export async function uploadAcceptanceFiles(intakeId, files, onUploaded) {
 for (const item of files) {
  await api.post(`/api/service-orders/intakes/${intakeId}/acceptance-evidences`, item.file, {
   headers: {'Content-Type':'application/octet-stream'},
   params: { name:item.file.name, upload_key:item.key },
  });
  onUploaded(item.key);
 }
}
export default function AcceptanceEvidenceFiles({intakeId, pending=[], onChange, disabled=false}) {
 const [saved,setSaved]=useState([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 useEffect(()=>{
  let live=true;setSaved([]);setError('');
  if(!intakeId)return;
  setLoading(true);
  api.get(`/api/service-orders/intakes/${intakeId}/acceptance-evidences`).then(r=>{if(live)setSaved(r.data.data||[]);})
   .catch(e=>{if(live)setError(e.response?.data?.message||'No se pudieron cargar los adjuntos');})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[intakeId,pending.length]);
 const choose=e=>{
  const files=Array.from(e.target.files||[]);e.target.value='';setError('');
  if(saved.length+pending.length+files.length>5){setError('Puedes adjuntar máximo 5 archivos.');return;}
  if(files.some(f=>!f.size||f.size>25*1024*1024)){setError('Cada archivo debe tener contenido y pesar máximo 25 MB.');return;}
  if(files.some(f=>!ACCEPTANCE_EXTENSIONS.split(',').includes('.'+f.name.split('.').pop().toLowerCase()))){setError('Formato no permitido.');return;}
  onChange([...pending,...files.map(file=>({file,key:crypto.randomUUID()}))]);
 };
 const download=async file=>{try{
  const r=await api.get(`/api/service-orders/intakes/${intakeId}/acceptance-evidences/${file.id}/download`,{responseType:'blob'});
  const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download=file.original_name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError('No se pudo descargar el adjunto.');}};
 return <div className="mt-3 space-y-2">
  {onChange && <><label className="block text-sm font-semibold">Adjuntar evidencia (opcional)
   <input aria-label="Adjuntar evidencia" type="file" multiple accept={ACCEPTANCE_EXTENSIONS} onChange={choose} disabled={disabled||loading} className="mt-2 block w-full text-sm" />
  </label><p className="text-xs text-gray-500">Fotos, videos, PDF, Word o Excel. Máximo 5 archivos de 25 MB cada uno. Se guardan al crear la solicitud o guardar sus cambios.</p></>}
  {loading&&<p className="text-sm">Cargando adjuntos…</p>}
  {saved.map(file=><div key={file.id} className="flex gap-2 items-center text-sm"><button type="button" onClick={()=>download(file)} className="accent-text underline break-all">{file.original_name}</button><span className="text-gray-500">{(file.byte_size/1024/1024).toFixed(2)} MB</span></div>)}
  {pending.map(item=><div key={item.key} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"><span className="break-all">{item.file.name} · {(item.file.size/1024/1024).toFixed(2)} MB · pendiente</span><button type="button" disabled={disabled} onClick={()=>onChange(pending.filter(p=>p.key!==item.key))} className="text-red-600">Quitar</button></div>)}
  {!onChange&&!loading&&!saved.length&&!error&&<p className="text-sm text-gray-500">Sin archivos adjuntos.</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 </div>;
}
