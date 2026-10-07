import React,{useEffect,useState} from 'react';
import api from '../../../../services/api';
import InvoiceRecord from './InvoiceRecord';
import AttachmentPreview from './AttachmentPreview';
export default function CreationOrderDocuments({serviceId}){
 const[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();api.get(`/api/service-orders/${serviceId}/creation-documents`,{signal:c.signal}).then(r=>setData(r.data)).catch(e=>{if(e.code!=='ERR_CANCELED')setError('No se pudieron consultar los documentos de creación.');});return()=>c.abort();},[serviceId]);
 if(error)return <p className="text-sm">{error}</p>;
 if(!data||(!data.files?.length&&!data.acceptances?.length&&!data.invoice))return null;
 return <section className="rounded-xl border p-4 space-y-2"><h4 className="font-semibold">Documentos y factura de creación</h4>{data.invoice&&<div className="border rounded-xl p-3 space-y-2"><h5 className="font-semibold">Factura World Office · {data.invoice.invoice_reference}</h5><InvoiceRecord record={data.invoice.record} reference={data.invoice.invoice_reference}/></div>}{data.acceptances?.map(a=><div key={a.id} className="space-y-2 border-b py-2"><p className="text-sm">Acta de aceptación · {a.signer_name} · {new Date(a.captured_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</p><AttachmentPreview path={`/api/service-orders/intakes/${data.intake_id}/acceptance-acts/${a.id}`} name="Acta-aceptacion.pdf" mime="application/pdf"/></div>)}{data.files?.map(f=><div key={f.id} className="space-y-2 border-b py-2"><p className="text-sm">{f.kind==='invoice_support'?'Factura original':'Foto de ingreso'}</p><AttachmentPreview path={`/api/service-orders/intakes/${data.intake_id}/creation-documents/${f.id}`} name={f.name} mime={f.mime}/></div>)}</section>;
}
