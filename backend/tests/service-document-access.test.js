'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
let scenario;
const orderId = '065c0370-c9c2-4b51-a935-c82e6fabf069';
const documentId = '8c216b18-0266-4a44-8efc-d359869e0efc';
const client = { release() {}, async query(sql, params) {
  if (sql.includes('FROM service_orders so')) return { rows: scenario.order ? [scenario.order] : [] };
  if (sql.includes('FROM service_order_intakes')) return {rows:[]};
  if (sql.includes('FROM service_order_team_members')) return { rows: [] };
  if (sql.includes('SELECT id FROM service_order_documents')) {
    assert.deepEqual(params, [documentId, orderId]); return { rows: scenario.document ? [{ id: documentId }] : [] };
  }
  if (sql.includes('INSERT INTO service_order_document_events')) {
    scenario.inserted = params; return { rows: [{ id: params[0], metadata: JSON.parse(params[4]) }] };
  }
  throw new Error('Consulta inesperada: '+sql);
} };
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === '../db/pool') return { connect: async () => client };
  return originalLoad.call(this, request, ...args);
};
const { recordManualDispatch } = require('../src/controllers/service-document.controller');
Module._load = originalLoad;
async function call(role, configuration) {
  scenario = configuration;
  const req = { params: { id: orderId, documentId }, user: { id: 'user-1', role: { name: role } },
    body: { channel: 'email', recipient_name: 'Cliente', recipient_contact: 'cliente@example.com', confirmed_sent: true } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  await recordManualDispatch(req, res); return res;
}
test('no registra envíos para órdenes inexistentes', async () => {
  const res = await call('admin', {}); assert.equal(res.statusCode, 404); assert.equal(scenario.inserted, undefined);
});
test('técnico ajeno a la orden no puede registrar envío', async () => {
  const res = await call('tecnico', { order: { id: orderId, tecnico_id: 'otro' } });
  assert.equal(res.statusCode, 403); assert.equal(scenario.inserted, undefined);
});
test('no registra un documento de otra orden o versión histórica', async () => {
  const res = await call('admin', { order: { id: orderId } });
  assert.equal(res.statusCode, 409); assert.equal(scenario.inserted, undefined);
});
test('administración registra versión vigente con actor y destinatario', async () => {
  const res = await call('admin', { order: { id: orderId }, document: true });
  assert.equal(res.statusCode, 201); assert.equal(scenario.inserted[3], 'user-1');
  assert.equal(res.data.data.metadata.recipient_contact, 'cliente@example.com');
});
