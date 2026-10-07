'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const invoice={source_id:'sale|FV|FE|81315',invoice_reference:'FV FE81315',document_type:'FV',prefix:'FE',document_number:'81315',invoice_date:new Date('2026-09-01T15:00:00Z'),client_document:'802021209',client_name:'TRANSMETRO S.A.S',source_line_count:1,subtotal_amount:100,tax_amount:19,total_amount:119,unsupported_taxes:0};
const line={source_line_id:21,item_code:'11363',item_name:'SERVICIO TECNICO',quantity:1,subtotal_amount:100,tax_amount:19};
function fixture({documents=[invoice],lines=[line],fail=[]}={}){
 const calls=[];const connection={request(){const params={};return{input(n,t,v){params[n]=v;return this;},async query(query){const company=['Melissa','Power_ON','SAS'].find(x=>query.includes(`[${x}].[dbo]`));calls.push({query,params,company});if(fail.includes(company))throw new Error('unavailable');return{recordset:query.startsWith('WITH candidates')?(typeof documents==='function'?documents(company):documents):lines};}};}};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/services/worldoffice-invoices.service.js'),'utf8'),{module,exports:module.exports,require:n=>n==='mssql'?{NVarChar:()=> 'text'}:{withInvoiceConnection:cb=>cb(connection)},console:{error(){},warn(){}}});
 return{service:module.exports,calls};
}
const selection={clientDocument:'802021209',sourceCompany:'SAS',sourceId:invoice.source_id,invoiceReference:invoice.invoice_reference};
test('ventas: usa CC en Melissa y FV en Power_ON/SAS, por identificación y no por ID interno',async()=>{
 const f=fixture(),r=await f.service.listInvoices({clientDocument:'802.021.209',clientExternalId:'999',search:'FE 81315'});assert.equal(r.length,3);assert.equal(f.calls.find(c=>c.company==='Melissa').params.saleType,'CC');assert.equal(f.calls.find(c=>c.company==='SAS').params.saleType,'FV');for(const c of f.calls){assert.equal(c.params.clientDocument,'802021209');assert(!c.query.includes('IdTerceroExterno'));assert(c.query.includes('INNER JOIN candidates'));assert(c.query.includes('MAX(CASE WHEN COALESCE(v.[Anulado],0)'));}assert.equal(r[0].balance_amount,null);
});
test('ventas: búsqueda parametrizada y comodines escapados',async()=>{
 const f=fixture();await f.service.listInvoices({clientDocument:'123',search:"FE' OR 1=1 --%_"});for(const c of f.calls){assert(!c.query.includes("FE' OR 1=1"));assert(c.params.filter.endsWith('\\%\\_'));assert(c.query.includes('@filter'));}
});
test('ventas: no consulta todos los clientes si falta identificación',async()=>{
 const f=fixture();await assert.rejects(f.service.listInvoices({clientExternalId:'42'}),/identificación/);assert.equal(f.calls.length,0);
});
test('ventas: selecciona empresa más source_id y conserva todas las líneas, incluidos servicios técnicos',async()=>{
 const f=fixture(),r=await f.service.queryInvoice(selection);assert.equal(r.client_match_count,1);assert.equal(r.rows[0].source_company,'SAS');assert.equal(r.rows[0].source_id,invoice.source_id);assert.equal(r.rows[0].total_amount,119);assert.equal(r.rows[0].subtotal_amount,100);assert.equal(r.rows[0].lines[0].item_code,'11363');assert.equal(r.rows[0].paid_amount,null);assert.equal(f.calls.length,2);for(const c of f.calls){assert.equal(c.company,'SAS');assert.equal(c.params.sourceId,invoice.source_id);}assert(f.calls[0].query.includes('source_id=@sourceId'));assert.equal(await f.service.invoicePdf(),null);
});
test('ventas: rechaza empresa arbitraria y selección antigua sin clave del documento',async()=>{
 const f=fixture();await assert.rejects(f.service.queryInvoice({...selection,sourceCompany:'SAS]; DROP TABLE X--'}),/Selecciona/);await assert.rejects(f.service.queryInvoice({...selection,sourceId:null}),/Selecciona/);assert.equal(f.calls.length,0);
});
test('ventas: documento inexistente o ambiguo no genera detalle ni saldo cero',async()=>{
 for(const rows of [[],[invoice,invoice]]){const f=fixture({documents:rows}),r=await f.service.queryInvoice(selection);assert.equal(r.client_match_count,rows.length);assert.equal(f.calls.length,1);}
});
test('ventas: una empresa inaccesible avisa y conserva resultados; ninguna accesible produce error',async()=>{
 const f=fixture({fail:['Power_ON']}),r=await f.service.listInvoices({clientDocument:'123'});assert.equal(r.length,2);assert.equal(r.warnings.length,1);assert(r.warnings[0].includes('Power_ON'));await assert.rejects(fixture({fail:['Melissa','Power_ON','SAS']}).service.listInvoices({clientDocument:'123'}),e=>e.status===503);
});
test('ventas: impuestos sin semántica validada no inventan total; cambios de cantidad de líneas exigen reconsulta',async()=>{
 const f=fixture({documents:[{...invoice,unsupported_taxes:1}]}),r=await f.service.queryInvoice(selection);assert.equal(r.rows[0].total_amount,null);assert.equal(r.rows[0].tax_amount,null);assert.equal(r.rows[0].subtotal_amount,100);assert(r.rows[0].amount_notice);await assert.rejects(fixture({lines:[]}).service.queryInvoice(selection),/cambió/);
});
