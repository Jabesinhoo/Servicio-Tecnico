'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const storage=new AsyncLocalStorage();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function withActor(id,fn){return storage.run({id:UUID.test(String(id))?String(id):''},fn);}
function currentActor(){return storage.getStore()?.id||'';}
module.exports={withActor,currentActor};
