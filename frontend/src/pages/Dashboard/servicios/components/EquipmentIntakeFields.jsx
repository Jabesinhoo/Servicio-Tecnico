import React from 'react';

export const emptyEquipmentIntake = () => ({
  equipment_received: true, worldoffice_order_reference: '', equipment_type: '',
  received_from_name: '', received_from_document: '', brand: '', model: '', serial_number: '', serial_reason: '', physical_condition: '',
  physical_notes: '', technical_observations: '', accessories_detail: '', charger: '', battery: '',
});

export function equipmentIntakeError(value) {
  if(!value?.equipment_received){for(const [index,item] of (value?.equipments||[]).entries())if(!item.equipment_type?.trim())return `Equipo ${index+1}: indica el equipo del servicio.`;return null;}
  if(Array.isArray(value.equipments)){if(!value.equipments.length)return 'Agrega al menos un equipo.';for(const [index,item] of value.equipments.entries()){const error=equipmentIntakeError({...item,equipments:undefined,equipment_received:true});if(error)return `Equipo ${index+1}: ${error}`;}return null;}
  if (!value.equipment_type?.trim()) return 'Indica el equipo recibido.';
  if (!value.received_from_name?.trim()) return 'Indica quién entrega el equipo.';
  if (!value.accessories_detail?.trim()) return 'Registra los accesorios recibidos o escribe «Ninguno».';
  if (!value.serial_number?.trim() && !value.serial_reason?.trim()) return 'Registra el serial o explica por qué no está disponible.';
  if (!value.physical_condition) return 'Selecciona el estado físico del equipo.';
  if (value.physical_condition === 'other' && !value.physical_notes?.trim()) return 'Describe el estado físico del equipo.';
  if (!value.charger || !value.battery) return 'Indica si se recibe cargador y batería; puedes seleccionar «No aplica».';
  return null;
}

export default function EquipmentIntakeFields({ value, onChange, readOnly = false, hideReceivedToggle = false, descriptionOnly = false }) {
  const data = value || emptyEquipmentIntake();
  const update = (key, next) => onChange({ ...data, [key]: next });
  const inputClass = 'mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 disabled:opacity-70';
  const field = (key, label, maxLength) => (
    <label key={key} className="block text-sm font-semibold">
      {label}
      <input value={data[key] || ''} maxLength={maxLength} disabled={readOnly} onChange={(e) => update(key, e.target.value)} className={inputClass} />
    </label>
  );
  const area = (key, label) => (
    <label key={key} className="block text-sm font-semibold">
      {label}
      <textarea rows={3} value={data[key] || ''} maxLength={2000} disabled={readOnly} onChange={(e) => update(key, e.target.value)} className={inputClass} />
    </label>
  );
  if(descriptionOnly)return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('equipment_type','Equipo del servicio *',150)}{field('brand','Marca',120)}{field('model','Modelo',120)}{field('serial_number','Serial (opcional)',160)}{area('technical_observations','Observaciones del equipo')}</div>;
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-300">Registra las condiciones en las que ingresa el equipo. El técnico verificará estos datos al recibirlo.</p>
      {readOnly && <p className="text-sm text-gray-500">Datos registrados al crear el servicio. Las verificaciones posteriores se realizan en el checklist de recepción.</p>}
      {!hideReceivedToggle&&<label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={Boolean(data.equipment_received)} disabled={readOnly} onChange={(e) => update('equipment_received', e.target.checked)} />
        El cliente entrega un equipo para recibirlo en taller
      </label>}
      {!data.equipment_received ? <p className="text-sm text-gray-500">Servicio en sitio o sin equipo recibido en taller.</p> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('received_from_name', 'Persona que entrega el equipo *', 180)}
            {field('received_from_document', 'Documento de quien entrega', 80)}
            {field('equipment_type', 'Equipo recibido *', 150)}
            {field('brand', 'Marca', 120)}
            {field('model', 'Modelo', 120)}
            {field('serial_number', 'Serial', 160)}
          </div>
          {!data.serial_number?.trim() && field('serial_reason', 'Motivo por el que no está disponible el serial *', 200)}
          <label className="block text-sm font-semibold">Estado físico *
            <select value={data.physical_condition || ''} disabled={readOnly} onChange={(e) => update('physical_condition', e.target.value)} className={inputClass}>
              <option value="">Seleccionar</option><option value="good">Buen estado</option>
              <option value="scratches">Rayones</option><option value="dents">Golpes / abolladuras</option>
              <option value="broken">Partes rotas</option><option value="humidity">Señales de humedad</option>
              <option value="other">Otro estado / varias novedades</option>
            </select>
          </label>
          {area('physical_notes', 'Detalle del estado físico y daños visibles')}
          {area('accessories_detail', 'Accesorios recibidos y cantidades * (escribe «Ninguno» si no entrega otros)')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['charger', 'battery'].map((key) => <label key={key} className="block text-sm font-semibold">
              {key === 'charger' ? 'Cargador / adaptador *' : 'Batería *'}
              <select value={data[key] || ''} disabled={readOnly} onChange={(e) => update(key, e.target.value)} className={inputClass}>
                <option value="">Seleccionar</option><option value="received">Recibido</option>
                <option value="not_received">No recibido</option><option value="not_applicable">No aplica</option>
              </select>
            </label>)}
          </div>
          {area('technical_observations', 'Observaciones de ingreso')}
          <p className="text-sm text-gray-500">La falla reportada se registra en Solicitud. La solución se documenta después del diagnóstico.</p>
        </>
      )}
    </div>
  );
}
