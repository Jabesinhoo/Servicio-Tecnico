import React,{useEffect,useState} from 'react';
import api from '../../../../services/api';
import{openIntakeDocument}from '../intakeCreationFiles';
export default function CreationOrderDocuments({serviceId}){
 const[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();api.get(`/api/service-orders/${serviceId}/creation-documents`,{signal:c.signal}).then(r=>setData(r.data)).catch(e=>{if(e.code!=='ERR_CANCELED')setError('No se pudieron consultar los documentos de creación.');});return()=>c.abort();},[serviceId]);
 if(error)return <p className="text-sm">{error}</p>;
 if(!data||(!data.files?.length&&!data.acceptances?.length))return null;
 const open=async(path,name)=>{try{await openIntakeDocument(path,name);}catch{setError('No fue posible descargar el documento.');}};
 return <section className="rounded-xl border p-4 space-y-2"><h4 className="font-semibold">Documentos de creación</h4>{data.acceptances?.map(a=><button key={a.id} type="button" className="block text-sm accent-text underline" onClick={()=>open(`/api/service-orders/intakes/${data.intake_id}/acceptance-acts/${a.id}`,'Acta-aceptacion.pdf')}>Acta de aceptación · {a.signer_name} · {new Date(a.captured_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</button>)}{data.files?.map(f=><button key={f.id} type="button" className="block text-sm underline" onClick={()=>open(`/api/service-orders/intakes/${data.intake_id}/creation-documents/${f.id}`,f.name)}>{f.kind==='invoice_support'?'Factura original':'Foto de ingreso'} · {f.name}</button>)}</section>;
}
