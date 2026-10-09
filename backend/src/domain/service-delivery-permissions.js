'use strict';
const CLOSED_TECHNICAL = new Set(['technical_closed', 'handed_to_direction', 'direction_received', 'validated']);
function deliveryPermissions({admin,tech,assigned,custodyMine,closureStatus,deliveryStatus,deliveredBy,actorId}) {
 const allowedActor = admin || (tech && assigned);
 const reasons = [];
 if (!allowedActor) reasons.push('Solo administración o un técnico asignado a esta orden puede gestionar la entrega.');
 else if (!custodyMine && deliveryStatus !== 'delivered') reasons.push('La entrega debe confirmarla quien tiene la custodia del equipo.');
 if (deliveryStatus !== 'delivered' && !CLOSED_TECHNICAL.has(closureStatus)) reasons.push('Primero finaliza el trabajo con su resultado y fotografías en Cierre técnico.');
 return {
  can_prepare_delivery: allowedActor && deliveryStatus !== 'delivered',
  can_manage_delivery: allowedActor && custodyMine && CLOSED_TECHNICAL.has(closureStatus) && deliveryStatus !== 'delivered',
  can_record_satisfaction: deliveryStatus === 'delivered' && (admin || (tech && assigned && deliveredBy === actorId)),
  blocking_reasons: reasons,
 };
}
module.exports = {deliveryPermissions, CLOSED_TECHNICAL};
