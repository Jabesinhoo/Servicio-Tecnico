'use strict';
const XLSX=require('xlsx');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function formatExcel(buffer,workbook){
 const zip=XLSX.CFB.read(buffer,{type:'buffer'});
 const read=p=>Buffer.from(XLSX.CFB.find(zip,'/'+p).content).toString('utf8');
 const write=(p,s)=>XLSX.CFB.utils.cfb_add(zip,'/'+p,Buffer.from(s));
 let styles=read('xl/styles.xml');
 function append(tag,entries){let base=0;styles=styles.replace(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`),(all,attrs,inner)=>{base=Number(attrs.match(/count="(\d+)"/)?.[1]||0);return `<${tag}${attrs.replace(/count="\d+"/,`count="${base+entries.length}"`)}>${inner}${entries.join('')}</${tag}>`;});return base;}
 const font=append('fonts',[`<font><sz val="11"/><name val="Verdana"/><color rgb="FF1F2937"/></font>`,`<font><b/><sz val="11"/><name val="Verdana"/><color rgb="FFFFFFFF"/></font>`]);
 const fill=append('fills',[`<fill><patternFill patternType="solid"><fgColor rgb="FF8AA645"/><bgColor indexed="64"/></patternFill></fill>`,`<fill><patternFill patternType="solid"><fgColor rgb="FFF4F6EF"/><bgColor indexed="64"/></patternFill></fill>`]);
 const border=append('borders',[`<border><left/><right/><top/><bottom style="hair"><color rgb="FFE2E8D8"/></bottom></border>`]);
 const fmtIds=[...styles.matchAll(/numFmtId="(\d+)"/g)].map(m=>Number(m[1]));const fmt=Math.max(163,...fmtIds)+1;
 if(!/<numFmts\b/.test(styles))styles=styles.replace('<fonts','<numFmts count="0"></numFmts><fonts');
 if(/<numFmts[^>]*\/>/.test(styles))styles=styles.replace(/<numFmts[^>]*\/>/,'<numFmts count="0"></numFmts>');
 append('numFmts',[`<numFmt numFmtId="${fmt}" formatCode="${esc('#,##0.00;(#,##0.00);0.00')}"/>`,`<numFmt numFmtId="${fmt+1}" formatCode="dd/mm/yyyy"/>`]);
 const xf=(f,fillId,num=0)=>`<xf numFmtId="${num}" fontId="${f}" fillId="${fillId}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf>`;
 const base=append('cellXfs',[xf(font+1,fill),xf(font,0),xf(font,fill+1),xf(font,0,fmt),xf(font,fill+1,fmt),xf(font,0,fmt+1),xf(font,fill+1,fmt+1)]);
 write('xl/styles.xml',styles);
 let book=read('xl/workbook.xml');book=book.replace(/<calcPr\b[^>]*\/>/,'');book=book.replace('</workbook>','<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');write('xl/workbook.xml',book);
 workbook.SheetNames.forEach((name,index)=>{
  const ws=workbook.Sheets[name];const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  const headers=Array.from({length:range.e.c+1},(_,c)=>String(ws[XLSX.utils.encode_cell({r:0,c})]?.v||''));
  let xml=read(`xl/worksheets/sheet${index+1}.xml`);
  xml=xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,`<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`);
  if(!/<sheetViews>/.test(xml))xml=xml.replace(/(<dimension[^>]*\/>)/,'$1<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  xml=xml.replace(/<c\b([^>]*)>/g,(all,attrs)=>{
   const ref=attrs.match(/r="([A-Z]+\d+)"/)?.[1];if(!ref)return all;
   const loc=XLSX.utils.decode_cell(ref),cell=ws[ref];if(!cell)return all;
   const alternate=loc.r%2===0?1:0;let style=loc.r===0?base:base+1+alternate;
   const label=name==='Resumen'&&loc.c===1?String(ws['A'+(loc.r+1)]?.v||''):headers[loc.c];
   if(loc.r>0&&typeof cell.v==='number'&&/Factur|Ingreso|Importe|Total|Costo|Variación|Real_min|Minutos|Valor/i.test(label))style=base+3+alternate;
   if(loc.r>0&&(cell.t==='d'||/^Fecha$|Creación|Finalizado|Desde|Hasta/.test(label)))style=base+5+alternate;
   return `<c${attrs.replace(/\s+s="\d+"/,'')} s="${style}">`;
  });
  xml=xml.replace(/<row\b([^>]*)>/g,(all,attrs)=>{
   const r=Number(attrs.match(/r="(\d+)"/)?.[1]||1)-1;
   const lines=Math.max(1,...headers.map((_,c)=>{const value=ws[XLSX.utils.encode_cell({r,c})]?.v;const width=ws['!cols']?.[c]?.wch||18;return typeof value==='string'?Math.ceil(value.length/Math.max(8,width-2)):1;}));
   return `<row${attrs.replace(/\s+(ht|customHeight)="[^"]*"/g,'')} ht="${Math.max(r===0?34:26,lines*16+8)}" customHeight="1">`;
  });
  if(name!=='Gráficas'&&range.e.r>0&&!/<autoFilter/.test(xml))xml=xml.replace('</sheetData>',`</sheetData><autoFilter ref="${ws['!ref']}"/>`);
  write(`xl/worksheets/sheet${index+1}.xml`,xml);
 });
 return XLSX.CFB.write(zip,{type:'buffer',fileType:'zip',compression:true});
}
function typedRows(rows){return rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
 if(value&&(/^(Fecha|Desde|Hasta|Creación|Finalizado|Generado)$/.test(key))){const d=new Date(value);if(!Number.isNaN(d.getTime()))return[key,d];}
 return[key,value];
})));}
module.exports={formatExcel,typedRows};
