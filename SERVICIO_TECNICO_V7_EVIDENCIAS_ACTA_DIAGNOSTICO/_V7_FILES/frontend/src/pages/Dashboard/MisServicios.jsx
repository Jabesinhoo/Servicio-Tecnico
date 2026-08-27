// frontend/src/pages/Dashboard/MisServicios.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  Camera,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  MapPin,
  PauseCircle,
  PenLine,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  UserCheck,
  UserRoundCog,
  Wrench,
  X,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  asignada: 'Asignada',
  en_ejecucion: 'En ejecución',
  en_espera: 'En espera',
  cerrada: 'Cerrada',
  rechazado: 'Rechazada',
  cancelado: 'Cancelada',
};

const ASSIGNMENT_LABELS = {
  pendiente: 'Esperando respuesta',
  aceptada: 'Aceptada',
  impedimento: 'Impedimento reportado',
  revocada: 'Revocada',
};

const CHECKLIST_LABELS = {
  draft: 'Checklist en borrador',
  confirmed: 'Recepción confirmada',
};

const CONDITION_OPTIONS = [
  ['good', 'Buen estado'],
  ['scratches', 'Rayones'],
  ['dents', 'Golpes / abolladuras'],
  ['broken', 'Partes rotas'],
  ['humidity', 'Señales de humedad'],
  ['tampered', 'Manipulado / abierto'],
  ['other', 'Otra novedad'],
];

const ACCESSORY_OPTIONS = [
  ['charger', 'Cargador / adaptador'],
  ['battery', 'Batería'],
  ['bag', 'Maletín / estuche'],
  ['power_cable', 'Cable de poder'],
  ['network_cable', 'Cable de red'],
  ['other', 'Otros accesorios'],
];

const emptyChecklist = () => ({
  equipment_type: '',
  brand: '',
  model: '',
  serial_number: '',
  received_from_name: '',
  received_from_document: '',
  condition_flags: {},
  accessories: {},
  accessories_other: '',
  observations: '',
  status: 'draft',
  confirmed_at: null,
});

