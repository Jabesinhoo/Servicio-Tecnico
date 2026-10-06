const test=require('node:test');const assert=require('node:assert/strict');
const {deliveryPermissions:p}=require('../src/domain/service-delivery-permissions');
const ready={admin:false,tech:true,assigned:true,custodyMine:true,closureStatus:'validated',deliveryStatus:'draft',actorId:'actor'};
test('técnico asignado y custodio puede gestionar la entrega validada',()=>assert.equal(p(ready).can_manage_delivery,true));
test('un técnico ajeno o sin custodia no puede gestionar entrega',()=>{assert.equal(p({...ready,assigned:false}).can_manage_delivery,false);assert.equal(p({...ready,custodyMine:false}).can_manage_delivery,false)});
test('cierre pendiente informa al técnico el paso que falta',()=>{const r=p({...ready,closureStatus:null});assert.equal(r.can_manage_delivery,false);assert.match(r.blocking_reasons.join(' '),/confirma el cierre técnico/)});
test('cierre técnico confirmado todavía requiere validación de dirección',()=>{const r=p({...ready,closureStatus:'technical_closed'});assert.equal(r.can_manage_delivery,false);assert.match(r.blocking_reasons.join(' '),/Dirección Técnica/)});
test('administración conserva gestión pero también requiere cierre validado',()=>{assert.equal(p({...ready,admin:true,custodyMine:false}).can_manage_delivery,true);assert.equal(p({...ready,admin:true,closureStatus:'draft'}).can_manage_delivery,false)});
test('entrega confirmada bloquea edición y permite encuesta a quien entregó',()=>{const r=p({...ready,deliveryStatus:'delivered',deliveredBy:'actor',custodyMine:false});assert.equal(r.can_manage_delivery,false);assert.equal(r.can_record_satisfaction,true);assert.equal(p({...ready,deliveryStatus:'delivered',deliveredBy:'otro',custodyMine:false}).can_record_satisfaction,false)});
