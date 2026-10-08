'use strict';
const {randomUUID}=require('crypto');
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
// The caller owns the acceptance transaction. Lock the order before any stock rows.
async function allocateAcceptanceInventory(client,orderId,technicianId){
 await client.query('SELECT id FROM service_orders WHERE id=$1 FOR UPDATE',[orderId]);
 const done=await client.query('SELECT technician_id FROM service_inventory_allocations WHERE service_order_id=$1',[orderId]);
 if(done.rows.length)return {already_allocated:true,technician_id:done.rows[0].technician_id,items:[]};
 const saved=await client.query('SELECT inventory_requirements FROM service_order_services WHERE service_order_id=$1',[orderId]);
 const totals=new Map();
 for(const row of saved.rows)for(const item of row.inventory_requirements||[]){const qty=Number(item.quantity);if(!Number.isInteger(qty)||qty<1||!item.product_id)fail('El inventario previsto contiene una cantidad inválida. Solicita su revisión.');totals.set(item.product_id,(totals.get(item.product_id)||0)+qty);}
 const items=[];
 // Same sorted order across concurrent acceptances avoids stock deadlocks.
 for(const [productId,quantity] of [...totals.entries()].sort(([a],[b])=>a.localeCompare(b))){
 const r=await client.query(`SELECT p.id,p.nombre,p.stock_actual,p.estado,w.kind FROM products p LEFT JOIN workshop_catalog w ON w.product_id=p.id WHERE p.id=$1 FOR UPDATE OF p`,[productId]);const p=r.rows[0];
 if(!p||!p.estado)fail('Uno de los artículos previstos está inactivo o ya no existe.');
 if(!['tool','supply'].includes(p.kind))fail(`Clasifica «${p.nombre}» en Inventario de taller como herramienta o insumo antes de aceptar.`);
 if(Number(p.stock_actual)<quantity)fail(`Inventario insuficiente para «${p.nombre}»: se necesitan ${quantity} y hay ${p.stock_actual}. No se aceptó el servicio ni se descontó inventario.`);
 items.push({...p,quantity});
 }
 for(const item of items){
 const id=randomUUID();const note='Asignación automática al aceptar el servicio';
 await client.query('UPDATE products SET stock_actual=stock_actual-$2,"updatedAt"=now() WHERE id=$1',[item.id,item.quantity]);
 await client.query(`INSERT INTO workshop_assignments(id,product_id,service_order_id,technician_id,quantity,note,assigned_by,item_kind) VALUES($1,$2,$3,$4,$5,$6,$4,$7)`,[id,item.id,orderId,technicianId,item.quantity,note,item.kind]);
 await client.query(`INSERT INTO workshop_events(assignment_id,action,quantity,actor_user_id,note) VALUES($1,'assigned',$2,$3,$4)`,[id,item.quantity,technicianId,note]);
 await client.query(`INSERT INTO inventory_movements(id,product_id,tipo_movimiento,origen_tipo,origen_id,cantidad,fecha,usuario_id,observaciones,"createdAt","updatedAt") VALUES($1,$2,'salida','servicio',$3,$4,now(),$5,$6,now(),now())`,[randomUUID(),item.id,orderId,item.quantity,technicianId,note+': '+id]);
 await client.query(`INSERT INTO service_order_events(id,service_order_id,event_type,actor_user_id,metadata,created_at) VALUES($1,$2,'workshop_item_assigned',$3,$4::jsonb,now())`,[randomUUID(),orderId,technicianId,JSON.stringify({assignment_id:id,product_id:item.id,quantity:item.quantity,technician_id:technicianId,automatic:true,summary:`Recibió ${item.quantity} unidades de ${item.nombre} al aceptar el servicio`})]);
 }
 await client.query('INSERT INTO service_inventory_allocations(service_order_id,technician_id) VALUES($1,$2)',[orderId,technicianId]);
 return {already_allocated:false,technician_id:technicianId,items:items.map(i=>({product_id:i.id,nombre:i.nombre,quantity:i.quantity,kind:i.kind}))};
}
module.exports={allocateAcceptanceInventory};