const formatDateTime = (value) => {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const fullClientAddress = (service) =>
  [service?.cliente_direccion, service?.cliente_ciudad]
    .filter(Boolean)
    .join(', ') || 'Dirección no registrada';

const technicianName = (service) =>
  service?.tecnico_nombre_completo ||
  service?.tecnico_usuario ||
  service?.tecnico_nombre ||
  'Técnico sin nombre';


const directoryTechnicianName = (tech) => {
  const fullName = [tech?.nombre1, tech?.nombre2, tech?.apellidos]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return fullName || tech?.usuario || 'Técnico sin nombre';
};

const normalizeSearch = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const integrityBadge = (tech) => {
  const status = tech?.location_integrity_status || 'unverified';
  const network = tech?.network_trust_status || 'unknown';
  const device = tech?.device_trust_status || 'unknown';
  if (!tech?.last_location_at) return { label: 'Sin GPS reciente', cls: 'text-slate-500' };
  if (network === 'blocked' || tech?.network_vpn || tech?.network_proxy || tech?.network_tor) {
    return { label: 'Red anónima bloqueada', cls: 'text-red-600 dark:text-red-400' };
  }
  if (device === 'pending') return { label: 'Dispositivo pendiente', cls: 'text-amber-600 dark:text-amber-400' };
  if (status === 'trusted') return { label: 'GPS validado', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (status === 'suspicious') return { label: 'GPS para revisar', cls: 'text-amber-600 dark:text-amber-400' };
  if (status === 'rejected') return { label: 'GPS rechazado', cls: 'text-red-600 dark:text-red-400' };
  return { label: 'GPS sin validar', cls: 'text-slate-500' };
};

const getActionState = (service) => {
  const assignment = service?.assignment_status;
  const hasCustody = Boolean(service?.has_custody);
  const checklistConfirmed = Boolean(
    service?.reception_checklist_confirmed
  );

  if (
    service?.estado === 'asignada' &&
    (!assignment || assignment === 'pendiente')
  ) {
    return 'respond_assignment';
  }

  if (
    service?.estado === 'asignada' &&
    assignment === 'aceptada' &&
    !hasCustody
  ) {
    return 'take_custody';
  }

  if (
    service?.estado === 'asignada' &&
    assignment === 'aceptada' &&
    hasCustody &&
    !checklistConfirmed
  ) {
    return 'checklist';
  }

  if (
    service?.estado === 'asignada' &&
    assignment === 'aceptada' &&
    hasCustody &&
    checklistConfirmed &&
    Number(service?.reception_evidence_count || 0) < 1
  ) {
    return 'reception_evidence';
  }

  if (
    service?.estado === 'asignada' &&
    assignment === 'aceptada' &&
    hasCustody &&
    checklistConfirmed &&
    Number(service?.reception_evidence_count || 0) >= 1 &&
    !service?.reception_act_signed
  ) {
    return 'sign_reception_act';
  }

  if (
    service?.estado === 'asignada' &&
    assignment === 'aceptada' &&
    hasCustody &&
    checklistConfirmed &&
    service?.reception_act_signed
  ) {
    return 'start';
  }

  if (service?.estado === 'en_ejecucion' && hasCustody) {
    return 'pause';
  }

  if (service?.estado === 'en_espera' && hasCustody) {
    return 'resume';
  }

  return null;
};

const Info = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white break-words">
      {value || '—'}
    </p>
  </div>
);

const ServiceCard = ({
  service,
  isAdmin,
  onOpen,
  onAccept,
  onImpediment,
  onTakeCustody,
  onChangeStatus,
  onChecklist,
  onEnRoute,
  onArrived,
  onConfigureGeofence,
  onEvidence,
  onReceptionAct,
  onDiagnosis,
  busyId,
  gps,
}) => {
  const action = isAdmin ? null : getActionState(service);
  const busy = busyId === service.id;

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(service)}
        className="w-full text-left p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {service.codigo_os || 'Orden de servicio'}
            </p>

            <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white break-words">
              {service.cliente_nombre || 'Cliente sin nombre'}
            </h2>

            {isAdmin && (
              <p className="mt-1 text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <UserRoundCog className="w-4 h-4 shrink-0" />
                <span className="truncate">{technicianName(service)}</span>
              </p>
            )}
          </div>

          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {STATUS_LABELS[service.estado] || service.estado}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-300 break-words">
              {fullClientAddress(service)}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <Clock3 className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-300">
              {service.fecha_agendada
                ? formatDateTime(service.fecha_agendada)
                : 'Sin fecha agendada'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {service.assignment_status && (
            <span className="rounded-lg px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {ASSIGNMENT_LABELS[service.assignment_status] ||
                service.assignment_status}
            </span>
          )}

          {service.has_custody && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Custodia activa
            </span>
          )}

          {service.reception_checklist_status && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {CHECKLIST_LABELS[service.reception_checklist_status] ||
                service.reception_checklist_status}
            </span>
          )}


          {Number(service.reception_evidence_count || 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <Camera className="w-3.5 h-3.5" />
              {service.reception_evidence_count} evidencia(s) inicial(es)
            </span>
          )}

          {service.reception_act_signed && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <PenLine className="w-3.5 h-3.5" />
              Acta firmada
            </span>
          )}

          {service.diagnosis_status && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              <FileText className="w-3.5 h-3.5" />
              Diagnóstico {service.diagnosis_status === 'confirmed' ? 'confirmado' : 'en borrador'}
            </span>
          )}
        </div>
      </button>

      {isAdmin && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={() => onConfigureGeofence(service)} className="min-h-11 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold px-4 flex items-center justify-center gap-2">
            <MapPin className="w-4 h-4" /> Punto del servicio
          </button>
          {service.reception_checklist_id && (
            <button type="button" onClick={() => onChecklist(service)} className="min-h-11 rounded-xl border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-semibold px-4 flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" /> Ver checklist
            </button>
          )}
          {Number(service.reception_evidence_count || 0) > 0 && (
            <button type="button" onClick={() => onEvidence(service, 'reception')} className="min-h-11 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-semibold px-4 flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" /> Evidencias iniciales
            </button>
          )}
          {service.reception_act_signed && (
            <button type="button" onClick={() => onReceptionAct(service)} className="min-h-11 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold px-4 flex items-center justify-center gap-2">
              <PenLine className="w-4 h-4" /> Acta de recibo
            </button>
          )}
          {(service.diagnosis_status || Number(service.diagnosis_evidence_count || 0) > 0) && (
            <button type="button" onClick={() => onDiagnosis(service)} className="min-h-11 rounded-xl border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-semibold px-4 flex items-center justify-center gap-2 sm:col-span-2">
              <FileText className="w-4 h-4" /> Diagnóstico / resultado
            </button>
          )}
        </div>
      )}

      {!isAdmin && ['asignada', 'en_ejecucion', 'en_espera'].includes(service.estado) && service.assignment_status === 'aceptada' && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => onEnRoute(service)} className="min-h-11 rounded-xl border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-semibold px-4">
            En camino
          </button>
          <button type="button" disabled={busy} onClick={() => onArrived(service)} className="min-h-11 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold px-4">
            Llegué al sitio
          </button>
        </div>
      )}


      {!isAdmin && ['en_ejecucion', 'en_espera'].includes(service.estado) && service.has_custody && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => onEvidence(service, 'diagnosis')} className="min-h-11 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-semibold px-4 flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" /> Evidencias diagnóstico
          </button>
          <button type="button" disabled={busy} onClick={() => onDiagnosis(service)} className="min-h-11 rounded-xl border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-semibold px-4 flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" /> Diagnóstico / resultado
          </button>
        </div>
      )}

      {action && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4">
          {action === 'respond_assignment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(service)}
                className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aceptar servicio
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => onImpediment(service)}
                className="min-h-11 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold px-4 flex items-center justify-center gap-2"
              >
                <TriangleAlert className="w-4 h-4" />
                Reportar impedimento
              </button>
            </div>
          )}

          {action === 'take_custody' && (
            <div className="space-y-2">
              {!gps?.valid_for_custody && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Para validar la custodia, habilita la ubicación precisa del dispositivo y espera unos segundos.
                </p>
              )}

              <button
                type="button"
                disabled={busy || !gps?.valid_for_custody}
                onClick={() => onTakeCustody(service)}
                className="w-full min-h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Tomar custodia del equipo
              </button>
            </div>
          )}

          {action === 'checklist' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChecklist(service)}
              className="w-full min-h-11 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Completar checklist de recepción
            </button>
          )}

          {action === 'reception_evidence' && (
            <button type="button" disabled={busy} onClick={() => onEvidence(service, 'reception')} className="w-full min-h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" /> Tomar evidencias iniciales
            </button>
          )}

          {action === 'sign_reception_act' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => onEvidence(service, 'reception')} className="min-h-11 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-semibold px-4 flex items-center justify-center gap-2">
                <Camera className="w-4 h-4" /> Revisar evidencias
              </button>
              <button type="button" disabled={busy} onClick={() => onReceptionAct(service)} className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2">
                <PenLine className="w-4 h-4" /> Firmar acta de recibo
              </button>
            </div>
          )}

          {action === 'start' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeStatus(service, 'en_ejecucion')}
              className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Iniciar servicio
            </button>
          )}

          {action === 'pause' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeStatus(service, 'en_espera')}
              className="w-full min-h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
            >
              <PauseCircle className="w-4 h-4" />
              Poner en espera
            </button>
          )}

          {action === 'resume' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeStatus(service, 'en_ejecucion')}
              className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Reanudar servicio
            </button>
          )}
        </div>
      )}
    </article>
  );
};

