'use strict';
const sql=require('mssql');
const {withInvoiceConnection}=require('./worldoffice-financial-readonly.service');
// Exact sources/types from TecnoNacho Sales sales_sync.py supplied on 2026-10-07.
const SOURCES=Object.freeze({Melissa:'CC',Power_ON:'FV',SAS:'FV'});
const SOURCE_ID='c68061df-d2da-4d95-a701-84e58405d617';
const normalize=value=>String(value??'').trim().toUpperCase().replace(/[ .\-/]/g,'');
const norm=expr=>`UPPER(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(CONVERT(nvarchar(255),${expr}))), ' ', ''), '.', ''), '-', ''), '/', ''))`;
const num="CONVERT(nvarchar(40),CONVERT(decimal(38,0),v.[Numero_Documento]))";
const label=`CONCAT(LTRIM(RTRIM(v.[Tipo_Documento])),' ',LTRIM(RTRIM(COALESCE(v.[prefijo],''))),${num})`;
const key=`CONCAT('sale|',UPPER(LTRIM(RTRIM(v.[Tipo_Documento]))),'|',UPPER(LTRIM(RTRIM(COALESCE(v.[prefijo],'')))),'|',${num})`;
const asMoney=v=>v==null?null:Number(v);
function requestFor(connection,options,company){
 if(!Object.hasOwn(SOURCES,company))throw Object.assign(new Error('Empresa World Office no válida.'),{status:400});
 // Internal Tercero IDs vary between databases. Match the client's document in every source.
 const doc=normalize(options.clientDocument);
 if(!doc)throw Object.assign(new Error('El cliente necesita su identificación para buscar facturas en World Office.'),{status:409});
 const r=connection.request();r.input('clientDocument',sql.NVarChar(255),doc);r.input('saleType',sql.NVarChar(20),SOURCES[company]);
 return r;
}
function fromRow(row,company){
 const unsupported=Number(row.unsupported_taxes)>0;
 return{...row,source:'sales_inventory_movements',source_company:company,company_name:company,
  source_id:String(row.source_id),invoice_reference:String(row.invoice_reference).trim(),
  subtotal_amount:asMoney(row.subtotal_amount),tax_amount:unsupported?null:asMoney(row.tax_amount),
  total_amount:unsupported?null:asMoney(row.total_amount),paid_amount:null,balance_amount:null,pdf_available:false,
  status:'active',amount_notice:unsupported?'World Office registra impuestos que requieren validar su cálculo; se conserva el subtotal.':null};
}
async function documents(connection,options,company,exact=false){
 const r=requestFor(connection,options,company);
 r.input('filter',sql.NVarChar(255),exact?normalize(options.invoiceReference):normalize(String(options.search||'').slice(0,100)).replace(/[\[\]%_]/g,c=>'\\'+c));
 if(exact)r.input('sourceId',sql.NVarChar(255),String(options.sourceId||''));
 // Filter the grouped document, not individual matching lines. Keep all lines and reject documents
 // containing any annulled line or multiple customer identifications.
 const searchPredicate=exact?`${key}=@sourceId AND ${norm(label)}=@filter`:`(@filter='' OR ${norm(label)} LIKE '%'+@filter+'%' ESCAPE '\\')`;
 const result=await r.query(`WITH candidates AS (
 SELECT TOP (${exact?2:30}) v.[Tipo_Documento],v.[prefijo],v.[Numero_Documento],MAX(v.[Fecha]) AS last_date
 FROM [${company}].[dbo].[Vista_Auxiliar_Movimientos_Inventario] v
 WHERE v.[Tipo_Documento]=@saleType AND ${norm('v.[Identificacion_Tercero]')}=@clientDocument AND ${searchPredicate}
 GROUP BY v.[Tipo_Documento],v.[prefijo],v.[Numero_Documento]
 ORDER BY MAX(v.[Fecha]) DESC,v.[Numero_Documento] DESC
 ), documents AS (
 SELECT ${key} AS source_id,${label} AS invoice_reference,v.[Tipo_Documento] AS document_type,
 LTRIM(RTRIM(COALESCE(v.[prefijo],''))) AS prefix,${num} AS document_number,
 MAX(v.[Fecha]) AS invoice_date,MAX(v.[Tercero]) AS client_name,MAX(v.[Identificacion_Tercero]) AS client_document,
 MAX(v.[Empleado_Vendedor]) AS seller_name,MAX(v.[Forma_De_Pago]) AS payment_method,
 MAX(v.[Nota]) AS notes,MAX(v.[Dirección]) AS address,MAX(v.[Ciudad_Encabezado]) AS city,MAX(v.[Moneda]) AS currency,
 COUNT(*) AS source_line_count,
 ROUND(SUM(ABS(COALESCE(v.[Subtotal],0))),2) AS subtotal_amount,
 ROUND(SUM(ABS(COALESCE(v.[Subtotal],0))*COALESCE(v.[Iva],0)),2) AS tax_amount,
 ROUND(SUM(ABS(COALESCE(v.[Subtotal],0))*(1+COALESCE(v.[Iva],0))),2) AS total_amount,
 MAX(CASE WHEN v.[Iva]<0 OR v.[Iva]>1 OR COALESCE(v.[ImpoConsumo],0)<>0 OR COALESCE(v.[ImpoSaludable],0)<>0 THEN 1 ELSE 0 END) AS unsupported_taxes
 FROM [${company}].[dbo].[Vista_Auxiliar_Movimientos_Inventario] v
 INNER JOIN candidates c ON c.[Tipo_Documento]=v.[Tipo_Documento] AND COALESCE(c.[prefijo],'')=COALESCE(v.[prefijo],'') AND c.[Numero_Documento]=v.[Numero_Documento]
 WHERE v.[Tipo_Documento]=@saleType
 GROUP BY v.[Tipo_Documento],v.[prefijo],v.[Numero_Documento]
 HAVING MAX(CASE WHEN COALESCE(v.[Anulado],0)<>0 THEN 1 ELSE 0 END)=0
 AND MAX(CASE WHEN ${norm('v.[Identificacion_Tercero]')}=@clientDocument THEN 0 ELSE 1 END)=0
 ) SELECT TOP (${exact?2:30}) * FROM documents WHERE ${exact?"source_id=@sourceId AND "+norm('invoice_reference')+'=@filter':"(@filter='' OR "+norm('invoice_reference')+" LIKE '%'+@filter+'%' ESCAPE '\\')"}
 ORDER BY invoice_date DESC,source_id DESC`);
 return(result.recordset||[]).map(row=>fromRow(row,company));
}
async function runRead(callback){
 try{return await withInvoiceConnection(callback);}catch(e){
  if(e.status||e.code?.startsWith('WORLDOFFICE'))throw e;
  console.error('World Office: consulta de ventas',e.code,e.message);
  throw Object.assign(new Error('No se pudo consultar World Office. Verifica la conexión y el acceso de lectura a Melissa, Power_ON y SAS.'),{status:503,code:'WORLDOFFICE_INVOICE_QUERY_FAILED'});
 }
}
async function listInvoices(options){
 if(!normalize(options.clientDocument))throw Object.assign(new Error('El cliente necesita su identificación para buscar facturas en World Office.'),{status:409});
 return runRead(async c=>{
  const companies=Object.keys(SOURCES),results=await Promise.allSettled(companies.map(company=>documents(c,options,company)));
  const rows=[],warnings=[];let successful=0;
  results.forEach((r,i)=>{if(r.status==='fulfilled'){successful++;rows.push(...r.value);}else{console.warn('World Office: origen no consultado',companies[i],r.reason?.code);warnings.push('No se pudo consultar '+companies[i]+'. Comprueba el permiso de lectura de esa base.');}});
  if(!successful)throw Object.assign(new Error('No se pudo consultar ninguna empresa de World Office. Verifica conexión y permisos de lectura a Melissa, Power_ON y SAS.'),{status:503,code:'WORLDOFFICE_INVOICE_QUERY_FAILED'});
  rows.sort((a,b)=>new Date(b.invoice_date)-new Date(a.invoice_date)||a.source_company.localeCompare(b.source_company));
  rows.warnings=warnings;return rows;
 });
}
async function queryInvoice(options){
 const company=String(options.sourceCompany||'');
 if(!Object.hasOwn(SOURCES,company)||!options.sourceId||String(options.sourceId).length>255)throw Object.assign(new Error('Selecciona la factura nuevamente para identificar empresa y documento.'),{status:400});
 return runRead(async c=>{
  const rows=await documents(c,options,company,true);
  if(rows.length===1){
   const r=requestFor(c,options,company);r.input('sourceId',sql.NVarChar(255),String(options.sourceId));
   const lines=await r.query(`SELECT v.[Autonumerico] AS source_line_id,v.[CodigoInventario] AS item_code,
   v.[Descripcion] AS item_name,v.[UnidadDeMedida] AS unit,ABS(v.[Conversion_Cantidad]) AS quantity,
   v.[Valor_Unitario] AS unit_value,v.[Descuento_Porcentaje] AS discount_percent,
   ABS(COALESCE(v.[Subtotal],0)) AS subtotal_amount,v.[Iva] AS iva_rate,
   ABS(COALESCE(v.[Subtotal],0))*COALESCE(v.[Iva],0) AS tax_amount,
   v.[ImpoConsumo] AS consumption_tax,v.[ImpoSaludable] AS health_tax
   FROM [${company}].[dbo].[Vista_Auxiliar_Movimientos_Inventario] v
   WHERE v.[Tipo_Documento]=@saleType AND ${key}=@sourceId AND ${norm('v.[Identificacion_Tercero]')}=@clientDocument
   AND COALESCE(v.[Anulado],0)=0 ORDER BY v.[Autonumerico]`);
   // If the source changed between the two reads, require a fresh selection rather than store a partial invoice.
   if(lines.recordset?.length!==Number(rows[0].source_line_count))throw Object.assign(new Error('La factura cambió durante la consulta. Búscala y selecciónala nuevamente.'),{status:409});
   rows[0].lines=lines.recordset||[];
  }
  return{client_match_count:rows.length,rows};
 });
}
module.exports={SOURCE_ID,SOURCES,listInvoices,queryInvoice,invoicePdf:async()=>null,normalize};
