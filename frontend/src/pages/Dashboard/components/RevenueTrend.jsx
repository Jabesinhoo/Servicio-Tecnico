import React from 'react';
const money=v=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v||0);
export default function RevenueTrend({financial}){
 const rows=financial.trend||[];
 const min=Math.min(0,...rows.map(r=>r.invoiced)),max=Math.max(1,...rows.map(r=>r.invoiced));
 const x=i=>55+(i/Math.max(1,rows.length-1))*625;
 const y=value=>190-(value-min)/(max-min)*155;
 const points=rows.map((r,i)=>`${x(i)},${y(r.invoiced)}`).join(' ');
 const change=financial.change||0;
 return <section className="border rounded-2xl p-4 min-w-0"><h2 className="font-bold">Evolución de ingresos facturados</h2><p className="text-sm mt-1">{change>0?'↑ Aumento':change<0?'↓ Descenso':'Sin variación'}: {money(Math.abs(change))}{financial.change_percent!==null?` (${Math.abs(financial.change_percent)} %)`:''} frente a {financial.previous_range.from} — {financial.previous_range.to}.</p>
 <div className="accent-text mt-4"><svg viewBox="0 0 710 235" className="w-full" role="img" aria-label="Gráfica diaria de ingresos facturados; los valores detallados están en la tabla inferior">
 {[min,(min+max)/2,max].map((v,i)=><g key={i}><line x1="55" x2="680" y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.15"/><text x="50" y={y(v)+4} textAnchor="end" fontSize="10" fill="currentColor">{new Intl.NumberFormat('es-CO',{notation:'compact'}).format(v)}</text></g>)}
 <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5"/>
 {rows.map((r,i)=><circle key={r.date} cx={x(i)} cy={y(r.invoiced)} r={rows.length>90?2:3} fill="currentColor"><title>{r.date}: {money(r.invoiced)}</title></circle>)}
 {rows.filter((r,i)=>i===0||i===rows.length-1||i===Math.floor(rows.length/2)).map(r=><text key={r.date} x={x(rows.indexOf(r))} y="218" textAnchor="middle" fontSize="10" fill="currentColor">{r.date}</text>)}
 </svg></div><details className="text-sm"><summary className="cursor-pointer">Ver valores por día</summary><div className="max-h-64 overflow-auto"><table className="w-full mt-2"><thead><tr><th className="text-left">Fecha</th><th className="text-right">Facturado</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><td>{r.date}</td><td className="text-right">{money(r.invoiced)}</td></tr>)}</tbody></table></div></details></section>;
}
