import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ShieldCheck,
  UserRound,
  Wrench,
  UsersRound,
  UserCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import api from '../../../services/api';

const DEFAULT_CONDITIONS =
  'El cliente fue informado del alcance inicial del servicio, tiempos estimados, posibles costos adicionales y de que cualquier reparación o repuesto adicional requerirá autorización previa.';

const DEFAULT_ADDITIONAL_NOTICE =
  'Los valores adicionales que surjan del diagnóstico no serán ejecutados sin autorización del cliente.';

function clientName(client) {
  if (!client) return '';
  if (client.tipo_persona === 'juridica') {
    return client.razon_social || 'Cliente';
  }
  return (
    [client.primer_nombre, client.primer_apellido].filter(Boolean).join(' ') ||
    'Cliente'
  );
}

function money(value) {
  if (value === '' || value === null || value === undefined) return '';
  return Number(value).toLocaleString('es-CO');
}

const steps = [
  ['Solicitud', UserRound],
  ['Clasificación', Wrench],
  ['Condiciones', ClipboardList],
  ['Aceptación', ShieldCheck],
  ['Equipo técnico', UsersRound],
  ['Facturación', CreditCard],
];

export default function ServicioCreateWizard({
  isOpen,
  onClose,
  onCreated,
  userRole = 'usuario',
}) {
  const isAdmin = userRole === 'admin';
  const [step, setStep] = useState(0);
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [types, setTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [primaryTechnicianId, setPrimaryTechnicianId] = useState('');
  const [supportTechnicianIds, setSupportTechnicianIds] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [schedulingMode, setSchedulingMode] = useState('auto');

  const [form, setForm] = useState({
    request_description: '',
    classification: 'diagnostic',
    service_type_id: '',
    service_type_name: '',
    service_type_category: '',
    base_value: '',
    estimated_minutes: 60,
    scope_text: '',
    conditions_text: DEFAULT_CONDITIONS,
    additional_costs_notice: DEFAULT_ADDITIONAL_NOTICE,
    client_acceptance: false,
    client_acceptance_name: '',
    client_acceptance_document: '',
    client_acceptance_channel: 'whatsapp',
    client_acceptance_reference: '',
    billing_mode: 'prepaid',
    invoice_reference: '',
    postpaid_reason: '',
    priority: 'normal',
    estimated_duration: 60,
    scheduled_date: '',
    scheduled_time: '09:00',
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    api
      .get('/api/tipos-servicio')
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setTypes(rows.filter((item) => item.activo !== false));
      })
      .catch(() => setTypes([]));

    if (isAdmin) {
      api
        .get('/api/usuarios/role/tecnico')
        .then((response) => {
          const rows = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];
          setTechnicians(rows.filter((item) => item.activo !== false));
        })
        .catch(() => setTechnicians([]));
    }

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(async () => {
      const q = clientQuery.trim();
      if (q.length < 2) {
        setClients([]);
        return;
      }

      try {
        setLoadingClients(true);
        const response = await api.get('/api/clients/search', {
          params: { q },
        });
        setClients(Array.isArray(response.data) ? response.data : []);
      } catch {
        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [clientQuery, isOpen]);

  const selectedType = useMemo(
    () => types.find((item) => String(item.id) === String(form.service_type_id)),
    [types, form.service_type_id]
  );

  const filteredTechnicians = useMemo(() => {
    const term = technicianSearch.trim().toLowerCase();
    if (!term) return technicians;
    return technicians.filter((item) => {
      const name = [
        item.nombre1,
        item.nombre2,
        item.apellidos,
        item.usuario,
        item.cedula,
        item.celular,
        item.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return name.includes(term);
    });
  }, [technicianSearch, technicians]);

  const selectedPrimary = useMemo(
    () => technicians.find((item) => item.id === primaryTechnicianId) || null,
    [technicians, primaryTechnicianId]
  );

  const update = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const chooseType = (id) => {
    const type = types.find((item) => String(item.id) === String(id));
    setForm((previous) => ({
      ...previous,
      service_type_id: id,
      service_type_name: type?.nombre || '',
      service_type_category: type?.categoria || '',
      base_value: previous.base_value !== '' ? previous.base_value : type?.valor_base ?? '',
      estimated_minutes: type?.duracion_estimada || previous.estimated_minutes || 60,
      estimated_duration: type?.duracion_estimada || previous.estimated_duration || 60,
      scope_text: previous.scope_text || type?.descripcion || '',
      classification: type?.requiere_diagnostico ? 'diagnostic' : previous.classification,
    }));
  };

  const validateStep = () => {
    setError('');

    if (step === 0) {
      if (!selectedClient) return 'Selecciona el cliente.';
      if (!form.request_description.trim()) {
        return 'Describe la necesidad o solicitud del cliente.';
      }
    }

    if (step === 1) {
      if (!form.classification) return 'Selecciona la clasificación.';
      if (!form.service_type_name.trim()) {
        return 'Selecciona un tipo de servicio.';
      }
    }

    if (step === 2) {
      if (!form.scope_text.trim()) return 'Define el alcance inicial.';
      if (!form.conditions_text.trim()) {
        return 'Registra las condiciones informadas al cliente.';
      }
    }

    if (step === 3) {
      if (!form.client_acceptance) {
        return 'Debes registrar la aceptación inicial del cliente.';
      }
      if (!form.client_acceptance_name.trim()) {
        return 'Registra el nombre de quien acepta.';
      }
      if (!form.client_acceptance_channel) {
        return 'Selecciona el canal de aceptación.';
      }
    }

    if (step === 4) {
      if (isAdmin && !primaryTechnicianId) {
        return 'Selecciona el técnico responsable principal.';
      }
      // Validar fecha si es modo automático
      if (schedulingMode === 'auto' && !form.scheduled_date) {
        return 'Para programación automática, selecciona una fecha.';
      }
    }

    if (step === 5 && form.billing_mode === 'prepaid') {
      if (!form.invoice_reference.trim()) {
        return 'Registra la referencia de factura.';
      }
      if (isAdmin && paymentVerified && !paymentReference.trim()) {
        return 'Registra la referencia o soporte del pago.';
      }
    }

    if (step === 5 && form.billing_mode === 'postpaid') {
      if (!isAdmin) return 'Solo administración puede autorizar pospago.';
      if (!form.postpaid_reason.trim()) {
        return 'Indica por qué este servicio se manejará como pospago.';
      }
    }

    return null;
  };

  const goNext = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const submit = async () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }

    try {
      setSaving(true);
      setError('');

      const createResponse = await api.post('/api/service-orders/intakes', {
        client_id: selectedClient.id,
        client_origin: selectedClient.origen || 'local',
        client_external_id: selectedClient.id_externo || null,
        client_key: selectedClient.cliente_key || null,
        client_snapshot: {
          id: selectedClient.id,
          id_externo: selectedClient.id_externo || null,
          origen: selectedClient.origen || 'local',
          tipo_persona: selectedClient.tipo_persona || null,
          documento: selectedClient.documento || null,
          razon_social: selectedClient.razon_social || null,
          primer_nombre: selectedClient.primer_nombre || null,
          segundo_nombre: selectedClient.segundo_nombre || null,
          primer_apellido: selectedClient.primer_apellido || null,
          segundo_apellido: selectedClient.segundo_apellido || null,
          telefono: selectedClient.telefono || null,
          email: selectedClient.email || null,
          direccion: selectedClient.direccion || null,
          ciudad: selectedClient.ciudad || null,
        },
        source_type: isAdmin ? 'customer' : 'technician',
        created_from_technician: !isAdmin,
        ...form,
        // Si es modo manual, no enviar fecha
        scheduled_date: schedulingMode === 'auto' ? form.scheduled_date : null,
        scheduled_time: schedulingMode === 'auto' ? form.scheduled_time : null,
        scheduling_mode: schedulingMode,
        team: isAdmin
          ? [
              ...(primaryTechnicianId
                ? [
                    {
                      technician_id: primaryTechnicianId,
                      member_role: 'primary',
                    },
                  ]
                : []),
              ...supportTechnicianIds.map((technicianId) => ({
                technician_id: technicianId,
                member_role: 'support',
              })),
            ]
          : [],
        base_value: form.base_value === '' ? null : Number(form.base_value),
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        estimated_duration: form.estimated_duration ? Number(form.estimated_duration) : null,
      });

      const intake = createResponse.data?.data;

      if (!intake?.id) {
        throw new Error('No se recibió el ID de la solicitud');
      }

      if (isAdmin && form.billing_mode === 'prepaid' && paymentVerified) {
        await api.post(`/api/service-orders/intakes/${intake.id}/verify-payment`, {
          invoice_reference: form.invoice_reference,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
        });
      }

      if (isAdmin) {
        try {
          const activateResponse = await api.post(
            `/api/service-orders/intakes/${intake.id}/activate`
          );

          const order = activateResponse.data?.data || null;

          if (order?.id && primaryTechnicianId) {
            await api.patch(`/api/service-orders/${order.id}/approve`, {
              observaciones: 'Creada y asignada desde el flujo controlado V10',
            });
          }
        } catch (activateError) {
          if (activateError.response?.data?.code !== 'INTAKE_NOT_READY') {
            throw activateError;
          }

          const missing = activateError.response?.data?.missing || [];
          setError(
            `Solicitud guardada, pero aún no puede crear la OS. Falta: ${missing.join(
              ', '
            )}`
          );
          await onCreated?.();
          return;
        }
      }

      await onCreated?.();
      onClose();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'No fue posible registrar el servicio'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Creación controlada de servicio
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Nueva Orden de Servicio
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Solicitud → clasificación → condiciones → aceptación → facturación.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          <div className="min-w-max px-4 sm:px-6 py-3 flex gap-2">
            {steps.map(([label, Icon], index) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold ${
                  index === step
                    ? 'bg-blue-600 text-white'
                    : index < step
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold">Buscar cliente *</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Nombre, documento o teléfono"
                    className="w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3"
                  />
                </div>

                {selectedClient && (
                  <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <p className="font-semibold">{clientName(selectedClient)}</p>
                    <p className="text-sm text-gray-500">
                      {selectedClient.documento || 'Sin documento'} ·{' '}
                      {selectedClient.telefono || 'Sin teléfono'}
                    </p>
                  </div>
                )}

                {!selectedClient && (
                  <div className="mt-2 space-y-2">
                    {loadingClients && (
                      <p className="text-sm text-gray-500">Buscando...</p>
                    )}
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(client);
                          setClientQuery(clientName(client));
                          setClients([]);
                        }}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="font-semibold block">
                          {clientName(client)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {client.documento || 'Sin documento'} ·{' '}
                          {client.telefono || 'Sin teléfono'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-semibold">
                  ¿Qué necesita el cliente? *
                </span>
                <textarea
                  rows={5}
                  value={form.request_description}
                  onChange={(event) =>
                    update('request_description', event.target.value)
                  }
                  placeholder="Ej: Portátil no enciende. Cliente solicita revisión y diagnóstico..."
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">Prioridad</span>
                  <select
                    value={form.priority}
                    onChange={(event) => update('priority', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>

                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    Fecha y hora automáticas
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-300/80 mt-1">
                    El sistema buscará el primer espacio común disponible de todos los técnicos seleccionados y bloqueará la agenda por la duración estimada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => update('classification', 'diagnostic')}
                  className={`min-h-24 rounded-2xl border p-4 text-left ${
                    form.classification === 'diagnostic'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <p className="font-bold">Revisión / diagnóstico</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Se determina la falla y posteriormente puede requerir
                    autorización adicional.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => update('classification', 'specific')}
                  className={`min-h-24 rounded-2xl border p-4 text-left ${
                    form.classification === 'specific'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <p className="font-bold">Servicio específico</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Trabajo conocido con alcance y tarifa definidos.
                  </p>
                </button>
              </div>

              <label className="block">
                <span className="text-sm font-semibold">Tipo de servicio *</span>
                <select
                  value={form.service_type_id}
                  onChange={(event) => chooseType(event.target.value)}
                  className="mt-1 w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                >
                  <option value="">Seleccionar...</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.nombre}
                      {type.valor_base ? ` · $${money(type.valor_base)}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedType && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Categoría</p>
                    <p className="font-semibold">
                      {selectedType.categoria || 'Sin categoría'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valor base</p>
                    <p className="font-semibold">
                      {selectedType.valor_base
                        ? `$${money(selectedType.valor_base)}`
                        : 'Por definir'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Duración estimada</p>
                    <p className="font-semibold">
                      {selectedType.duracion_estimada || 60} min
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">Valor inicial</span>
                  <input
                    type="number"
                    min="0"
                    value={form.base_value}
                    onChange={(event) =>
                      update('base_value', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">
                    Tiempo estimado (min)
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={form.estimated_minutes}
                    onChange={(event) =>
                      update('estimated_minutes', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Alcance inicial *</span>
                <textarea
                  rows={4}
                  value={form.scope_text}
                  onChange={(event) => update('scope_text', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  Condiciones informadas *
                </span>
                <textarea
                  rows={6}
                  value={form.conditions_text}
                  onChange={(event) =>
                    update('conditions_text', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  Información sobre costos adicionales
                </span>
                <textarea
                  rows={4}
                  value={form.additional_costs_notice}
                  onChange={(event) =>
                    update('additional_costs_notice', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <input
                  type="checkbox"
                  checked={form.client_acceptance}
                  onChange={(event) =>
                    update('client_acceptance', event.target.checked)
                  }
                  className="mt-1 w-5 h-5"
                />
                <span>
                  <span className="font-bold block">
                    El cliente acepta las condiciones iniciales
                  </span>
                  <span className="text-sm text-gray-500">
                    Confirma que comprendió alcance, costos iniciales, tiempos y
                    posibles costos adicionales.
                  </span>
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">
                    Nombre de quien acepta *
                  </span>
                  <input
                    value={form.client_acceptance_name}
                    onChange={(event) =>
                      update('client_acceptance_name', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Documento</span>
                  <input
                    value={form.client_acceptance_document}
                    onChange={(event) =>
                      update('client_acceptance_document', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Canal *</span>
                  <select
                    value={form.client_acceptance_channel}
                    onChange={(event) =>
                      update('client_acceptance_channel', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Correo</option>
                    <option value="phone">Llamada</option>
                    <option value="in_person">Presencial</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">
                    Referencia / evidencia
                  </span>
                  <input
                    value={form.client_acceptance_reference}
                    onChange={(event) =>
                      update('client_acceptance_reference', event.target.value)
                    }
                    placeholder="Ej: aceptación presencial / WhatsApp 10:42"
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {/* SECCIÓN: Opciones de programación */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Opciones de programación
                </h4>
                <p className="text-sm text-blue-600/80 dark:text-blue-300/80 mb-3">
                  Elige cómo quieres que se programe esta orden de servicio
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      schedulingMode === 'auto'
                        ? 'border-blue-500 bg-blue-100/50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduling_mode"
                      value="auto"
                      checked={schedulingMode === 'auto'}
                      onChange={() => setSchedulingMode('auto')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Programación automática</p>
                      <p className="text-xs text-gray-500">
                        El sistema buscará el primer espacio común disponible
                        para todos los técnicos seleccionados
                      </p>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      schedulingMode === 'manual'
                        ? 'border-blue-500 bg-blue-100/50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduling_mode"
                      value="manual"
                      checked={schedulingMode === 'manual'}
                      onChange={() => setSchedulingMode('manual')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Programación manual</p>
                      <p className="text-xs text-gray-500">
                        La orden se creará sin fecha asignada. Se programará
                        manualmente después
                      </p>
                    </div>
                  </label>
                </div>

                {schedulingMode === 'auto' && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold">
                        Fecha programada *
                      </label>
                      <input
                        type="date"
                        value={form.scheduled_date}
                        onChange={(event) =>
                          update('scheduled_date', event.target.value)
                        }
                        min={new Date().toISOString().split('T')[0]}
                        className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">
                        Hora de inicio
                      </label>
                      <input
                        type="time"
                        value={form.scheduled_time}
                        onChange={(event) =>
                          update('scheduled_time', event.target.value)
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                      />
                    </div>
                  </div>
                )}

                {schedulingMode === 'manual' && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" />
                      Modo manual: La orden quedará pendiente de programación.
                      Deberás asignar fecha y hora después de la aprobación.
                    </p>
                  </div>
                )}
              </div>

              {/* Resto del contenido del paso 4: Técnicos */}
              {!isAdmin ? (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 mt-0.5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-bold">
                        Quedarás propuesto como técnico responsable
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Administración revisará la solicitud antes de
                        convertirla en OS y enviártela formalmente.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-semibold">
                      Buscar técnico
                    </label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                      <input
                        value={technicianSearch}
                        onChange={(event) =>
                          setTechnicianSearch(event.target.value)
                        }
                        placeholder="Nombre, usuario, cédula, celular o correo"
                        className="w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3"
                      />
                    </div>
                  </div>

                  {selectedPrimary && (
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                      <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">
                        Responsable principal
                      </p>
                      <p className="font-bold mt-1">
                        {[selectedPrimary.nombre1, selectedPrimary.apellidos]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{selectedPrimary.usuario || 'sin-usuario'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = filteredTechnicians.map((tech) => tech.id);
                        if (ids.length === 0) return;
                        const nextPrimary =
                          primaryTechnicianId && ids.includes(primaryTechnicianId)
                            ? primaryTechnicianId
                            : ids[0];

                        setPrimaryTechnicianId(nextPrimary);
                        setSupportTechnicianIds(
                          ids.filter((id) => id !== nextPrimary)
                        );
                      }}
                      className="min-h-10 rounded-xl border border-blue-300 text-blue-700 dark:text-blue-300 px-3 text-sm font-semibold"
                    >
                      Marcar visibles
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryTechnicianId('');
                        setSupportTechnicianIds([]);
                      }}
                      className="min-h-10 rounded-xl border border-gray-300 dark:border-gray-700 px-3 text-sm font-semibold"
                    >
                      Desmarcar todos
                    </button>
                  </div>

                  <div
                    className="max-h-[44dvh] sm:max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 dark:border-gray-800 p-2 space-y-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {filteredTechnicians.map((tech) => {
                      const isPrimary = primaryTechnicianId === tech.id;
                      const isSupport = supportTechnicianIds.includes(tech.id);
                      const isChecked = isPrimary || isSupport;

                      return (
                        <label
                          key={tech.id}
                          className={`rounded-xl border p-3 flex items-start gap-3 cursor-pointer ${
                            isPrimary
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                              : isSupport
                                ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => {
                              const checked = event.target.checked;

                              if (checked) {
                                if (!primaryTechnicianId) {
                                  setPrimaryTechnicianId(tech.id);
                                  return;
                                }

                                if (primaryTechnicianId !== tech.id) {
                                  setSupportTechnicianIds((current) =>
                                    current.includes(tech.id)
                                      ? current
                                      : [...current, tech.id]
                                  );
                                }

                                return;
                              }

                              if (isPrimary) {
                                const remaining = supportTechnicianIds.filter(
                                  (id) => id !== tech.id
                                );

                                const nextPrimary = remaining[0] || '';

                                setPrimaryTechnicianId(nextPrimary);
                                setSupportTechnicianIds(
                                  nextPrimary
                                    ? remaining.filter((id) => id !== nextPrimary)
                                    : []
                                );
                              } else {
                                setSupportTechnicianIds((current) =>
                                  current.filter((id) => id !== tech.id)
                                );
                              }
                            }}
                            className="mt-1 w-5 h-5 shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">
                              {[tech.nombre1, tech.nombre2, tech.apellidos]
                                .filter(Boolean)
                                .join(' ') || tech.usuario}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              @{tech.usuario || 'sin-usuario'} ·{' '}
                              {tech.celular || tech.email || 'sin contacto'}
                            </p>

                            {isChecked && (
                              <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                <input
                                  type="radio"
                                  name="primary-technician"
                                  checked={isPrimary}
                                  onChange={() => {
                                    const oldPrimary = primaryTechnicianId;

                                    setPrimaryTechnicianId(tech.id);

                                    setSupportTechnicianIds((current) => {
                                      const next = current.filter(
                                        (id) => id !== tech.id
                                      );

                                      if (
                                        oldPrimary &&
                                        oldPrimary !== tech.id &&
                                        !next.includes(oldPrimary)
                                      ) {
                                        next.push(oldPrimary);
                                      }

                                      return next;
                                    });
                                  }}
                                />
                                Responsable principal
                              </label>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                              isPrimary
                                ? 'bg-emerald-600 text-white'
                                : isSupport
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                            }`}
                          >
                            {isPrimary
                              ? 'Principal'
                              : isSupport
                                ? 'Apoyo'
                                : 'No asignado'}
                          </span>
                        </label>
                      );
                    })}

                    {filteredTechnicians.length === 0 && (
                      <p className="p-6 text-center text-sm text-gray-500">
                        No hay técnicos que coincidan con la búsqueda.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-4 text-sm">
                    <p>
                      <strong>Principal:</strong>{' '}
                      {selectedPrimary
                        ? [selectedPrimary.nombre1, selectedPrimary.apellidos]
                            .filter(Boolean)
                            .join(' ')
                        : 'Pendiente'}
                    </p>
                    <p className="mt-1">
                      <strong>Técnicos de apoyo:</strong>{' '}
                      {supportTechnicianIds.length}
                    </p>
                    <p className="mt-1 text-gray-500">
                      La agenda se bloqueará automáticamente para todos los
                      seleccionados cuando la OS sea aprobada.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              {isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update('billing_mode', 'prepaid')}
                    className={`rounded-2xl border p-4 text-left ${
                      form.billing_mode === 'prepaid'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <p className="font-bold">Prepago</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Factura y pago deben verificarse antes de crear la OS.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => update('billing_mode', 'postpaid')}
                    className={`rounded-2xl border p-4 text-left ${
                      form.billing_mode === 'postpaid'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <p className="font-bold">Pospago excepcional</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Debe quedar justificación administrativa.
                    </p>
                  </button>
                </div>
              )}

              {!isAdmin && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm text-blue-700 dark:text-blue-300">
                  Tu solicitud quedará pendiente de validación administrativa,
                  pago y activación como OS.
                </div>
              )}

              {form.billing_mode === 'prepaid' && (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold">
                      Referencia de factura *
                    </span>
                    <input
                      value={form.invoice_reference}
                      onChange={(event) =>
                        update('invoice_reference', event.target.value)
                      }
                      placeholder="Número o referencia de factura"
                      className="mt-1 w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                    />
                  </label>

                  {isAdmin && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={paymentVerified}
                          onChange={(event) =>
                            setPaymentVerified(event.target.checked)
                          }
                          className="w-5 h-5"
                        />
                        <span className="font-semibold">
                          Caja / administración verificó el pago
                        </span>
                      </label>

                      {paymentVerified && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label>
                            <span className="text-sm font-semibold">
                              Método
                            </span>
                            <select
                              value={paymentMethod}
                              onChange={(event) =>
                                setPaymentMethod(event.target.value)
                              }
                              className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                            >
                              <option value="cash">Efectivo</option>
                              <option value="card">Datáfono</option>
                              <option value="transfer">Transferencia</option>
                              <option value="credit">Crédito</option>
                              <option value="other">Otro</option>
                            </select>
                          </label>
                          <label>
                            <span className="text-sm font-semibold">
                              Referencia / soporte *
                            </span>
                            <input
                              value={paymentReference}
                              onChange={(event) =>
                                setPaymentReference(event.target.value)
                              }
                              className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {form.billing_mode === 'postpaid' && (
                <label className="block">
                  <span className="text-sm font-semibold">
                    Justificación de pospago *
                  </span>
                  <textarea
                    rows={4}
                    value={form.postpaid_reason}
                    onChange={(event) =>
                      update('postpaid_reason', event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                  />
                </label>
              )}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-950/40 p-4">
                <p className="font-bold">Resumen</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Cliente</p>
                    <p className="font-semibold">
                      {clientName(selectedClient)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tipo</p>
                    <p className="font-semibold">
                      {form.service_type_name || 'Sin definir'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Clasificación</p>
                    <p className="font-semibold">
                      {form.classification === 'diagnostic'
                        ? 'Revisión / diagnóstico'
                        : 'Servicio específico'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Modalidad</p>
                    <p className="font-semibold">
                      {form.billing_mode === 'prepaid' ? 'Prepago' : 'Pospago'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Programación</p>
                    <p className="font-semibold">
                      {schedulingMode === 'auto' ? 'Automática' : 'Manual'}
                    </p>
                  </div>
                  {schedulingMode === 'auto' && form.scheduled_date && (
                    <div>
                      <p className="text-gray-500">Fecha</p>
                      <p className="font-semibold">
                        {form.scheduled_date}
                        {form.scheduled_time ? ` ${form.scheduled_time}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4 bg-white dark:bg-gray-900">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (step === 0) onClose();
                else setStep((value) => value - 1);
              }}
              className="min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 px-4 font-semibold flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? 'Cancelar' : 'Anterior'}
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 font-semibold flex items-center justify-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving
                  ? 'Guardando...'
                  : isAdmin
                    ? 'Guardar y crear OS'
                    : 'Enviar solicitud'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}