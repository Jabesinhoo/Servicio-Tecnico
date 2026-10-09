'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
test('Acta consulta autorizaciones de entrega sin exigir equipment_id inexistente',async()=>{
 const file=path.join(__dirname,'../src/controllers/service-document.controller.js'),requireLocal=createRequire(file),m={exports:{}},queries=[];
 vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.loadSnapshotForTest=loadSnapshot;', {module:m,exports:m.exports,require:requireLocal,console,process,Buffer,__dirname:path.dirname(file)});
 const client={async query(sql){queries.push(sql);if(sql.includes('service_order_delivery_evidences')){if(/\bequipment_id\b/.test(sql))throw Object.assign(new Error('column equipment_id does not exist'),{code:'42703'});return{rows:[{original_name:'Autorización.pdf',category:'third_party_authorization'}]};}return{rows:[]};}};
 const r=await m.exports.loadSnapshotForTest(client,{id:'00000000-0000-4000-8000-000000000001',tecnico_id:null});
 assert.equal(r.third_party_evidences[0].original_name,'Autorización.pdf');assert(queries.some(q=>q.includes('service_order_evidences')&&q.includes('equipment_id')));
});
