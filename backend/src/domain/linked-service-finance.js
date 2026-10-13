'use strict';
const normalize=v=>String(v??'').toUpperCase().replace(/[\s.\-/]/g,'');
const date=v=>{if(!v)return null;const text=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return Number.isNaN(Date.parse(text))?null:text;const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(d.getTime()-5*3600000).toISOString().slice(0,10);};
const amount=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Math.round(Number(v)*100)/100;
function documents(rows){
 const label=v=>normalize(v).replace(/^(FV|CC|DMC)/,'');
 const worldofficeReferences=new Set(rows.filter(r=>r.source==='worldoffice'&&r.invoice_reference).map(r=>r.service_order_id+':'+label(r.invoice_reference)));
 const groups=new Map();
 for(const row of rows){
  // Suppress a local copy of the same invoice; preserve distinct additional invoices and credits.
  if(row.source==='local'&&row.record.tipo_documento!=='nota_credito'&&row.record.numero_factura&&worldofficeReferences.has(row.service_order_id+':'+label(row.record.numero_factura)))continue;
  const record=row.record||{};
  const key=row.source==='worldoffice'?(record.source_company&&record.source_id?`wo:${record.source_company}:${record.source_id}`:null):`local:${record.id}`;
  if(!key)continue;
  const old=groups.get(key);const links=old?old.services:[];
  if(!links.some(s=>s.id===row.service_order_id))links.push({id:row.service_order_id,code:row.codigo_os,client:row.client_name,client_id:row.client_id,technician_id:row.tecnico_id});
  if(old&&new Date(old.linked_at||0)>new Date(row.linked_at||0))continue;
  const cancelled=row.source==='worldoffice'?['cancelled','annulled','anulada'].includes(record.status):!['emitida','pagada'].includes(record.estado);
  let total=amount(row.source==='worldoffice'?record.total_amount:record.total_general);
  if(row.source==='local'&&record.tipo_documento==='nota_credito'&&total!==null)total=-Math.abs(total);
  const currency=record.currency||'COP';const cop=/^(COP|PESOS?|PESO COLOMBIANO|PESOS COLOMBIANOS|\$)$/i.test(String(currency).trim());
  groups.set(key,{id:key,source:row.source,local_id:row.source==='local'?record.id:null,
   reference:row.source==='worldoffice'?row.invoice_reference:record.numero_factura,
   company:record.source_company||'Sistema',date:row.source==='worldoffice'?date(String(record.invoice_date||'').slice(0,10)):date(record.fecha_emision),
   total,currency,excluded:cancelled||total===null||!cop,
   excluded_reason:cancelled?'Documento no emitido o anulado':total===null?'Importe sin verificar':!cop?'Moneda sin conversión confirmada':null,
   status:row.source==='worldoffice'?(cancelled?'anulada':'emitida'):record.estado,
   linked_at:row.linked_at,record,services:links});
 }
 return [...groups.values()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.id.localeCompare(b.id));
}
function sum(rows){return Math.round(rows.reduce((n,r)=>n+r.total,0)*100)/100;}
function summarize(invoices,range){
 const current=invoices.filter(r=>r.date&&r.date>=range.from&&r.date<=range.to);
 const valid=current.filter(r=>!r.excluded);
 const size=Math.round((Date.parse(range.to)-Date.parse(range.from))/86400000)+1;
 const previousTo=new Date(Date.parse(range.from)-86400000).toISOString().slice(0,10);
 const previousFrom=new Date(Date.parse(range.from)-size*86400000).toISOString().slice(0,10);
 const previous=sum(invoices.filter(r=>!r.excluded&&r.date&&r.date>=previousFrom&&r.date<=previousTo));
 const total=sum(valid),trend=[],clients=new Map(),byService=new Map(),byTechnician=new Map();
 for(let day=Date.parse(range.from);day<=Date.parse(range.to);day+=86400000)trend.push({date:new Date(day).toISOString().slice(0,10),invoiced:0});
 const days=new Map(trend.map(d=>[d.date,d]));
 for(const invoice of valid){
  days.get(invoice.date).invoiced+=invoice.total;
  // Attribute the final document once, to its earliest linked order, never to every technician.
  const owner=[...invoice.services].sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id))[0];
  if(!owner)continue;
  byService.set(owner.id,(byService.get(owner.id)||0)+invoice.total);
  byTechnician.set(owner.technician_id,(byTechnician.get(owner.technician_id)||0)+invoice.total);
  const client=clients.get(owner.client_id)||{client:owner.client,orders:0,invoiced:0,services:new Set()};
  client.services.add(owner.id);client.invoiced+=invoice.total;clients.set(owner.client_id,client);
 }
 return {financial:{invoiced:total,invoice_count:valid.length,excluded_count:current.filter(r=>r.excluded).length,
  undated_count:invoices.filter(r=>!r.date).length,previous_invoiced:previous,change:Math.round((total-previous)*100)/100,
  change_percent:previous===0?null:Math.round((total-previous)/Math.abs(previous)*10000)/100,
  previous_range:{from:previousFrom,to:previousTo},trend},
  invoices:current,clients:[...clients.values()].map(({services,...c})=>({...c,orders:services.size})).sort((a,b)=>b.invoiced-a.invoiced),byService,byTechnician};
}
module.exports={documents,summarize,date};
