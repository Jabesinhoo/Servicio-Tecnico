'use strict';
const XLSX=require('xlsx');
const {formatExcel,typedRows}=require('./excel-format.service');
const xml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function exportOperations(d){const wb=XLSX.utils.book_new();const add=(name,rows)=>{const ws=XLSX.utils.json_to_sheet(typedRows(rows),{cellDates:true});ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.min(45,Math.max(16,k.length+3))}));XLSX.utils.book_append_sheet(wb,ws,name);};
add('Resumen',Object.entries({Desde:d.range.from,Hasta:d.range.to,Zona:d.timezone,Generado:d.generated_at,Ámbito:d.scope,Órdenes:d.totals.orders,Activas:d.totals.active,Trabajos_finalizados:d.totals.technical_finished,Entregadas:d.totals.delivered,Reprocesos:d.totals.reworks,...(d.financial?{Facturado:d.financial.invoiced,Facturas_contabilizadas:d.financial.invoice_count,Documentos_excluidos:d.financial.excluded_count,Variación:d.financial.change}:{})}).map(([Indicador,Valor])=>({Indicador,Valor})));
add('Servicios',d.services.map(r=>({Orden:r.codigo_os,Cliente:r.client_name,Técnico:r.technician,Estado:r.estado,Cierre:r.closure_status,Creación:r.created_at,Finalizado:r.technical_closed_at,Estimado_min:r.estimated_minutes||r.duracion_estimada,Real_min:r.actual_minutes==null?null:Number(r.actual_minutes),...(d.financial?{Facturado:r.invoiced,Control:r.clearance_status}:{})})));
if(d.financial){add('Ingresos diarios',d.financial.trend.map(r=>({Fecha:r.date,Facturado:r.invoiced})));add('Facturas vinculadas',(d.invoices||[]).map(r=>({Factura:r.reference,Empresa:r.company,Servicios:r.services.map(s=>s.code).join(', '),Fecha:r.date,Total:r.total,Moneda:r.currency,Exclusión:r.excluded_reason||''})));}
add('Clientes',d.clients.map(r=>({Cliente:r.client,Servicios:r.orders,Facturado:r.invoiced})));
if(d.financial){
 const count=(d.invoices||[]).length;
 if(count){
  const last=count+1;
  const invoiceTotals="'Facturas vinculadas'!$E$2:$E$"+last;
  const invoiceDates="'Facturas vinculadas'!$D$2:$D$"+last;
  const exclusions="'Facturas vinculadas'!$G$2:$G$"+last;
  const summary=wb.Sheets.Resumen;
  const bounds=XLSX.utils.decode_range(summary['!ref']);
  for(let row=1;row<=bounds.e.r;row++){
   const label=summary['A'+(row+1)]?.v;const cell=summary['B'+(row+1)];
   if(label==='Facturado')cell.f=`SUMIFS(${invoiceTotals},${exclusions},"")`;
   if(label==='Facturas_contabilizadas')cell.f=`COUNTIFS(${exclusions},"")`;
  }
  d.financial.trend.forEach((r,index)=>{const cell=wb.Sheets['Ingresos diarios']['B'+(index+2)];cell.f=`SUMIFS(${invoiceTotals},${invoiceDates},A${index+2},${exclusions},"")`;});
 }
}

