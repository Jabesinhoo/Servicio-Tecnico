const test=require('node:test');const assert=require('node:assert/strict');
const {deliveryPermissions:p}=require('../src/domain/service-delivery-permissions');
const ready={admin:false,tech:true,assigned:true,custodyMine:true,closureStatus:'validated',deliveryStatus:'draft',actorId:'actor'};
test('técnico asignado y custodio puede gestionar la entrega validada',()=>assert.equal(p(ready).can_manage_delivery,true));
test('un técnico ajeno o sin custodia no puede gestionar entrega',()=>{assert.equal(p({...ready,assigned:false}).can_manage_delivery,false);assert.equal(p({...ready,custodyMine:false}).can_manage_delivery,false)});
test('cierre pendiente informa al técnico el paso que falta',()=>{const r=p({...ready,closureStatus:null});assert.equal(r.can_manage_delivery,false);assert.match(r.blocking_reasons.join(' '),/finaliza el trabajo/)});
test('cierre técnico confirmado habilita entrega directa sin validación interna',()=>{const r=p({...ready,closureStatus:'technical_closed'});assert.equal(r.can_manage_delivery,true);assert.equal(r.blocking_reasons.length,0)});
test('administración también necesita cierre y custodia para confirmar',()=>{assert.equal(p({...ready,admin:true,custodyMine:false}).can_manage_delivery,false);assert.equal(p({...ready,admin:true,custodyMine:true,closureStatus:'draft'}).can_manage_delivery,false)});
test('entrega confirmada bloquea edición y permite encuesta a quien entregó',()=>{const r=p({...ready,deliveryStatus:'delivered',deliveredBy:'actor',custodyMine:false});assert.equal(r.can_manage_delivery,false);assert.equal(r.can_record_satisfaction,true);assert.equal(p({...ready,deliveryStatus:'delivered',deliveredBy:'otro',custodyMine:false}).can_record_satisfaction,false)});

test('técnico asignado puede preparar receptor y firma antes de validar el cierre',()=>{const r=p({...ready,closureStatus:'draft'});assert.equal(r.can_prepare_delivery,true);assert.equal(r.can_manage_delivery,false)});
test('el borrador puede prepararse sin custodia pero su confirmación sigue bloqueada',()=>{const r=p({...ready,custodyMine:false});assert.equal(r.can_prepare_delivery,true);assert.equal(r.can_manage_delivery,false);assert.equal(p({...ready,assigned:false}).can_prepare_delivery,false)});
test('administración prepara el borrador y nadie edita una entrega confirmada',()=>{assert.equal(p({...ready,admin:true,closureStatus:'draft'}).can_prepare_delivery,true);assert.equal(p({...ready,admin:true,deliveryStatus:'delivered'}).can_prepare_delivery,false)});
