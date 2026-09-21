import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, CreditCard, FileText, History, MapPin,
  Package, Phone, Mail, UsersRound, Wrench, X, ShieldCheck,
} from 'lucide-react';
import api from '../../../services/api';
import StatusBadge from './StatusBadge';
import MaterialesPanel from './components/MaterialesPanel';
import ServiceDocumentsModal from './components/ServiceDocumentsModal';
import { formatDateOnly, formatDateTime, formatTime, money, technicianName } from './serviceFormatters';

const Field = ({ label, value, wide = false }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{value ?? '—'}</p>
  </div>
);

const Section = ({ title, icon: Icon, children }) => (
  <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30 p-4">
    <h4 className="mb-4 flex items-center gap-2 text-sm font-bold"><Icon className="w-4 h-4 text-blue-600" />{title}</h4>
    {children}
  </section>
);


const EVENT_LABELS = {
  service_order_created: 'Orden de servicio creada',
  service_approved: 'Servicio aprobado',
  service_approved_and_team_assigned: 'Servicio aprobado y equipo técnico asignado',
  service_cancelled: 'Servicio cancelado',
  service_order_updated: 'Información del servicio actualizada',
  service_updated: 'Información del servicio actualizada',
  service_rescheduled: 'Servicio reprogramado',
  service_auto_scheduled: 'Servicio programado automáticamente',
  service_manual_scheduled: 'Servicio programado manualmente',
  technician_assigned: 'Técnico asignado',
  assignment_accepted: 'Asignación aceptada por el técnico',
  assignment_impediment: 'Técnico reportó un impedimento',
  technician_en_route: 'Técnico en camino',
  technician_arrived: 'Técnico llegó al servicio',
  reception_checklist_confirmed: 'Checklist de recepción confirmado',
  reception_act_signed: 'Acta de recepción firmada',
  service_diagnosis_confirmed: 'Diagnóstico técnico confirmado',
  service_closed: 'Servicio cerrado',
  final_delivery_completed: 'Entrega final registrada',
  financial_verification_inherited: 'Verificación financiera heredada de la solicitud',
};

const FIELD_LABELS = {
  codigo_os: 'Orden',
  billing_mode: 'Modalidad de facturación',
  invoice_reference: 'Factura',
  payment_status: 'Estado de pago',
  scheduling_mode: 'Programación',
  scheduled_date: 'Fecha programada',
  scheduled_time: 'Hora programada',
  team_size: 'Técnicos asignados',
  previous_state: 'Estado anterior',
  reason: 'Motivo',
  status: 'Estado',
  duration_minutes: 'Duración',
  activity_type: 'Actividad',
};

function humanizeToken(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventTitle(type) {
  return EVENT_LABELS[type] || humanizeToken(type);
}

function technicianLabel(id, team) {
  if (!id) return null;
  const member = team.find((item) => String(item.technician_id) === String(id));
  return member ? technicianName(member) : 'Técnico asignado';
}

function eventDetails(event, team) {
  const metadata = event?.metadata && typeof event.metadata === 'object'
    ? event.metadata
    : {};

  const rows = [];

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (['source', 'intake_id', 'service_order_id'].includes(key)) return;

    if (key === 'primary_technician_id' || key === 'technician_id') {
      rows.push(['Técnico', technicianLabel(value, team)]);
      return;
    }

    if (key === 'fields' && Array.isArray(value)) {
      rows.push(['Campos modificados', value.map(humanizeToken).join(', ')]);
      return;
    }

    if (key === 'team' && Array.isArray(value)) {
      const names = value
        .map((item) => technicianLabel(item?.technician_id, team))
        .filter(Boolean);
      rows.push(['Equipo técnico', names.length ? names.join(', ') : `${value.length} técnico(s)`]);
      return;
    }

    if (Array.isArray(value) || typeof value === 'object') return;

    let display = value;
    if (key === 'scheduled_date') display = formatDateOnly(value);
    if (key === 'scheduled_time') display = formatTime(value);
    if (key === 'billing_mode') display = value === 'prepaid' ? 'Prepago' : value === 'postpaid' ? 'Pospago' : humanizeToken(value);
    if (key === 'scheduling_mode') display = value === 'auto' ? 'Automática' : value === 'manual' ? 'Manual' : humanizeToken(value);
    if (key === 'payment_status') display = humanizeToken(value);
    if (key === 'duration_minutes') display = `${value} min`;

    rows.push([FIELD_LABELS[key] || humanizeToken(key), String(display)]);
  });

  return rows;
}

