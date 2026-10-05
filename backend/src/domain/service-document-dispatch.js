'use strict';
function normalizeDocumentDispatch(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Datos de envío no válidos');
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const channel = text(body.channel, 30);
  if (!['whatsapp', 'email', 'physical', 'other'].includes(channel)) {
    throw new Error('Selecciona el canal de envío');
  }
  const recipient_name = text(body.recipient_name, 180);
  const recipient_contact = text(body.recipient_contact, 220);
  const reference = text(body.reference, 1000);
  if (!recipient_name || !recipient_contact) throw new Error('Indica destinatario y contacto o identificación');
  if (body.confirmed_sent !== true) throw new Error('Confirma que ya entregaste o enviaste el PDF');
  return { channel, recipient_name, recipient_contact, reference, confirmed_sent: true,
    delivery_evidence: 'operator_declaration' };
}
module.exports = { normalizeDocumentDispatch };
