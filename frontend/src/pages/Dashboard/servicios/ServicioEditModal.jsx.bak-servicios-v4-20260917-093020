import React, { useEffect, useState } from 'react';
import { Calendar, Save, X } from 'lucide-react';
import api from '../../../services/api';
import { bogotaDateInput } from './serviceFormatters';

export default function ServicioEditModal({ service, onClose, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    descripcion_inicial: '',
    prioridad: 'normal',
    classification: 'diagnostic',
    service_type_name: '',
    service_type_category: '',
    scope_text: '',
    conditions_text: '',
    additional_costs_notice: '',
    observaciones: '',
    diagnostico_final: '',
    duracion_estimada: 60,
    reschedule: false,
    fecha_agendada: '',
    hora_inicio: '09:00',
  });

  useEffect(() => {
    if (!service?.id) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/api/service-orders/${service.id}`);
        const row = response.data?.data || response.data;
        if (!active) return;
        setDetail(row);
        const intake = row?.intake || {};
        setForm({
          descripcion_inicial: row?.descripcion_inicial || '',
          prioridad: row?.prioridad || intake.priority || 'normal',
          classification: row?.classification || intake.classification || 'diagnostic',
          service_type_name: row?.service_type_name || intake.service_type_name || '',
          service_type_category: row?.service_type_category || intake.service_type_category || '',
          scope_text: intake.scope_text || '',
          conditions_text: intake.conditions_text || '',
          additional_costs_notice: intake.additional_costs_notice || '',
          observaciones: row?.observaciones || '',
          diagnostico_final: row?.diagnostico_final || '',
          duracion_estimada: Number(row?.duracion_estimada || intake.estimated_duration || 60),
          reschedule: false,
          fecha_agendada: String(row?.fecha_agendada || '').slice(0, 10),
          hora_inicio: String(row?.hora_inicio_agendada || '09:00').slice(0, 5),
        });
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'No fue posible cargar la orden para editarla');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [service?.id]);

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (!service?.id) return;

    if (!form.descripcion_inicial.trim()) {
      setError('La descripción inicial no puede quedar vacía.');
      return;
    }

    if (form.reschedule && (!form.fecha_agendada || !form.hora_inicio)) {
      setError('Para reprogramar debes indicar fecha y hora.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.put(`/api/service-orders/${service.id}`, {
        descripcion_inicial: form.descripcion_inicial,
        prioridad: form.prioridad,
        classification: form.classification,
        service_type_name: form.service_type_name,
        service_type_category: form.service_type_category,
        scope_text: form.scope_text,
        conditions_text: form.conditions_text,
        additional_costs_notice: form.additional_costs_notice,
        observaciones: form.observaciones,
        diagnostico_final: form.diagnostico_final,
        duracion_estimada: Number(form.duracion_estimada || 60),
      });

      if (form.reschedule) {
        await api.put(`/api/agenda/servicio/${service.id}`, {
          fecha_agendada: form.fecha_agendada,
          hora_inicio: form.hora_inicio,
          duracion_estimada: Number(form.duracion_estimada || 60),
        });
      }

      await onSaved?.();
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 p-2 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div><h2 className="text-lg font-bold">Editar {detail?.codigo_os || service?.codigo_os}</h2><p className="text-xs text-gray-500">Solo se muestran campos que el backend puede guardar de forma consistente.</p></div>
          <button type="button" onClick={onClose} className="p-2"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading && <p className="text-sm text-gray-500">Cargando...</p>}
          {error && <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="md:col-span-2"><span className="text-sm font-semibold">Descripción inicial</span><textarea rows={3} value={form.descripcion_inicial} onChange={(e) => update('descripcion_inicial', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>
                <div className="space-y-4">
                  <label><span className="text-sm font-semibold">Prioridad</span><select value={form.prioridad} onChange={(e) => update('prioridad', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
                  <label><span className="text-sm font-semibold">Clasificación</span><select value={form.classification} onChange={(e) => update('classification', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2"><option value="diagnostic">Diagnóstico</option><option value="specific">Servicio específico</option></select></label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label><span className="text-sm font-semibold">Tipo de servicio</span><input value={form.service_type_name} onChange={(e) => update('service_type_name', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3" /></label>
                <label><span className="text-sm font-semibold">Categoría</span><input value={form.service_type_category} onChange={(e) => update('service_type_category', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3" /></label>
              </div>

              <label className="block"><span className="text-sm font-semibold">Alcance</span><textarea rows={3} value={form.scope_text} onChange={(e) => update('scope_text', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>
              <label className="block"><span className="text-sm font-semibold">Condiciones informadas</span><textarea rows={3} value={form.conditions_text} onChange={(e) => update('conditions_text', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>
              <label className="block"><span className="text-sm font-semibold">Aviso de costos adicionales</span><textarea rows={2} value={form.additional_costs_notice} onChange={(e) => update('additional_costs_notice', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label><span className="text-sm font-semibold">Observaciones</span><textarea rows={4} value={form.observaciones} onChange={(e) => update('observaciones', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>
                <label><span className="text-sm font-semibold">Diagnóstico final</span><textarea rows={4} value={form.diagnostico_final} onChange={(e) => update('diagnostico_final', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-3" /></label>
              </div>

              <section className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form.reschedule} onChange={(e) => update('reschedule', e.target.checked)} /> Reprogramar esta orden</label>
                <p className="text-xs text-gray-500 mt-1">Al reprogramar se validan todos los técnicos del equipo y se reemplazan los bloques activos de agenda.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <label><span className="text-xs font-medium">Fecha</span><input disabled={!form.reschedule} type="date" min={bogotaDateInput()} value={form.fecha_agendada} onChange={(e) => update('fecha_agendada', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 disabled:opacity-50" /></label>
                  <label><span className="text-xs font-medium">Hora</span><input disabled={!form.reschedule} type="time" value={form.hora_inicio} onChange={(e) => update('hora_inicio', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 disabled:opacity-50" /></label>
                  <label><span className="text-xs font-medium">Duración (min)</span><input type="number" min="1" max="1440" value={form.duracion_estimada} onChange={(e) => update('duracion_estimada', e.target.value)} className="mt-1 w-full min-h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2" /></label>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700">Cancelar</button>
          <button type="submit" disabled={saving || loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </footer>
      </form>
    </div>
  );
}
