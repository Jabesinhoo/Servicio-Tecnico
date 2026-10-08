'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const {validEvidenceBytes,finalPhotoCount}=require('../src/domain/final-photo-evidence');
test('El cierre requiere fotos; PDF no cuenta y reproceso exige foto nueva',()=>{
 const evidences=[{mime_type:'application/pdf',created_at:'2026-10-08T12:00:00Z'},{mime_type:'image/png',created_at:'2026-10-08T12:00:00Z'},{mime_type:'image/jpeg',created_at:'2026-10-08T15:00:00Z'}];
 assert.equal(finalPhotoCount([evidences[0]],{status:'draft'}),0);assert.equal(finalPhotoCount(evidences,{status:'draft'}),2);
 assert.equal(finalPhotoCount(evidences,{status:'rework_required',rework_started_at:'2026-10-08T14:00:00Z'}),1);assert.equal(finalPhotoCount(evidences.slice(0,2),{status:'rework_required',rework_started_at:'2026-10-08T14:00:00Z'}),0);
});
test('El formato declarado debe coincidir con la cabecera del archivo',()=>{
 const png=Buffer.from([137,80,78,71,13,10,26,10,0]),pdf=Buffer.from('%PDF-1.7');
 for(const [mime,data] of [['image/png',png],['application/pdf',pdf],['image/jpeg',Buffer.from([255,216,255,224])],['image/webp',Buffer.from('RIFF0000WEBP0')]])assert.equal(validEvidenceBytes(mime,data),true);
 assert.equal(validEvidenceBytes('image/png',pdf),false);assert.equal(validEvidenceBytes('image/jpeg',pdf),false);assert.equal(validEvidenceBytes('image/webp',png),false);assert.equal(validEvidenceBytes('image/png',Buffer.alloc(0)),false);
});
test('El endpoint rechaza cierre sin fotografías antes de confirmar',async()=>{
 const id='00000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000002',queries=[];
 const client={release(){},async query(sql,args){queries.push({sql,args});let rows=[];if(sql.includes('FROM service_orders'))rows=[{id,estado:'en_ejecucion',tecnico_id:actor}];else if(sql.includes('FROM service_order_team_members'))rows=[{technician_id:actor}];else if(sql.includes('FROM service_order_closures'))rows=[{status:'draft',final_result:'Equipo funcionando',checklist:{tests_completed:true,functional_verified:true,accessories_checked:true,cleaning_done:true}}];else if(sql.includes('FROM service_order_diagnostics'))rows=[{status:'confirmed'}];else if(sql.includes('FROM service_order_final_evidences'))rows=[{total:0}];return {rows};}};
 const file=path.join(__dirname,'../src/controllers/service-closure.controller.js'),m={exports:{}},req=createRequire(file);
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,require:n=>n==='../db/pool'?{connect:async()=>client}:req(n),console,process,Buffer,__dirname:path.dirname(file)});
 const res={code:200,status(n){this.code=n;return this},json(b){this.body=b;return this}};
 await m.exports.technicalClose({params:{id},user:{id:actor,rol:'tecnico'},body:{}},res);
 assert.equal(res.code,409);assert.equal(res.body.code,'FINAL_EVIDENCE_REQUIRED');assert.match(res.body.message,/fotograf/);assert(queries.some(q=>q.sql.includes("mime_type IN ('image/jpeg','image/png','image/webp')")));assert(queries.some(q=>q.sql==='ROLLBACK'));assert(!queries.some(q=>q.sql==='COMMIT'||q.sql.includes('UPDATE service_orders')));
});