const ServiceDetailModal = ({ service, isAdmin, onClose }) => {
  useEffect(() => {
    if (!service) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
    };
  }, [service, onClose]);

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 sm:p-4 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
              {service.codigo_os}
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
              {service.cliente_nombre || 'Servicio'}
            </h3>
          </div>

          <button type="button" onClick={onClose} className="shrink-0 w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Cerrar detalle">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isAdmin && <Info label="Técnico" value={technicianName(service)} />}
            <Info label="Estado" value={STATUS_LABELS[service.estado] || service.estado} />
            <Info label="Asignación" value={ASSIGNMENT_LABELS[service.assignment_status] || service.assignment_status || 'Sin registro'} />
            <Info label="Checklist" value={CHECKLIST_LABELS[service.reception_checklist_status] || service.reception_checklist_status || 'Pendiente'} />
            <Info label="Fecha agendada" value={formatDateTime(service.fecha_agendada)} />
            <Info label="Custodia desde" value={formatDateTime(service.custody_since)} />
            <Info label="Teléfono cliente" value={service.cliente_telefono || '—'} />
          </div>

          <section className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Ubicación del cliente</h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 break-words">{fullClientAddress(service)}</p>
          </section>

          <section className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Descripción inicial</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 break-words">{service.descripcion_inicial || 'Sin descripción registrada.'}</p>
          </section>

          {service.impediment_reason && (
            <section className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4">
              <h4 className="font-semibold text-amber-800 dark:text-amber-300">Impedimento reportado</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm text-amber-700 dark:text-amber-300 break-words">{service.impediment_reason}</p>
            </section>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-32 min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">Cerrar</button>
        </footer>
      </section>
    </div>
  );
};

const ImpedimentModal = ({ service, value, onChange, onClose, onConfirm, busy }) => {
  useEffect(() => {
    if (!service) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [service]);

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-lg bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{service.codigo_os}</p>
            <h3 className="font-bold text-slate-900 dark:text-white">Reportar impedimento</h3>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">¿Qué te impide atender este servicio?</label>
          <textarea autoFocus rows={7} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Describe el impedimento..." className="mt-2 w-full resize-y min-h-40 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" />
          <p className="mt-2 text-xs text-slate-500">Mínimo 8 caracteres. El registro quedará disponible para la administración.</p>
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white dark:bg-slate-900">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy || value.trim().length < 8} className="min-h-11 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold">{busy ? 'Enviando...' : 'Confirmar impedimento'}</button>
        </footer>
      </section>
    </div>
  );
};

