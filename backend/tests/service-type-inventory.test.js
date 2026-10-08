'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateRequirements,saveRequirements}=require('../src/services/service-type-inventory.service');
const id='00000000-0000-4000-8000-000000000001';
test('inventario requerido rechaza duplicados, cantidades fraccionadas y referencias inválidas',()=>{
 for(const value of [[{product_id:id,quantity:0}],[{product_id:id,quantity:1.5}],[{product_id:'incorrecto',quantity:1}],[{product_id:id,quantity:1},{product_id:id,quantity:2}],null])assert.throws(()=>validateRequirements(value),{status:400});
 assert.deepEqual(validateRequirements([{product_id:id,quantity:'2'}]),[{product_id:id,quantity:2}]);
});
test('artículo inactivo no borra la configuración anterior ni modifica existencias',async()=>{
 const calls=[];const client={query:async(sql)=>{calls.push(sql);return {rows:[]};}};
 await assert.rejects(()=>saveRequirements(client,id,[{product_id:id,quantity:2}]),{status:400});assert.equal(calls.length,1);assert.match(calls[0],/estado=true/);
});
test('quitar todos los artículos elimina la plantilla y no descuenta inventario',async()=>{
 const calls=[];const client={query:async(sql)=>{calls.push(sql);return {rows:[]};}};
 await saveRequirements(client,id,[]);assert.match(calls[0],/DELETE FROM service_type_inventory_requirements/);assert(!calls.some(sql=>/UPDATE products/.test(sql)));
});
