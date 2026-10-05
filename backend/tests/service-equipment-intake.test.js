'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEquipmentIntake, receptionDraft } = require('../src/domain/service-equipment-intake');
const fixture = () => ({
 equipment_received: true, worldoffice_order_reference: '5718',
 equipment_type: 'Impresora', brand: 'Epson', model: 'L3250', serial_number: 'SN-123',
 received_from_name: 'Persona que entrega', received_from_document: '123456',
 physical_condition: 'scratches', physical_notes: 'Rayón en la cubierta',
 accessories_detail: 'Cable de poder x1', charger: 'not_applicable', battery: 'not_applicable',
 technical_observations: 'Ingresa a revisión',
});
test('Conserva identificación y condiciones hasta el borrador de recepción', () => {
 const { value, errors } = normalizeEquipmentIntake(fixture());
 assert.deepEqual(errors, []);
 const draft = receptionDraft(value, { request_description: 'No imprime', client_acceptance_name: 'Otra persona' });
 assert.equal(value.worldoffice_order_reference, '5718');
 assert.equal(draft.serial_number, 'SN-123');
 assert.equal(draft.received_from_name, 'Persona que entrega');
 assert.equal(draft.condition_flags.scratches, true);
 assert.equal(draft.accessories_other, 'Cable de poder x1');
 assert.match(draft.observations, /No imprime/);
 assert.match(draft.observations, /Batería: No aplica/);
 assert.equal(draft.confirmed_at, undefined);
 assert.equal(draft.signed_at, undefined);
});
test('Serial ausente exige motivo y lo conserva en recepción', () => {
 const data = { ...fixture(), serial_number: '' };
 assert.ok(normalizeEquipmentIntake(data).errors.length);
 data.serial_reason = 'Etiqueta ilegible';
 const result = normalizeEquipmentIntake(data);
 assert.deepEqual(result.errors, []);
 assert.match(receptionDraft(result.value, {}).observations, /Etiqueta ilegible/);
});
test('Un servicio en sitio descarta campos ocultos de una recepción anterior', () => {
 const result = normalizeEquipmentIntake({ ...fixture(), equipment_received: false });
 assert.deepEqual(result.errors, []);
 assert.equal(result.value.serial_number, '');
 assert.equal(result.value.received_from_name, '');
 assert.equal(result.value.worldoffice_order_reference, '5718');
 assert.equal(receptionDraft(result.value, {}), null);
});
test('No recibido y No aplica permanecen diferenciados en las observaciones', () => {
 const result = normalizeEquipmentIntake({ ...fixture(), charger: 'not_received', battery: 'received' });
 const draft = receptionDraft(result.value, {});
 assert.equal(draft.accessories.charger, false);
 assert.equal(draft.accessories.battery, true);
 assert.match(draft.observations, /Cargador: No recibido/);
 assert.match(draft.observations, /Batería: Recibido/);
});
test('Ninguno no marca otros accesorios como recibidos', () => {
 const result = normalizeEquipmentIntake({ ...fixture(), accessories_detail: 'Ninguno' });
 assert.equal(receptionDraft(result.value, {}).accessories.other, false);
});
test('Rechaza estados incompletos o valores de accesorio desconocidos', () => {
 for (const change of [{ physical_condition: '' }, { received_from_name: '' }, { accessories_detail: '' }, { charger: 'unknown' }, { physical_condition: 'other', physical_notes: '' }]) {
  assert.ok(normalizeEquipmentIntake({ ...fixture(), ...change }).errors.length);
 }
 assert.ok(normalizeEquipmentIntake([]).errors.length);
 assert.ok(normalizeEquipmentIntake({ equipment_received: 'false' }).errors.length);
});
test('Solicitudes anteriores sin información de ingreso siguen siendo compatibles', () => {
 assert.deepEqual(normalizeEquipmentIntake(undefined), { value: null, errors: [] });
 assert.equal(receptionDraft(null, {}), null);
});