const ChecklistModal = ({ service, isAdmin, onClose, onRefresh }) => {
  const [form, setForm] = useState(emptyChecklist());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const readOnly = isAdmin || form.status === 'confirmed';

  useEffect(() => {
    if (!service) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [service]);

  useEffect(() => {
    if (!service?.id) return;

    let active = true;

    const loadChecklist = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get(
          `/api/service-orders/${service.id}/reception-checklist`
        );

        if (!active) return;

        setForm({
          ...emptyChecklist(),
          ...(response.data?.data || {}),
          condition_flags: response.data?.data?.condition_flags || {},
          accessories: response.data?.data?.accessories || {},
        });
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            'No fue posible cargar el checklist'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadChecklist();

    return () => {
      active = false;
    };
  }, [service?.id]);

  if (!service) return null;

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const toggleObjectField = (field, key) => {
    setForm((previous) => ({
      ...previous,
      [field]: {
        ...(previous[field] || {}),
        [key]: !previous[field]?.[key],
      },
    }));
  };

  const payload = () => ({
    equipment_type: form.equipment_type,
    brand: form.brand,
    model: form.model,
    serial_number: form.serial_number,
    received_from_name: form.received_from_name,
    received_from_document: form.received_from_document,
    condition_flags: form.condition_flags,
    accessories: form.accessories,
    accessories_other: form.accessories_other,
    observations: form.observations,
  });

  const saveDraft = async () => {
    try {
      setSaving(true);
      setError('');

      const response = await api.put(
        `/api/service-orders/${service.id}/reception-checklist`,
        payload()
      );

      setForm((previous) => ({
        ...previous,
        ...(response.data?.data || {}),
      }));

      await onRefresh?.();
      return response.data?.data;
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible guardar el checklist'
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmChecklist = async () => {
    const hasCondition = Object.values(
      form.condition_flags || {}
    ).some(Boolean);

    if (!form.equipment_type.trim()) {
      setError('Indica el tipo de equipo recibido.');
      return;
    }

    if (!form.received_from_name.trim()) {
      setError('Indica quién entrega el equipo.');
      return;
    }

    if (!hasCondition) {
      setError('Selecciona al menos una condición física.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await api.put(
        `/api/service-orders/${service.id}/reception-checklist`,
        payload()
      );

      const response = await api.post(
        `/api/service-orders/${service.id}/reception-checklist/confirm`
      );

      setForm((previous) => ({
        ...previous,
        ...(response.data?.data || {}),
      }));

      await onRefresh?.();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible confirmar la recepción'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">{service.codigo_os}</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Checklist de recepción</h3>
            {isAdmin && <p className="mt-1 text-xs text-slate-500">Técnico: {technicianName(service)}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-500">Cargando checklist...</div>
          ) : (
            <>
              {form.status === 'confirmed' && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex gap-2">
                  <BadgeCheck className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Recepción confirmada</p>
                    <p>{formatDateTime(form.confirmed_at)}</p>
                  </div>
                </div>
              )}

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white">Identificación del equipo</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Tipo de equipo *" value={form.equipment_type} onChange={(value) => setField('equipment_type', value)} disabled={readOnly} placeholder="Portátil, impresora, UPS..." />
                  <Field label="Marca" value={form.brand} onChange={(value) => setField('brand', value)} disabled={readOnly} />
                  <Field label="Modelo" value={form.model} onChange={(value) => setField('model', value)} disabled={readOnly} />
                  <Field label="Serial" value={form.serial_number} onChange={(value) => setField('serial_number', value)} disabled={readOnly} />
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white">Entrega del equipo</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Recibido de *" value={form.received_from_name} onChange={(value) => setField('received_from_name', value)} disabled={readOnly} placeholder="Nombre de quien entrega" />
                  <Field label="Documento / identificación" value={form.received_from_document} onChange={(value) => setField('received_from_document', value)} disabled={readOnly} />
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white">Condición física *</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {CONDITION_OPTIONS.map(([key, label]) => (
                    <CheckOption key={key} label={label} checked={Boolean(form.condition_flags?.[key])} disabled={readOnly} onChange={() => toggleObjectField('condition_flags', key)} />
                  ))}
                </div>
              </section>

              <section>
                <h4 className="font-bold text-slate-900 dark:text-white">Accesorios recibidos</h4>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ACCESSORY_OPTIONS.map(([key, label]) => (
                    <CheckOption key={key} label={label} checked={Boolean(form.accessories?.[key])} disabled={readOnly} onChange={() => toggleObjectField('accessories', key)} />
                  ))}
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Detalle de otros accesorios</label>
                  <textarea disabled={readOnly} value={form.accessories_other || ''} onChange={(event) => setField('accessories_other', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" />
                </div>
              </section>

              <section>
                <label className="block text-sm font-bold text-slate-900 dark:text-white">Observaciones de recepción</label>
                <textarea disabled={readOnly} value={form.observations || ''} onChange={(event) => setField('observations', event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" placeholder="Describe novedades, daños visibles, faltantes o detalles relevantes..." />
              </section>
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          {readOnly ? (
            <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-36 min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">Cerrar</button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Cancelar</button>
              <button type="button" onClick={saveDraft} disabled={saving || loading} className="min-h-11 rounded-xl border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-semibold flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Guardar borrador</button>
              <button type="button" onClick={confirmChecklist} disabled={saving || loading} className="min-h-11 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"><ClipboardCheck className="w-4 h-4" /> Confirmar recepción</button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
};

const Field = ({ label, value, onChange, disabled, placeholder = '' }) => (
  <label className="block min-w-0">
    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    <input type="text" disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" />
  </label>
);

const CheckOption = ({ label, checked, disabled, onChange }) => (
  <label className={`min-h-11 rounded-xl border px-3 py-2 flex items-center gap-3 ${checked ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'} ${disabled ? 'opacity-80' : 'cursor-pointer'}`}>
    <input type="checkbox" disabled={disabled} checked={checked} onChange={onChange} className="w-4 h-4 rounded" />
    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
  </label>
);

const useModalBodyLock = (enabled, onClose) => {
  useEffect(() => {
    if (!enabled) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
    };
  }, [enabled, onClose]);
};

const EvidenceThumbnail = ({ serviceId, evidenceId, alt }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadImage = async () => {
      try {
        const response = await api.get(
          `/api/service-orders/${serviceId}/evidences/${evidenceId}/file`,
          { responseType: 'blob' }
        );

        objectUrl = URL.createObjectURL(response.data);
        if (active) setSrc(objectUrl);
      } catch {
        if (active) setSrc('');
      }
    };

    loadImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceId, serviceId]);

  if (!src) {
    return (
      <div className="aspect-[4/3] rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500">
        Cargando imagen...
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Evidencia del servicio'}
      className="aspect-[4/3] w-full rounded-xl object-cover bg-slate-100 dark:bg-slate-800"
    />
  );
};

const EvidenceModal = ({ context, isAdmin, onClose, onRefresh }) => {
  const service = context?.service || null;
  const stage = context?.stage || 'reception';
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useModalBodyLock(Boolean(service), onClose);

  const readOnly = isAdmin || (
    stage === 'reception'
      ? Boolean(service?.reception_act_signed)
      : service?.diagnosis_status === 'confirmed'
  );

  const load = useCallback(async () => {
    if (!service) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(
        `/api/service-orders/${service.id}/evidences`,
        { params: { stage } }
      );
      setItems(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar las evidencias');
    } finally {
      setLoading(false);
    }
  }, [service, stage]);

  useEffect(() => {
    if (!service) return undefined;
    load();
    return undefined;
  }, [load, service]);

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !service) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Usa una imagen JPG, PNG o WEBP.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('La imagen supera 8 MB. Usa una fotografía más liviana.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      await api.post(
        `/api/service-orders/${service.id}/evidences`,
        file,
        {
          params: {
            stage,
            category: stage === 'reception' ? 'estado_inicial' : 'diagnostico_resultado',
            name: file.name,
            note: note.trim() || undefined,
            captured_at: file.lastModified
              ? new Date(file.lastModified).toISOString()
              : new Date().toISOString(),
          },
          headers: { 'Content-Type': file.type },
        }
      );

      setNote('');
      await load();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar la fotografía');
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = async (evidence) => {
    if (!service || !window.confirm('¿Retirar esta evidencia antes de confirmar la etapa?')) return;

    try {
      setError('');
      await api.delete(`/api/service-orders/${service.id}/evidences/${evidence.id}`);
      await load();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible retirar la evidencia');
    }
  };

  if (!service) return null;

  const title = stage === 'reception' ? 'Evidencias iniciales' : 'Evidencias de diagnóstico';

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 p-4 sm:px-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">{service.codigo_os}</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {stage === 'reception'
                ? 'Fotografía el estado físico, accesorios y daños existentes antes de intervenir el equipo.'
                : 'Documenta el diagnóstico, las pruebas o el funcionamiento obtenido.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {!readOnly && (
            <section className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50/60 dark:bg-cyan-950/20 p-4 space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Nota de la evidencia</label>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Golpe en esquina izquierda, cargador recibido..." className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3" />
              </div>

              <label className={`min-h-12 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 flex items-center justify-center gap-2 ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                <Camera className="w-5 h-5" />
                {uploading ? 'Cargando fotografía...' : 'Tomar foto / elegir imagen'}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={uploadFile} className="sr-only" disabled={uploading} />
              </label>

              <p className="text-xs text-slate-500">Máximo 8 MB por imagen. La evidencia queda asociada a la orden y al técnico.</p>
            </section>
          )}

          {readOnly && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300">
              Esta etapa ya está en modo consulta. Las evidencias confirmadas no pueden alterarse desde el flujo técnico.
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-500">Cargando evidencias...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
              Todavía no hay fotografías en esta etapa.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950/30">
                  <EvidenceThumbnail serviceId={service.id} evidenceId={item.id} alt={item.note || item.original_name} />
                  <div className="mt-3 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{item.note || item.original_name || 'Evidencia'}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.captured_at || item.created_at)}</p>
                    {!readOnly && (
                      <button type="button" onClick={() => removeEvidence(item)} className="mt-3 min-h-10 w-full rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold flex items-center justify-center gap-2">
                        <Trash2 className="w-4 h-4" /> Retirar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-36 min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">Cerrar</button>
        </footer>
      </section>
    </div>
  );
};

const SignatureCanvas = ({ onReady, clearToken = 0 }) => {
  const canvasRef = React.useRef(null);
  const drawingRef = React.useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    };

    resize();
    onReady?.(canvas, hasInk);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, [clearToken]);

  useEffect(() => {
    onReady?.(canvasRef.current, hasInk);
  }, [hasInk, onReady]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event) => {
    event.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const stop = (event) => {
    if (event) event.preventDefault();
    drawingRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      className="w-full h-44 sm:h-52 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white touch-none"
      style={{ touchAction: 'none' }}
    />
  );
};

const ReceptionActModal = ({ service, isAdmin, onClose, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [canvas, setCanvas] = useState(null);
  const [hasInk, setHasInk] = useState(false);
  const [clearToken, setClearToken] = useState(0);
  const [signatureUrl, setSignatureUrl] = useState('');

  useModalBodyLock(Boolean(service), onClose);

  const load = useCallback(async () => {
    if (!service) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/service-orders/${service.id}/reception-act`);
      setData(response.data);
      const act = response.data?.data;
      const checklist = response.data?.checklist;
      setName(act?.signed_by_name || checklist?.received_from_name || service.cliente_nombre || '');
      setDocument(act?.signed_by_document || checklist?.received_from_document || service.cliente_documento || '');

      if (act) {
        const signature = await api.get(`/api/service-orders/${service.id}/reception-act/signature`, { responseType: 'blob' });
        setSignatureUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(signature.data);
        });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar el acta');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (!service) return undefined;
    load();
    return () => {
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    };
  }, [load, service]); // signatureUrl se revoca al reemplazar/cerrar por setState

  const handleCanvasReady = useCallback((canvasNode, ink) => {
    setCanvas(canvasNode || null);
    setHasInk(Boolean(ink));
  }, []);

  const sign = async () => {
    if (!service || !canvas) return;
    if (!name.trim()) {
      setError('Indica el nombre de la persona que firma.');
      return;
    }
    if (!accepted) {
      setError('Debes confirmar que la persona acepta las condiciones registradas.');
      return;
    }
    if (!hasInk) {
      setError('Solicita la firma en el recuadro antes de continuar.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No fue posible generar la firma');

      await api.post(
        `/api/service-orders/${service.id}/reception-act/sign`,
        blob,
        {
          params: {
            signed_by_name: name.trim(),
            signed_by_document: document.trim() || undefined,
          },
          headers: { 'Content-Type': 'image/png' },
        }
      );

      await load();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'No fue posible firmar el acta');
    } finally {
      setSaving(false);
    }
  };

  if (!service) return null;

  const act = data?.data || null;
  const checklist = data?.checklist || null;
  const canSign = !isAdmin && !act && checklist?.status === 'confirmed' && Number(data?.reception_evidence_count || 0) > 0;

  return (
    <div className="fixed inset-0 z-[105] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 p-4 sm:px-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{service.codigo_os}</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Acta de recibo</h3>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {loading ? (
            <div className="py-16 text-center text-slate-500">Cargando acta...</div>
          ) : act ? (
            <>
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">Acta firmada y bloqueada</p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Firmó: {act.signed_by_name}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Documento: {act.signed_by_document || 'No registrado'}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Fecha: {formatDateTime(act.signed_at)}</p>
              </div>
              {signatureUrl && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Firma registrada</p>
                  <img src={signatureUrl} alt="Firma del acta de recibo" className="w-full max-w-xl h-44 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-white" />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Info label="Equipo" value={[checklist?.equipment_type, checklist?.brand, checklist?.model].filter(Boolean).join(' · ')} />
                <Info label="Serial" value={checklist?.serial_number} />
                <Info label="Checklist" value={checklist?.status === 'confirmed' ? 'Confirmado' : 'Pendiente'} />
                <Info label="Evidencias iniciales" value={`${Number(data?.reception_evidence_count || 0)} fotografía(s)`} />
              </div>

              {!canSign && !isAdmin && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
                  Para firmar el acta primero debe existir checklist confirmado y al menos una evidencia fotográfica inicial.
                </div>
              )}

              {isAdmin && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300">El acta todavía no ha sido firmada por el cliente/persona que entrega.</div>
              )}

              {canSign && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre de quien firma *" value={name} onChange={setName} disabled={false} />
                    <Field label="Documento / identificación" value={document} onChange={setDocument} disabled={false} />
                  </div>

                  <label className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 w-4 h-4" />
                    <span className="text-sm text-slate-700 dark:text-slate-200">La persona que firma confirma que revisó y acepta las condiciones de recepción, accesorios, estado físico y evidencias registradas para esta orden.</span>
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Firma en pantalla *</p>
                      <button type="button" onClick={() => setClearToken((value) => value + 1)} className="text-xs font-semibold text-blue-600 dark:text-blue-400">Limpiar firma</button>
                    </div>
                    <SignatureCanvas onReady={handleCanvasReady} clearToken={clearToken} />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          {canSign ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Cancelar</button>
              <button type="button" onClick={sign} disabled={saving} className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"><PenLine className="w-4 h-4" /> {saving ? 'Firmando...' : 'Confirmar y firmar acta'}</button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-36 min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">Cerrar</button>
          )}
        </footer>
      </section>
    </div>
  );
};

