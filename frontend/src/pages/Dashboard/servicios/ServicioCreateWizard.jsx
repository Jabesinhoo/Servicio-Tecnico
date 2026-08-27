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
  return [
    client.primer_nombre,
    client.primer_apellido,
  ].filter(Boolean).join(' ') || 'Cliente';
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
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentReference, setPaymentReference] = useState('');

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
    scheduled_date: '',
    scheduled_time: '',
    estimated_duration: 60,
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    api.get('/api/tipos-servicio')
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setTypes(rows.filter((item) => item.activo !== false));
      })
      .catch(() => setTypes([]));

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

  const update = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const chooseType = (id) => {
    const type = types.find((item) => String(item.id) === String(id));

    setForm((previous) => ({
      ...previous,
      service_type_id: id,
      service_type_name: type?.nombre || '',
      service_type_category: type?.categoria || '',
      base_value:
        previous.base_value !== ''
          ? previous.base_value
          : type?.valor_base ?? '',
      estimated_minutes:
        type?.duracion_estimada || previous.estimated_minutes || 60,
      estimated_duration:
        type?.duracion_estimada || previous.estimated_duration || 60,
      scope_text:
        previous.scope_text ||
        type?.descripcion ||
        '',
      classification:
        type?.requiere_diagnostico
          ? 'diagnostic'
          : previous.classification,
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

    if (step === 4 && form.billing_mode === 'prepaid') {
      if (!form.invoice_reference.trim()) {
        return 'Registra la referencia de factura.';
      }
      if (isAdmin && paymentVerified && !paymentReference.trim()) {
        return 'Registra la referencia o soporte del pago.';
      }
    }

    if (step === 4 && form.billing_mode === 'postpaid') {
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
        source_type: isAdmin ? 'customer' : 'technician',
        created_from_technician: !isAdmin,
        ...form,
        base_value:
          form.base_value === '' ? null : Number(form.base_value),
        estimated_minutes:
          form.estimated_minutes
            ? Number(form.estimated_minutes)
            : null,
        estimated_duration:
          form.estimated_duration
            ? Number(form.estimated_duration)
            : null,
      });

      const intake = createResponse.data?.data;

      if (!intake?.id) {
        throw new Error('No se recibió el ID de la solicitud');
      }

      if (
        isAdmin &&
        form.billing_mode === 'prepaid' &&
        paymentVerified
      ) {
        await api.post(
          `/api/service-orders/intakes/${intake.id}/verify-payment`,
          {
            invoice_reference: form.invoice_reference,
            payment_method: paymentMethod,
            payment_reference: paymentReference,
          }
        );
      }

      if (isAdmin) {
        try {
          await api.post(
            `/api/service-orders/intakes/${intake.id}/activate`
          );
        } catch (activateError) {
          if (
            activateError.response?.data?.code !== 'INTAKE_NOT_READY'
          ) {
            throw activateError;
          }

          const missing =
            activateError.response?.data?.missing || [];

          setError(
            `Solicitud guardada, pero aún no puede crear la OS. Falta: ${missing.join(', ')}`
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
                      {selectedClient.documento || 'Sin documento'} · {selectedClient.telefono || 'Sin teléfono'}
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
                          {client.documento || 'Sin documento'} · {client.telefono || 'Sin teléfono'}
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
                  onChange={(event) => update('request_description', event.target.value)}
                  placeholder="Ej: Portátil no enciende. Cliente solicita revisión y diagnóstico..."
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <label>
                  <span className="text-sm font-semibold">Fecha tentativa</span>
                  <input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(event) => update('scheduled_date', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold">Hora tentativa</span>
                  <input
                    type="time"
                    value={form.scheduled_time}
                    onChange={(event) => update('scheduled_time', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
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
                    Se determina la falla y posteriormente puede requerir autorización adicional.
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
                    <p className="font-semibold">{selectedType.categoria || 'Sin categoría'}</p>
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
                    onChange={(event) => update('base_value', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Tiempo estimado (min)</span>
                  <input
                    type="number"
                    min="1"
                    value={form.estimated_minutes}
                    onChange={(event) => update('estimated_minutes', event.target.value)}
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
                <span className="text-sm font-semibold">Condiciones informadas *</span>
                <textarea
                  rows={6}
                  value={form.conditions_text}
                  onChange={(event) => update('conditions_text', event.target.value)}
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
                  onChange={(event) => update('additional_costs_notice', event.target.value)}
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
                  onChange={(event) => update('client_acceptance', event.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <span>
                  <span className="font-bold block">
                    El cliente acepta las condiciones iniciales
                  </span>
                  <span className="text-sm text-gray-500">
                    Confirma que comprendió alcance, costos iniciales, tiempos y posibles costos adicionales.
                  </span>
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">Nombre de quien acepta *</span>
                  <input
                    value={form.client_acceptance_name}
                    onChange={(event) => update('client_acceptance_name', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Documento</span>
                  <input
                    value={form.client_acceptance_document}
                    onChange={(event) => update('client_acceptance_document', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Canal *</span>
                  <select
                    value={form.client_acceptance_channel}
                    onChange={(event) => update('client_acceptance_channel', event.target.value)}
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
                  <span className="text-sm font-semibold">Referencia / evidencia</span>
                  <input
                    value={form.client_acceptance_reference}
                    onChange={(event) => update('client_acceptance_reference', event.target.value)}
                    placeholder="Ej: aceptación presencial / WhatsApp 10:42"
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
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
                  Tu solicitud quedará pendiente de validación administrativa, pago y activación como OS.
                </div>
              )}

              {form.billing_mode === 'prepaid' && (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold">Referencia de factura *</span>
                    <input
                      value={form.invoice_reference}
                      onChange={(event) => update('invoice_reference', event.target.value)}
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
                          onChange={(event) => setPaymentVerified(event.target.checked)}
                          className="w-5 h-5"
                        />
                        <span className="font-semibold">
                          Caja / administración verificó el pago
                        </span>
                      </label>

                      {paymentVerified && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label>
                            <span className="text-sm font-semibold">Método</span>
                            <select
                              value={paymentMethod}
                              onChange={(event) => setPaymentMethod(event.target.value)}
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
                            <span className="text-sm font-semibold">Referencia / soporte *</span>
                            <input
                              value={paymentReference}
                              onChange={(event) => setPaymentReference(event.target.value)}
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
                    onChange={(event) => update('postpaid_reason', event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                  />
                </label>
              )}

              <div className="rounded-2xl bg-gray-50 dark:bg-gray-950/40 p-4">
                <p className="font-bold">Resumen</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Cliente</p>
                    <p className="font-semibold">{clientName(selectedClient)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tipo</p>
                    <p className="font-semibold">{form.service_type_name || 'Sin definir'}</p>
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