export default function ServicioDetail({ isOpen, onClose, servicioId, onRefresh }) {
  const [servicio, setServicio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('general');
  const [showDocuments, setShowDocuments] = useState(false);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const isAdmin = (user?.rol || user?.role?.name) === 'admin';

  const load = async () => {
    if (!servicioId) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/service-orders/${servicioId}`);
      setServicio(response.data?.data || response.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar el detalle del servicio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !servicioId) return;
    setTab('general');
    load();
  }, [isOpen, servicioId]);

  if (!isOpen) return null;

  const intake = servicio?.intake || {};
  const team = Array.isArray(servicio?.equipo) ? servicio.equipo : [];
  const blocks = Array.isArray(servicio?.agenda) ? servicio.agenda : [];
  const assignments = Array.isArray(servicio?.asignaciones) ? servicio.asignaciones : [];
  const events = Array.isArray(servicio?.eventos) ? servicio.eventos : [];
  const services = Array.isArray(servicio?.servicios) ? servicio.servicios : [];
  const financial = servicio?.control_financiero || null;
  const activeBlocks = blocks.filter((item) => item.status === 'active');

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 p-2 sm:p-4 flex items-start sm:items-center justify-center overflow-y-auto">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">{servicio?.codigo_os || 'Detalle de servicio'}</h2>
              {servicio?.estado && <StatusBadge status={servicio.estado} />}
              {servicio?.prioridad && <span className="text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-1">{String(servicio.prioridad).toUpperCase()}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Creada {formatDateTime(servicio?.createdAt)} · Actualizada {formatDateTime(servicio?.updatedAt)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
        </header>

        <nav className="shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 overflow-x-auto">
          <div className="flex min-w-max gap-1 py-2">
            {[
              ['general', 'Información'],
              ['servicios', `Servicios (${services.length})`],
              ['equipo', `Equipo (${team.length})`],
              ['agenda', `Agenda (${activeBlocks.length})`],
              ['finanzas', 'Facturación'],
              ['historial', `Historial (${events.length})`],
              ['materiales', 'Materiales'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-lg text-sm ${tab === id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{label}</button>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && <div className="py-16 text-center text-gray-500">Cargando información...</div>}
          {error && <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

          {!loading && servicio && tab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Cliente" icon={MapPin}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nombre / razón social" value={servicio.cliente_nombre} wide />
                  <Field label="Documento" value={servicio.cliente_documento} />
                  <Field label="Código WorldOffice" value={servicio.cliente_codigo_worldoffice} />
                  <Field label="Teléfono" value={servicio.cliente_telefono} />
                  <Field label="Correo" value={servicio.cliente_email} />
                  <Field label="Dirección" value={servicio.cliente_direccion} wide />
                  <Field label="Ciudad" value={servicio.cliente_ciudad} />
                </div>
              </Section>

              <Section title="Orden" icon={Wrench}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Código" value={servicio.codigo_os} />
                  <Field label="Estado" value={servicio.estado} />
                  <Field label="Prioridad" value={servicio.prioridad} />
                  <Field label="Origen" value={servicio.origen_tipo} />
                  <Field label="Técnico principal" value={servicio.tecnico_nombre || 'Sin asignar'} wide />
                  <Field label="Descripción inicial" value={servicio.descripcion_inicial} wide />
                  <Field label="Observaciones" value={servicio.observaciones} wide />
                  <Field label="Diagnóstico final" value={servicio.diagnostico_final} wide />
                  <Field label="Fecha asignación" value={formatDateTime(servicio.fecha_asignacion)} />
                  <Field label="Inicio real" value={formatDateTime(servicio.fecha_inicio)} />
                  <Field label="Fin real" value={formatDateTime(servicio.fecha_fin)} />
                </div>
              </Section>

              <Section title="Solicitud y alcance" icon={FileText}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Clasificación" value={intake.classification || servicio.classification} />
                  <Field label="Tipo de servicio" value={intake.service_type_name || servicio.service_type_name} />
                  <Field label="Categoría" value={intake.service_type_category || servicio.service_type_category} />
                  <Field label="Valor base" value={money(intake.base_value)} />
                  <Field label="Solicitud" value={intake.request_description || servicio.descripcion_inicial} wide />
                  <Field label="Alcance" value={intake.scope_text} wide />
                  <Field label="Condiciones informadas" value={intake.conditions_text} wide />
                  <Field label="Aviso costos adicionales" value={intake.additional_costs_notice} wide />
                </div>
              </Section>

              <Section title="Aceptación del cliente" icon={ShieldCheck}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Aceptado" value={intake.client_acceptance ? 'Sí' : 'No'} />
                  <Field label="Fecha aceptación" value={formatDateTime(intake.client_accepted_at)} />
                  <Field label="Aceptante" value={intake.client_acceptance_name} />
                  <Field label="Documento" value={intake.client_acceptance_document} />
                  <Field label="Canal" value={intake.client_acceptance_channel} />
                  <Field label="Referencia / evidencia" value={intake.client_acceptance_reference} wide />
                </div>
              </Section>
            </div>
          )}

          {!loading && servicio && tab === 'servicios' && (
            <div className="space-y-3">
              {services.length === 0 ? <p className="text-sm text-gray-500">No hay detalles de servicio registrados.</p> : services.map((item, index) => (
                <div key={item.id || index} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex justify-between gap-4 flex-wrap">
                    <div><p className="font-semibold">{item.tipo_servicio_nombre || `Servicio ${index + 1}`}</p><p className="text-sm text-gray-500">{item.descripcion_problema || '—'}</p></div>
                    <p className="font-semibold">{money(item.precio_estimado)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                    <Field label="Equipo relacionado" value={item.equipo_relacionado} />
                    <Field label="Requiere diagnóstico" value={item.requiere_diagnostico ? 'Sí' : 'No'} />
                    <Field label="Requiere repuestos" value={item.requiere_repuestos ? 'Sí' : 'No'} />
                    <Field label="Repuestos" value={item.repuestos_necesarios} wide />
                    <Field label="Observaciones" value={item.observaciones} wide />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && servicio && tab === 'equipo' && (
            <div className="space-y-3">
              {team.length === 0 ? <p className="text-sm text-gray-500">Sin equipo técnico registrado.</p> : team.map((item) => (
                <div key={item.id || item.technician_id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{technicianName(item)}</p><p className="text-xs text-gray-500">{item.usuario || '—'} · {item.email || item.celular || 'sin contacto'}</p></div>
                  <div className="text-right text-xs"><div className="font-semibold">{item.member_role === 'primary' ? 'Principal' : 'Apoyo'}</div><div className="text-gray-500">{item.member_status}</div></div>
                </div>
              ))}
              {assignments.length > 0 && <div className="mt-5"><h4 className="font-semibold mb-2">Asignaciones</h4>{assignments.map((item) => <div key={item.id} className="text-sm border-t border-gray-100 dark:border-gray-800 py-2">{item.status} · {formatDateTime(item.assigned_at)} {item.responded_at ? `· respuesta ${formatDateTime(item.responded_at)}` : ''}</div>)}</div>}
            </div>
          )}

          {!loading && servicio && tab === 'agenda' && (
            <div className="space-y-4">
              <Section title="Programación principal" icon={Calendar}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Fecha" value={formatDateOnly(servicio.fecha_agendada)} />
                  <Field label="Hora" value={formatTime(servicio.hora_inicio_agendada)} />
                  <Field label="Duración" value={servicio.duracion_estimada ? `${servicio.duracion_estimada} min` : '—'} />
                </div>
              </Section>
              {blocks.length === 0 ? <p className="text-sm text-gray-500">No hay bloques de agenda registrados.</p> : blocks.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex justify-between gap-3 flex-wrap"><strong>{item.block_role === 'primary' ? 'Principal' : 'Apoyo'}</strong><span className="text-xs">{item.status} · {item.source}</span></div>
                  <p className="mt-2 text-sm"><Clock className="inline w-4 h-4 mr-1" />{formatDateTime(item.start_at)} → {formatDateTime(item.end_at)}</p>
                  <p className="text-xs text-gray-500 mt-1">Técnico: {item.technician_id}</p>
                </div>
              ))}
            </div>
          )}

          {!loading && servicio && tab === 'finanzas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Facturación" icon={CreditCard}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Modalidad" value={intake.billing_mode || servicio.billing_mode} />
                  <Field label="Factura" value={intake.invoice_reference || servicio.invoice_reference} />
                  <Field label="Estado pago" value={intake.payment_status || servicio.payment_status} />
                  <Field label="Método" value={intake.payment_method} />
                  <Field label="Referencia pago" value={intake.payment_reference} />
                  <Field label="Verificado" value={formatDateTime(intake.payment_verified_at)} />
                  <Field label="Razón pospago" value={intake.postpaid_reason} wide />
                </div>
              </Section>
              <Section title="Control financiero" icon={CreditCard}>
                {financial ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Estado" value={financial.clearance_status} /><Field label="Requiere verificación" value={financial.verification_required ? 'Sí' : 'No'} /><Field label="Valor esperado" value={money(financial.expected_amount)} /><Field label="Última verificación" value={formatDateTime(financial.last_verified_at)} /><Field label="Nota" value={financial.note} wide /></div> : <p className="text-sm text-gray-500">Sin control financiero asociado.</p>}
              </Section>
            </div>
          )}

          {!loading && servicio && tab === 'historial' && (
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-gray-500">No hay eventos registrados.</p>
              ) : (
                events.map((event) => {
                  const details = eventDetails(event, team);
                  return (
                    <article
                      key={event.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                            {eventTitle(event.event_type)}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Realizado por {event.actor_name || 'Sistema'}
                          </p>
                        </div>
                        <time className="text-xs text-gray-500">
                          {formatDateTime(event.created_at)}
                        </time>
                      </div>

                      {details.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          {details.map(([label, value]) => (
                            <div key={`${event.id}-${label}`} className="text-sm">
                              <span className="text-gray-500">{label}: </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {!loading && servicio && tab === 'materiales' && <MaterialesPanel servicioId={servicioId} tecnicoId={servicio.tecnico_id} isAdmin={isAdmin} onRefresh={load} />}
        </main>

        <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button onClick={() => setShowDocuments(true)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos</button>
          <button onClick={async () => { await load(); await onRefresh?.(); }} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">Actualizar</button>
        </footer>
      </div>

      {showDocuments && <ServiceDocumentsModal service={servicio} isAdmin={isAdmin} onClose={() => setShowDocuments(false)} />}
    </div>
  );
}