const emptyDiagnosis = () => ({
  work_type: 'diagnostico',
  result_status: '',
  description: '',
  solution_available: '',
  approximate_cost: '',
  required_components: '',
  functional_result: '',
  activities_performed: '',
  status: 'draft',
});

const DiagnosisModal = ({ service, isAdmin, onClose, onEvidence, onRefresh }) => {
  const [form, setForm] = useState(emptyDiagnosis());
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useModalBodyLock(Boolean(service), onClose);

  const load = useCallback(async () => {
    if (!service) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/service-orders/${service.id}/diagnosis`);
      setForm({ ...emptyDiagnosis(), ...(response.data?.data || {}) });
      setEvidenceCount(Number(response.data?.diagnosis_evidence_count || 0));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar el diagnóstico');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (!service) return undefined;
    load();
    return undefined;
  }, [load, service]);

  const readOnly = isAdmin || form.status === 'confirmed';
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const payload = () => ({
    work_type: form.work_type,
    result_status: form.result_status || null,
    description: form.description,
    solution_available:
      form.solution_available === ''
        ? null
        : form.solution_available === 'true',
    approximate_cost: form.approximate_cost === '' ? null : Number(form.approximate_cost),
    required_components: form.required_components,
    functional_result: form.functional_result,
    activities_performed: form.activities_performed,
  });

  const save = async () => {
    if (!service) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/api/service-orders/${service.id}/diagnosis`, payload());
      await load();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible guardar el diagnóstico');
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!service) return;
    try {
      setSaving(true);
      setError('');
      await api.put(`/api/service-orders/${service.id}/diagnosis`, payload());
      await api.post(`/api/service-orders/${service.id}/diagnosis/confirm`);
      await load();
      onRefresh?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible confirmar el diagnóstico');
    } finally {
      setSaving(false);
    }
  };

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 p-4 sm:px-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{service.codigo_os}</p>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Diagnóstico y resultado</h3>
            {isAdmin && <p className="mt-1 text-xs text-slate-500">Técnico: {technicianName(service)}</p>}
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {error && <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {loading ? (
            <div className="py-16 text-center text-slate-500">Cargando diagnóstico...</div>
          ) : (
            <>
              {form.status === 'confirmed' && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  Diagnóstico confirmado el {formatDateTime(form.confirmed_at)}. La información quedó bloqueada para mantener trazabilidad.
                </div>
              )}

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Tipo de registro *</span>
                <select disabled={readOnly} value={form.work_type || 'diagnostico'} onChange={(event) => setField('work_type', event.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3">
                  <option value="diagnostico">Revisión técnica de diagnóstico</option>
                  <option value="servicio_especifico">Servicio técnico específico</option>
                </select>
              </label>

              {form.work_type === 'diagnostico' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Resultado *</span>
                    <select disabled={readOnly} value={form.result_status || ''} onChange={(event) => setField('result_status', event.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3">
                      <option value="">Seleccionar...</option>
                      <option value="positivo">Positivo</option>
                      <option value="negativo">Negativo</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">¿Tiene solución?</span>
                    <select disabled={readOnly} value={form.solution_available === true ? 'true' : form.solution_available === false ? 'false' : form.solution_available || ''} onChange={(event) => setField('solution_available', event.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3">
                      <option value="">Por definir</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Descripción del trabajo / diagnóstico *</span>
                <textarea disabled={readOnly} value={form.description || ''} onChange={(event) => setField('description', event.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" placeholder="Describe hallazgos, resultado y condición del equipo..." />
              </label>

              <label className="block">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Actividades realizadas</span>
                <textarea disabled={readOnly} value={form.activities_performed || ''} onChange={(event) => setField('activities_performed', event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" />
              </label>

              {form.work_type === 'diagnostico' && String(form.solution_available) === 'true' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Costo aproximado de reparación *</span>
                    <input type="number" min="0" step="1000" disabled={readOnly} value={form.approximate_cost ?? ''} onChange={(event) => setField('approximate_cost', event.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Componentes / repuestos requeridos *</span>
                    <textarea disabled={readOnly} value={form.required_components || ''} onChange={(event) => setField('required_components', event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" />
                  </label>
                </div>
              )}

              {form.work_type === 'servicio_especifico' && (
                <label className="block">
                  <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Funcionamiento / condición de entrega *</span>
                  <textarea disabled={readOnly} value={form.functional_result || ''} onChange={(event) => setField('functional_result', event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white disabled:bg-slate-100 dark:bg-slate-950 dark:disabled:bg-slate-800 px-3 py-2" placeholder="Describe cómo queda funcionando el equipo..." />
                </label>
              )}

              <button type="button" onClick={() => onEvidence(service, 'diagnosis')} className="w-full min-h-12 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-semibold flex items-center justify-center gap-2">
                <Camera className="w-5 h-5" /> Ver / cargar evidencias ({evidenceCount})
              </button>
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          {readOnly ? (
            <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-36 min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">Cerrar</button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Cancelar</button>
              <button type="button" onClick={save} disabled={saving || loading} className="min-h-11 rounded-xl border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-semibold flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Guardar borrador</button>
              <button type="button" onClick={confirm} disabled={saving || loading} className="min-h-11 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Confirmar diagnóstico</button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
};


export default function MisServicios() {
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [gps, setGps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('activos');
  const [technicianFilter, setTechnicianFilter] = useState('todos');
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [checklistService, setChecklistService] = useState(null);
  const [evidenceContext, setEvidenceContext] = useState(null);
  const [receptionActService, setReceptionActService] = useState(null);
  const [diagnosisService, setDiagnosisService] = useState(null);
  const [impedimentService, setImpedimentService] = useState(null);
  const [impedimentReason, setImpedimentReason] = useState('');

  const role = user?.role?.name || user?.rol;
  const isTechnician = role === 'tecnico';
  const isAdmin = role === 'admin';
  const canOpenModule = isTechnician || isAdmin;

  const load = useCallback(async (silent = false) => {
    if (!canOpenModule) return;

    try {
      if (!silent) setLoading(true);
      setError('');

      const response = await api.get(
        isAdmin
          ? '/api/service-orders/work-board'
          : '/api/service-orders/my-work'
      );

      setServices(
        Array.isArray(response.data?.data)
          ? response.data.data
          : []
      );

      if (isAdmin) {
        const techResponse = await api.get(
          '/api/service-orders/work-board/technicians'
        );

        setTechnicians(
          Array.isArray(techResponse.data?.data)
            ? techResponse.data.data
            : []
        );
      } else {
        setGps(response.data?.gps || null);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar los servicios'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canOpenModule, isAdmin]);

  useEffect(() => {
    load();

    if (!canOpenModule) return undefined;

    const timer = window.setInterval(() => {
      load(true);
    }, 20_000);

    return () => window.clearInterval(timer);
  }, [canOpenModule, load]);

  const filteredTechnicians = useMemo(() => {
    if (!isAdmin) return [];

    const term = normalizeSearch(technicianSearch);

    return technicians.filter((tech) => {
      if (!term) return true;

      const haystack = normalizeSearch([
        directoryTechnicianName(tech),
        tech.usuario,
        tech.cedula,
        tech.celular,
        tech.email,
      ].filter(Boolean).join(' '));

      return haystack.includes(term);
    });
  }, [isAdmin, technicianSearch, technicians]);

  const selectedTechnician = useMemo(
    () => technicians.find((tech) => tech.id === technicianFilter) || null,
    [technicianFilter, technicians]
  );

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesTech =
        !isAdmin ||
        technicianFilter === 'todos' ||
        service.tecnico_id === technicianFilter;

      if (!matchesTech) return false;

      if (filter === 'todos') return true;
      if (filter === 'pendientes') return service.estado === 'asignada';
      if (filter === 'ejecucion') return service.estado === 'en_ejecucion';
      if (filter === 'espera') return service.estado === 'en_espera';
      if (filter === 'checklist') {
        return (
          service.has_custody &&
          !service.reception_checklist_confirmed
        );
      }
      if (filter === 'activos') {
        return !['cerrada', 'cancelado', 'rechazado'].includes(
          service.estado
        );
      }

      return true;
    });
  }, [filter, isAdmin, services, technicianFilter]);

  const runAction = async (service, callback) => {
    try {
      setBusyId(service.id);
      setError('');
      await callback();
      await load(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible completar la acción'
      );
    } finally {
      setBusyId('');
    }
  };

  const accept = (service) =>
    runAction(service, () =>
      api.post(`/api/service-orders/${service.id}/assignment/accept`)
    );

  const takeCustody = (service) =>
    runAction(service, () =>
      api.post(`/api/service-orders/${service.id}/custody/take`)
    );

  const changeStatus = (service, estado) =>
    runAction(service, () =>
      api.patch(`/api/service-orders/${service.id}/status`, {
        estado,
      })
    );

  const markEnRoute = (service) =>
    runAction(service, () =>
      api.post(`/api/service-orders/${service.id}/visit/en-route`)
    );

  const markArrived = (service) =>
    runAction(service, () =>
      api.post(`/api/service-orders/${service.id}/visit/arrived`)
    );

  const configureGeofence = async (service) => {
    try {
      const current = await api.get(`/api/service-orders/${service.id}/geofence`);
      const existing = current.data?.data || {};
      const latitude = window.prompt('Latitud del punto del servicio', existing.latitude ?? '');
      if (latitude === null) return;
      const longitude = window.prompt('Longitud del punto del servicio', existing.longitude ?? '');
      if (longitude === null) return;
      const radius = window.prompt('Radio permitido en metros (recomendado 150)', existing.radius_m ?? '150');
      if (radius === null) return;
      await api.put(`/api/service-orders/${service.id}/geofence`, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_m: Number(radius),
      });
      window.alert('Punto del servicio guardado.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible configurar el punto del servicio');
    }
  };

  const manageTechnicianDevices = async (tech) => {
    try {
      const response = await api.get(`/api/service-orders/work-board/technicians/${tech.id}/devices`);
      const devices = Array.isArray(response.data?.data) ? response.data.data : [];
      if (devices.length === 0) {
        window.alert('Este técnico todavía no ha registrado un dispositivo.');
        return;
      }
      const pending = devices.find((item) => item.trust_status === 'pending');
      const summary = devices.map((item, index) => `${index + 1}. ${item.platform || 'Dispositivo'} · ${item.trust_status}`).join('\n');
      if (!pending) {
        window.alert(`Dispositivos registrados:

${summary}`);
        return;
      }
      const approve = window.confirm(`Dispositivos registrados:

${summary}

Hay un dispositivo pendiente. ¿Autorizarlo?`);
      if (!approve) return;
      await api.post(`/api/service-orders/work-board/technicians/${tech.id}/devices/${pending.id}/approve`);
      window.alert('Dispositivo autorizado.');
      await load(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible gestionar dispositivos');
    }
  };

  const openEvidence = (service, stage) => {
    setEvidenceContext({ service, stage });
  };

  const confirmImpediment = async () => {
    if (!impedimentService) return;

    await runAction(impedimentService, () =>
      api.post(
        `/api/service-orders/${impedimentService.id}/assignment/impediment`,
        { reason: impedimentReason }
      )
    );

    setImpedimentService(null);
    setImpedimentReason('');
  };

  if (!canOpenModule) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 text-amber-800 dark:text-amber-300">
        Este módulo está disponible para administración y personal técnico.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isAdmin ? 'Operación técnica' : 'Mis servicios'}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isAdmin
              ? 'Consulta en qué orden está cada técnico y el avance operativo de la atención.'
              : 'Órdenes asignadas a tu cuenta y acciones pendientes.'}
          </p>
        </div>

        <button type="button" onClick={() => load()} className="w-full sm:w-auto min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 px-4 font-semibold flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
        <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : ''} gap-3`}>
          {isAdmin && (
            <div className="sm:col-span-2 space-y-3 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={technicianSearch}
                  onChange={(event) => setTechnicianSearch(event.target.value)}
                  placeholder="Buscar técnico por nombre, usuario, cédula, celular o correo..."
                  className="w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3 text-sm"
                />
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                  <span>{technicians.length} técnico(s) registrados en la base de datos</span>
                  {selectedTechnician && (
                    <button type="button" onClick={() => setTechnicianFilter('todos')} className="font-semibold text-blue-600 dark:text-blue-400">
                      Quitar filtro
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto overscroll-contain p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <button
                    type="button"
                    onClick={() => setTechnicianFilter('todos')}
                    className={`min-h-14 text-left rounded-xl border px-3 py-2 transition-colors ${technicianFilter === 'todos' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-sm">Todos los técnicos</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Ver toda la operación técnica</p>
                  </button>

                  {filteredTechnicians.map((tech) => {
                    const badge = integrityBadge(tech);
                    const selected = technicianFilter === tech.id;

                    return (
                      <div
                        key={tech.id}
                        className={`min-h-14 text-left rounded-xl border px-3 py-2 transition-colors ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        <button type="button" onClick={() => setTechnicianFilter(tech.id)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{directoryTechnicianName(tech)}</p>
                            <p className="text-xs text-slate-500 truncate">@{tech.usuario || 'sin-usuario'} · {tech.activo === false ? 'Inactivo' : 'Activo'}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold">
                            {Number(tech.active_service_count || 0)} OS
                          </span>
                        </div>
                        <p className={`mt-1 text-[11px] ${badge.cls}`}>
                          {badge.label}
                          {tech.location_accuracy_m ? ` · ±${Math.round(Number(tech.location_accuracy_m))} m` : ''}
                        </p>
                        </button>
                        <button type="button" onClick={() => manageTechnicianDevices(tech)} className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 underline underline-offset-2">
                          Dispositivos de ubicación
                        </button>
                      </div>
                    );
                  })}

                  {filteredTechnicians.length === 0 && (
                    <div className="md:col-span-2 xl:col-span-3 p-6 text-center text-sm text-slate-500">
                      No hay técnicos que coincidan con la búsqueda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3">
            <option value="activos">Servicios activos</option>
            <option value="pendientes">Pendientes de atención</option>
            <option value="checklist">Pendientes de checklist</option>
            <option value="ejecucion">En ejecución</option>
            <option value="espera">En espera</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Cargando servicios...</div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-16 px-4 text-center">
          <ClipboardCheck className="w-10 h-10 mx-auto text-slate-400" />
          <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">No hay servicios para este filtro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isAdmin={isAdmin}
              onOpen={setSelectedService}
              onAccept={accept}
              onImpediment={(item) => {
                setImpedimentService(item);
                setImpedimentReason('');
              }}
              onTakeCustody={takeCustody}
              onChangeStatus={changeStatus}
              onChecklist={setChecklistService}
              onEnRoute={markEnRoute}
              onArrived={markArrived}
              onConfigureGeofence={configureGeofence}
              onEvidence={openEvidence}
              onReceptionAct={setReceptionActService}
              onDiagnosis={setDiagnosisService}
              busyId={busyId}
              gps={gps}
            />
          ))}
        </div>
      )}

      <ServiceDetailModal service={selectedService} isAdmin={isAdmin} onClose={() => setSelectedService(null)} />

      <ImpedimentModal service={impedimentService} value={impedimentReason} onChange={setImpedimentReason} onClose={() => { setImpedimentService(null); setImpedimentReason(''); }} onConfirm={confirmImpediment} busy={Boolean(busyId)} />

      <ChecklistModal service={checklistService} isAdmin={isAdmin} onClose={() => setChecklistService(null)} onRefresh={() => load(true)} />

      <EvidenceModal
        context={evidenceContext}
        isAdmin={isAdmin}
        onClose={() => setEvidenceContext(null)}
        onRefresh={() => load(true)}
      />

      <ReceptionActModal
        service={receptionActService}
        isAdmin={isAdmin}
        onClose={() => setReceptionActService(null)}
        onRefresh={() => load(true)}
      />

      <DiagnosisModal
        service={diagnosisService}
        isAdmin={isAdmin}
        onClose={() => setDiagnosisService(null)}
        onEvidence={openEvidence}
        onRefresh={() => load(true)}
      />
    </div>
  );
}
