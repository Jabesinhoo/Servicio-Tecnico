'use strict';
function deliveryPermissions({admin,tech,assigned,custodyMine,closureStatus,deliveryStatus,deliveredBy,actorId}) {
 const allowedActor = admin || (tech && assigned && custodyMine);
 const reasons = [];
 if (!admin && !(tech && assigned)) reasons.push('Solo administración o un técnico asignado a esta orden puede gestionar la entrega.');
 else if (!admin && !custodyMine) reasons.push('Debes tener la custodia del equipo para preparar y confirmar su entrega.');
 if (deliveryStatus !== 'delivered' && closureStatus !== 'validated') {
  if (!closureStatus || closureStatus === 'draft') reasons.push('Primero registra el resultado y confirma el cierre técnico. Si el servicio está en espera, revisa la autorización del cliente.');
  else reasons.push('Dirección Técnica debe recibir y validar el cierre antes de la entrega al cliente.');
 }
 return {
  can_manage_delivery: allowedActor && closureStatus === 'validated' && deliveryStatus !== 'delivered',
  can_record_satisfaction: deliveryStatus === 'delivered' && (admin || (tech && assigned && deliveredBy === actorId)),
  blocking_reasons: reasons,
 };
}
module.exports = {deliveryPermissions};
