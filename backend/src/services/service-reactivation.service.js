 'use strict';
// Caller owns the order lock and transaction, including the new schedule.
async function prepareReactivation(client, order, reason) {
 if (order.estado !== 'cancelado') throw Object.assign(new Error('Solo se pueden reactivar órdenes canceladas.'), {status:409});
 if (!String(reason || '').trim()) throw Object.assign(new Error('Escribe el motivo de reactivación.'), {status:400});
 const delivery = await client.query("SELECT status FROM service_order_deliveries WHERE service_order_id=$1 FOR UPDATE", [order.id]);
 if (delivery.rows.some(r=>r.status==='delivered')) throw Object.assign(new Error('La entrega ya fue confirmada. Crea una nueva orden para otro servicio.'), {status:409});
 const closure = await client.query('SELECT status FROM service_order_closures WHERE service_order_id=$1 FOR UPDATE',[order.id]);
 if (closure.rows.some(r=>!['draft','rework_required'].includes(r.status))) throw Object.assign(new Error('Esta orden tiene cierre técnico confirmado. Revisa su cierre antes de reactivarla.'), {status:409});
 const pending = await client.query('SELECT id FROM workshop_assignments WHERE service_order_id=$1 AND returned_quantity+consumed_quantity<quantity FOR UPDATE',[order.id]);
 if (pending.rows.length) throw Object.assign(new Error('Devuelve las herramientas y registra consumo o devolución de los insumos pendientes antes de reactivar.'), {status:409});
 await client.query('DELETE FROM service_inventory_allocations WHERE service_order_id=$1',[order.id]);
}
module.exports={prepareReactivation};
