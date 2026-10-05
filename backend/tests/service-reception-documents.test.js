'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { buildServiceDocumentHtml } = require('../src/services/service-document-template.service');
const { storedImage, loadReceptionMedia } = require('../src/services/service-reception-media.service');
const { normalizeDocumentDispatch } = require('../src/domain/service-document-dispatch');

function snapshot() {
  return {
    order: { codigo_os: 'OS-PRUEBA-01', client_name: 'Cliente de prueba', client_document: '12345' },
    intake: { request_description: 'No enciende después de una caída', equipment_intake: { worldoffice_order_reference: 'PED-45' } },
    primary_technician_name: 'Técnico de prueba',
    reception_act: { signed_by_name: 'Persona que entrega', signed_by_document: '98765', signed_at: '2026-10-05T17:00:00Z' },
    reception_checklist: { equipment_type: 'Portátil', brand: 'Marca de prueba', model: 'Modelo 25', serial_number: 'SER-999',
      received_from_name: 'Persona que entrega', received_from_document: '98765', confirmed_at: '2026-10-05T16:50:00Z',
      condition_flags: { scratches: true, humidity: false }, accessories: { charger: true, battery: false },
      accessories_other: 'Estuche negro', observations: 'Batería: No aplica. Rayón en tapa.' },
    reception_signature_data_uri: 'data:image/png;base64,FIRMA',
    reception_evidences: [{ original_name: 'foto-tapa.png', note: 'Rayón en tapa', data_uri: 'data:image/png;base64,FOTO', created_at: '2026-10-05T16:30:00Z' }],
  };
}
test('acta incluye valores reales, firmante, falla, fotos y firma', () => {
  const html = buildServiceDocumentHtml('reception_act', snapshot());
  for (const text of ['Portátil', 'Marca de prueba', 'Modelo 25', 'SER-999', 'Persona que entrega', '98765', 'PED-45',
    'No enciende después de una caída', 'Estuche negro', 'Batería: No aplica.', 'data:image/png;base64,FOTO', 'data:image/png;base64,FIRMA', 'Rayones:', 'Cargador / adaptador recibido:']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('<span>No</span>'));
});
test('escapa texto del cliente y notas de fotografía', () => {
  const data = snapshot();
  data.reception_checklist.observations = '<script>alert("x")</script>';
  data.reception_evidences[0].note = '<img src=x onerror=alert(1)>';
  const html = buildServiceDocumentHtml('reception_act', data);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});
test('órdenes antiguas usan descripción y nombres del formato anterior', () => {
  const data = snapshot(); delete data.intake;
  data.order.descripcion_inicial = 'Solicitud antigua';
  data.reception_act = { signer_name: 'Firmante antiguo', signer_document: 'DOC-antiguo' };
  const html = buildServiceDocumentHtml('reception_act', data);
  for (const text of ['Solicitud antigua', 'Firmante antiguo', 'DOC-antiguo']) assert.ok(html.includes(text));
});
test('cierre incluye solución escrita y equipo', () => {
  const data = snapshot();
  data.diagnosis = { solution_available: true, functional_result: 'Se reemplazó el conector y se probó el encendido' };
  data.closure = { final_result: 'Equipo funcional' };
  const html = buildServiceDocumentHtml('technical_closure', data);
  for (const text of ['Se reemplazó el conector y se probó el encendido', 'Equipo funcional', 'SER-999']) assert.ok(html.includes(text));
});
test('carga todas las fotos y firma desde archivos locales', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reception-doc-test-'));
  try {
    await fs.writeFile(path.join(root, 'photo.png'), 'foto');
    await fs.writeFile(path.join(root, 'signature.png'), 'firma');
    const data = { reception_act: { signature_storage_path: 'signature.png', signature_mime_type: 'image/png' },
      reception_evidences: [{ storage_path: 'photo.png', mime_type: 'image/png' }, { storage_path: 'photo.png', mime_type: 'image/png' }] };
    await loadReceptionMedia(data, root);
    assert.equal(data.reception_signature_data_uri, 'data:image/png;base64,ZmlybWE=');
    assert.ok(data.reception_evidences.every(item => item.data_uri === 'data:image/png;base64,Zm90bw=='));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('foto o firma ausente impide emitir constancia incompleta', async () => {
  await assert.rejects(storedImage(os.tmpdir(), 'foto-inexistente-9999.png', 'image/png'), { code: 'RECEPTION_MEDIA_MISSING' });
});
test('no lee rutas fuera de la carpeta ni otros formatos', async () => {
  await assert.rejects(storedImage(os.tmpdir(), '../etc/passwd', 'image/png'), { code: 'RECEPTION_MEDIA_MISSING' });
  await assert.rejects(storedImage(os.tmpdir(), 'file.html', 'text/html'), { code: 'RECEPTION_MEDIA_MISSING' });
});
test('descargar o compartir no equivale a confirmar envío', () => {
  const body = { channel: 'whatsapp', recipient_name: 'Cliente', recipient_contact: '3000000000' };
  assert.throws(() => normalizeDocumentDispatch(body), /Confirma/);
  assert.throws(() => normalizeDocumentDispatch({ ...body, confirmed_sent: 'true' }), /Confirma/);
  assert.equal(normalizeDocumentDispatch({ ...body, confirmed_sent: true }).delivery_evidence, 'operator_declaration');
});
test('envío exige canal, destinatario y contacto', () => {
  assert.throws(() => normalizeDocumentDispatch({ channel: 'sms', confirmed_sent: true }), /canal/);
  assert.throws(() => normalizeDocumentDispatch({ channel: 'email', confirmed_sent: true, recipient_name: 'Cliente' }), /destinatario/);
});
module.exports = { snapshot };
