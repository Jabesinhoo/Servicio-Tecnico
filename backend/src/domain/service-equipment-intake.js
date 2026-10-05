'use strict';

const accessoryStates = new Set(['received', 'not_received', 'not_applicable']);
const conditions = new Set(['good', 'scratches', 'dents', 'broken', 'humidity', 'other']);
const text = (v, max = 2000) => typeof v === 'string' ? v.trim().slice(0, max) : '';

function normalizeEquipmentIntake(raw) {
  // Older requests without equipment information retain their existing flow.
  if (raw === undefined || raw === null) return { value: null, errors: [] };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { value: null, errors: ['Datos de ingreso del equipo no válidos'] };
  }
  const value = {
    equipment_received: raw.equipment_received,
    worldoffice_order_reference: text(raw.worldoffice_order_reference, 180),
    received_from_name: text(raw.received_from_name, 180),
    received_from_document: text(raw.received_from_document, 80),
    equipment_type: text(raw.equipment_type, 150),
    brand: text(raw.brand, 120),
    model: text(raw.model, 120),
    serial_number: text(raw.serial_number, 160),
    serial_reason: text(raw.serial_reason, 200),
    physical_condition: text(raw.physical_condition, 30),
    physical_notes: text(raw.physical_notes),
    technical_observations: text(raw.technical_observations),
    accessories_detail: text(raw.accessories_detail),
    charger: text(raw.charger, 30),
    battery: text(raw.battery, 30),
  };
  const errors = [];
  if (typeof value.equipment_received !== 'boolean') errors.push('Indica si se recibe un equipo');
  if (value.equipment_received === true) {
    if (!value.equipment_type) errors.push('Indica el equipo recibido');
    if (!value.received_from_name) errors.push('Indica quién entrega el equipo');
    if (!value.accessories_detail) errors.push('Registra los accesorios recibidos o escribe Ninguno');
    if (!value.serial_number && !value.serial_reason) errors.push('Registra el serial o el motivo por el que no está disponible');
    if (!conditions.has(value.physical_condition)) errors.push('Indica el estado físico del equipo');
    if (value.physical_condition === 'other' && !value.physical_notes) errors.push('Describe el estado físico');
    if (!accessoryStates.has(value.charger)) errors.push('Indica si se recibe cargador');
    if (!accessoryStates.has(value.battery)) errors.push('Indica si se recibe batería');
  } else if (value.equipment_received === false) {
    // Do not retain hidden equipment fields when changing to an on-site service.
    for (const key of Object.keys(value)) {
      if (!['equipment_received', 'worldoffice_order_reference'].includes(key)) value[key] = '';
    }
  }
  return { value, errors };
}

function receptionDraft(equipment, intake) {
  if (!equipment?.equipment_received) return null;
  const accessoryLabel = { received: 'Recibido', not_received: 'No recibido', not_applicable: 'No aplica' };
  return {
    equipment_type: equipment.equipment_type,
    brand: equipment.brand,
    model: equipment.model,
    serial_number: equipment.serial_number,
    received_from_name: equipment.received_from_name,
    received_from_document: equipment.received_from_document,
    condition_flags: { [equipment.physical_condition]: true },
    accessories: { charger: equipment.charger === 'received', battery: equipment.battery === 'received', other: Boolean(equipment.accessories_detail && !/^ningun[oa]s?$/i.test(equipment.accessories_detail)) },
    accessories_other: equipment.accessories_detail,
    observations: [
      `Falla reportada / solicitud: ${intake.request_description || ''}`,
      equipment.physical_notes && `Estado físico: ${equipment.physical_notes}`,
      equipment.serial_reason && !equipment.serial_number && `Serial no disponible: ${equipment.serial_reason}`,
      `Cargador: ${accessoryLabel[equipment.charger] || ''}`,
      `Batería: ${accessoryLabel[equipment.battery] || ''}`,
      equipment.technical_observations && `Observaciones de ingreso: ${equipment.technical_observations}`,
    ].filter(Boolean).join('\n'),
  };
}

module.exports = { normalizeEquipmentIntake, receptionDraft };