add('Rendimiento',d.technicians.map(r=>({Técnico:r.technician,Servicios:r.orders,Finalizados:r.finished,Reprocesos:r.reworks,Con_tiempo_real:r.timed,Dentro_estimado:r.on_time,Minutos_reales:r.actual,Minutos_estimados:r.estimated,...(d.financial?{Facturado_atribuido:r.invoiced}:{})})));
add('Inventario',d.inventory.map(r=>({Código:r.codigo,Ítem:r.nombre,Disponible:r.stock_actual,Mínimo:r.stock_minimo,En_uso:r.in_use,Costo:r.costo,Tipo:r.kind})));
add('Custodia taller',d.holdings.map(r=>({Ítem:r.nombre,Servicio:r.codigo_os,Técnico:r.holder,Cantidad:r.quantity,Fecha:r.created_at})));
const graphs=[{title:'Servicios por mes',rows:d.months.map(r=>[r.month,r.orders])},{title:'Trabajos finalizados por técnico',rows:d.technicians.map(r=>[r.technician,r.finished])},...(d.financial?[{title:'Evolución de ingresos facturados',type:'line',rows:d.financial.trend.map(r=>[r.date,r.invoiced])},{title:'Clientes por valor facturado',rows:d.clients.slice(0,10).map(r=>[r.client,r.invoiced])}]:[]),{title:'Inventario disponible',rows:d.inventory.slice(0,15).map(r=>[r.nombre,Number(r.stock_actual)])}].filter(g=>g.rows.length);
add('Gráficas',[{Información:'TecnoNacho: gráficas editables. Los ingresos se calculan desde las facturas vinculadas.'}]);
wb.SheetNames=wb.SheetNames.filter(n=>n!=='Gráficas');wb.SheetNames.splice(1,0,'Gráficas');
wb.Sheets['Gráficas']['!cols']=Array.from({length:14+graphs.length*3},(_,i)=>i<14?{wch:10}:{hidden:true,wch:18});
graphs.forEach((g,i)=>{
 XLSX.utils.sheet_add_aoa(wb.Sheets['Gráficas'],[[g.title,'Valor'],...g.rows],{origin:{r:0,c:14+i*3}});
 if(g.type==='line')g.rows.forEach((r,index)=>{const cell=wb.Sheets['Gráficas'][XLSX.utils.encode_cell({r:index+1,c:15+i*3})];cell.f=`'Ingresos diarios'!B${index+2}`;});
});
const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});if(!graphs.length)return formatExcel(buf,wb);
const zip=XLSX.CFB.read(buf,{type:'buffer'});const read=p=>Buffer.from(XLSX.CFB.find(zip,'/'+p).content).toString('utf8');const write=(p,s)=>XLSX.CFB.utils.cfb_add(zip,'/'+p,Buffer.from(s));const ns='http://schemas.openxmlformats.org';
let drawing=`<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="${ns}/drawingml/2006/spreadsheetDrawing" xmlns:a="${ns}/drawingml/2006/main">`;let rels=`<Relationships xmlns="${ns}/package/2006/relationships">`;let types=read('[Content_Types].xml');
graphs.forEach((g,i)=>{const n=i+1;const labels=g.rows.map((r,j)=>`<c:pt idx="${j}"><c:v>${xml(r[0])}</c:v></c:pt>`).join('');const values=g.rows.map((r,j)=>`<c:pt idx="${j}"><c:v>${Number(r[1])||0}</c:v></c:pt>`).join('');
const chartTag=g.type==='line'?'lineChart':'barChart';
const chartOptions=g.type==='line'?'<c:grouping val="standard"/>':'<c:barDir val="col"/><c:grouping val="clustered"/>';
const seriesStyle=g.type==='line'?'<a:ln w="28575"><a:solidFill><a:srgbClr val="8AA645"/></a:solidFill></a:ln>':'<a:solidFill><a:srgbClr val="8AA645"/></a:solidFill>';
const chart=`<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="${ns}/drawingml/2006/chart" xmlns:a="${ns}/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xml(g.title)}</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/><c:${chartTag}>${chartOptions}<c:ser><c:idx val="0"/><c:order val="0"/><c:spPr>${seriesStyle}</c:spPr><c:cat><c:strRef><c:f>'Gráficas'!$${XLSX.utils.encode_col(14+i*3)}$2:$${XLSX.utils.encode_col(14+i*3)}$${g.rows.length+1}</c:f><c:strCache><c:ptCount val="${g.rows.length}"/>${labels}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'Gráficas'!$${XLSX.utils.encode_col(15+i*3)}$2:$${XLSX.utils.encode_col(15+i*3)}$${g.rows.length+1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${g.rows.length}"/>${values}</c:numCache></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:${chartTag}><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="2"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="1"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:plotVisOnly val="0"/></c:chart></c:chartSpace>`;write(`xl/charts/chart${n}.xml`,chart);types=types.replace('</Types>',`<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
drawing+=`<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${2+i*22}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${22+i*22}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${n}" name="Gráfica ${n}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${ns}/drawingml/2006/chart"><c:chart xmlns:c="${ns}/drawingml/2006/chart" xmlns:r="${ns}/officeDocument/2006/relationships" r:id="rId${n}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;rels+=`<Relationship Id="rId${n}" Type="${ns}/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/>`;});
write('xl/drawings/drawing1.xml',drawing+'</xdr:wsDr>');write('xl/drawings/_rels/drawing1.xml.rels',rels+'</Relationships>');const sheet=wb.SheetNames.indexOf('Gráficas')+1;write(`xl/worksheets/_rels/sheet${sheet}.xml.rels`,`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rIdCharts" Type="${ns}/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);write(`xl/worksheets/sheet${sheet}.xml`,read(`xl/worksheets/sheet${sheet}.xml`).replace('</worksheet>','<drawing r:id="rIdCharts"/></worksheet>'));write('[Content_Types].xml',types.replace('</Types>','<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'));return formatExcel(XLSX.CFB.write(zip,{type:'buffer',fileType:'zip',compression:true}),wb);}
module.exports={exportOperations};
