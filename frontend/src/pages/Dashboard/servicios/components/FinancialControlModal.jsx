import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  BadgeCheck,
  CircleDollarSign,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import api from '../../../../services/api';
import WorldOfficeDiscoveryModal from './WorldOfficeDiscoveryModal';

const STATUS_LABELS = {
  pending: 'Pendiente',
  cleared: 'Liberado',
  blocked: 'Bloqueado',
  not_required: 'No requerido',
};

const KIND_LABELS = {
  payment_confirmed: 'Pago confirmado',
  credit_authorized: 'Crédito autorizado',
  balance_zero: 'Saldo cero',
  manual_review: 'Revisión manual',
  not_required: 'No requerido',
  blocked: 'Bloqueado',
};

const SOURCE_LABELS = {
  intake: 'Solicitud / intake',
  manual: 'Verificación manual',
  worldoffice_mirror: 'Espejo WorldOffice',
  worldoffice_live: 'WorldOffice en vivo (solo lectura)',
  other: 'Otra fuente',
};

const fmt = (value) =>
  value
    ? new Date(value).toLocaleString(
        'es-CO',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    : '—';

const money = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return String(value);
  }

  return numeric.toLocaleString(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }
  );
};

export default function FinancialControlModal({
  service,
  isAdmin,
  onClose,
  onRefresh,
}) {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [correlation, setCorrelation] =
    useState(null);

  const [showWorldOffice, setShowWorldOffice] =
    useState(false);

  const [worldOfficeLive, setWorldOfficeLive] =
    useState(null);

  const [billingMode, setBillingMode] =
    useState('unclassified');

  const [
    verificationRequired,
    setVerificationRequired,
  ] = useState(true);

  const [
    invoiceReference,
    setInvoiceReference,
  ] = useState('');

  const [
    paymentReference,
    setPaymentReference,
  ] = useState('');

  const [
    expectedAmount,
    setExpectedAmount,
  ] = useState('');

  const [
    externalSystem,
    setExternalSystem,
  ] = useState('');

  const [
    externalClientId,
    setExternalClientId,
  ] = useState('');

  const [
    externalInvoiceId,
    setExternalInvoiceId,
  ] = useState('');

  const [note, setNote] =
    useState('');

  const [
    verificationSource,
    setVerificationSource,
  ] = useState('manual');

  const [
    verificationKind,
    setVerificationKind,
  ] = useState(
    'manual_review'
  );

  const [
    resultStatus,
    setResultStatus,
  ] = useState('pending');

  const [
    balanceAmount,
    setBalanceAmount,
  ] = useState('');

  const [
    paidAmount,
    setPaidAmount,
  ] = useState('');

  const [
    externalReference,
    setExternalReference,
  ] = useState('');

  const [
    verificationNote,
    setVerificationNote,
  ] = useState('');

  const load = useCallback(
    async () => {
      if (!service?.id) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response =
          await api.get(
            `/api/service-orders/${service.id}/financial`
          );

        const payload =
          response.data?.data ||
          null;

        setData(payload);

        const control =
          payload?.control ||
          {};

        setBillingMode(
          control.billing_mode ||
            payload?.intake
              ?.billing_mode ||
            'unclassified'
        );

        setVerificationRequired(
          control.verification_required !==
            false
        );

        setInvoiceReference(
          control.invoice_reference ||
            payload?.intake
              ?.invoice_reference ||
            ''
        );

        setPaymentReference(
          control.payment_reference ||
            payload?.intake
              ?.payment_reference ||
            ''
        );

        setExpectedAmount(
          control.expected_amount ??
            payload?.intake
              ?.base_value ??
            ''
        );

        setExternalSystem(
          control.external_system ||
            ''
        );

        setExternalClientId(
          control.external_client_id ||
            ''
        );

        setExternalInvoiceId(
          control.external_invoice_id ||
            ''
        );

        setNote(
          control.note ||
            ''
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar el control financiero'
        );
      } finally {
        setLoading(false);
      }
    },
    [service?.id]
  );

  useEffect(() => {
    if (!service) {
      return undefined;
    }

    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    load();

    const onKey = (
      event
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      onKey
    );

    return () => {
      document.body.style.overflow =
        previous;

      window.removeEventListener(
        'keydown',
        onKey
      );
    };
  }, [
    service,
    load,
    onClose,
  ]);

  if (!service) {
    return null;
  }

  const control =
    data?.control || {};

  const verifications =
    Array.isArray(
      data?.verifications
    )
      ? data.verifications
      : [];

  const ready =
    Boolean(
      data?.ready_for_delivery
    );

  const run = async (
    fn
  ) => {
    try {
      setSaving(true);
      setError('');

      await fn();

      await load();

      await onRefresh?.();
    } catch (requestError) {
      setError(
        requestError.response
          ?.data?.message ||
          requestError.message ||
          'No fue posible completar la acción'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = () =>
    run(async () => {
      await api.put(
        `/api/service-orders/${service.id}/financial`,
        {
          billing_mode:
            billingMode,
          verification_required:
            verificationRequired,
          invoice_reference:
            invoiceReference,
          payment_reference:
            paymentReference,
          expected_amount:
            expectedAmount ===
            ''
              ? null
              : Number(
                  expectedAmount
                ),
          external_system:
            externalSystem,
          external_client_id:
            externalClientId,
          external_invoice_id:
            externalInvoiceId,
          note,
        }
      );
    });

  const saveVerification =
    () =>
      run(async () => {
        await api.post(
          `/api/service-orders/${service.id}/financial/verifications`,
          {
            verification_source:
              verificationSource,
            verification_kind:
              verificationKind,
            result_status:
              resultStatus,
            invoice_reference:
              invoiceReference,
            payment_reference:
              paymentReference,
            external_reference:
              externalReference,
            balance_amount:
              balanceAmount ===
              ''
                ? null
                : Number(
                    balanceAmount
                  ),
            paid_amount:
              paidAmount ===
              ''
                ? null
                : Number(
                    paidAmount
                  ),
            evidence_note:
              verificationNote,
          }
        );

        setBalanceAmount('');
        setPaidAmount('');
        setExternalReference('');
        setVerificationNote('');
      });

  const loadCorrelation =
    async () => {
      try {
        setSaving(true);
        setError('');

        const response =
          await api.get(
            `/api/service-orders/${service.id}/financial/worldoffice-correlation`
          );

        setCorrelation(
          response.data?.data ||
            null
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible consultar la correlación WorldOffice'
        );
      } finally {
        setSaving(false);
      }
    };

  const runWorldOfficeLiveCheck =
    async () => {
      try {
        setSaving(true);
        setError('');

        const response =
          await api.post(
            `/api/service-orders/${service.id}/financial/worldoffice-live-check`
          );

        setWorldOfficeLive(
          response.data?.data ||
            null
        );
      } catch (requestError) {
        setWorldOfficeLive(null);
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible consultar la factura en WorldOffice'
        );
      } finally {
        setSaving(false);
      }
    };

  const registerWorldOfficeZeroBalance =
    async () => {
      await run(async () => {
        const response =
          await api.post(
            `/api/service-orders/${service.id}/financial/worldoffice-register-zero-balance`
          );

        setWorldOfficeLive(
          response.data?.data?.summary ||
            null
        );
      });
    };

  return (
    <div className="fixed inset-0 z-[147] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-emerald-600">
              {service.codigo_os}
            </p>

            <h3 className="text-lg sm:text-xl font-bold">
              Control financiero
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Factura, pago, crédito, saldo y liberación previa a la entrega.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5"
          style={{
            WebkitOverflowScrolling:
              'touch',
          }}
        >
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading &&
          !data ? (
            <div className="py-12 text-center text-slate-500">
              Cargando control financiero...
            </div>
          ) : (
            <>
              <section
                className={`rounded-2xl border p-4 ${
                  ready
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20'
                    : control.clearance_status ===
                        'blocked'
                      ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20'
                      : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  {ready ? (
                    <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}

                  <div className="min-w-0">
                    <p className="font-bold">
                      {ready
                        ? 'Liberación financiera válida'
                        : control.clearance_status ===
                            'blocked'
                          ? 'Entrega bloqueada'
                          : 'Control financiero pendiente'}
                    </p>

                    <p className="mt-1 text-sm">
                      Estado:{' '}
                      <strong>
                        {STATUS_LABELS[
                          control.clearance_status
                        ] ||
                          control.clearance_status ||
                          'Pendiente'}
                      </strong>
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      La entrega final solo se habilita cuando este control está liberado o marcado formalmente como no requerido.
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">
                    Cliente
                  </p>
                  <p className="font-semibold mt-1 break-words">
                    {data?.order
                      ?.client_name ||
                      '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">
                    Documento
                  </p>
                  <p className="font-semibold mt-1 break-words">
                    {data?.order
                      ?.client_document ||
                      '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">
                    Modalidad
                  </p>
                  <p className="font-semibold mt-1">
                    {control.billing_mode === 'postpaid'
                      ? 'Postpago'
                      : control.billing_mode === 'prepaid'
                        ? 'Prepago'
                        : 'Por definir'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">
                    Valor esperado
                  </p>
                  <p className="font-semibold mt-1">
                    {money(
                      control.expected_amount
                    )}
                  </p>
                </div>
              </section>

              {isAdmin && (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold">
                      Configuración financiera
                    </h4>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <label>
                      <span className="text-sm font-semibold">
                        Modalidad
                      </span>
                      <select
                        value={
                          billingMode
                        }
                        onChange={(
                          event
                        ) =>
                          setBillingMode(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      >
                        <option value="unclassified">
                          Por definir
                        </option>
                        <option value="prepaid">
                          Prepago
                        </option>
                        <option value="postpaid">
                          Postpago
                        </option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Factura
                      </span>
                      <input
                        value={
                          invoiceReference
                        }
                        onChange={(
                          event
                        ) =>
                          setInvoiceReference(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Referencia pago
                      </span>
                      <input
                        value={
                          paymentReference
                        }
                        onChange={(
                          event
                        ) =>
                          setPaymentReference(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Valor esperado
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={
                          expectedAmount
                        }
                        onChange={(
                          event
                        ) =>
                          setExpectedAmount(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>
                  </div>

                  <label className="mt-3 min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        verificationRequired
                      }
                      onChange={(
                        event
                      ) =>
                        setVerificationRequired(
                          event.target.checked
                        )
                      }
                      className="mt-0.5 w-5 h-5 shrink-0"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        Exigir liberación financiera antes de entregar
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Desmarcarlo registra el control como no requerido.
                      </span>
                    </span>
                  </label>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label>
                      <span className="text-sm font-semibold">
                        Sistema externo
                      </span>
                      <input
                        value={
                          externalSystem
                        }
                        onChange={(
                          event
                        ) =>
                          setExternalSystem(
                            event.target.value
                          )
                        }
                        placeholder="Ej: WorldOffice"
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        ID cliente externo
                      </span>
                      <input
                        value={
                          externalClientId
                        }
                        onChange={(
                          event
                        ) =>
                          setExternalClientId(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        ID factura externo
                      </span>
                      <input
                        value={
                          externalInvoiceId
                        }
                        onChange={(
                          event
                        ) =>
                          setExternalInvoiceId(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-sm font-semibold">
                      Nota
                    </span>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(
                        event
                      ) =>
                        setNote(
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={
                      saveConfig
                    }
                    className="mt-3 w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4"
                  >
                    Guardar configuración
                  </button>
                </section>
              )}

              {isAdmin && (
                <section className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-blue-600" />
                        <h4 className="font-bold">
                          Correlación WorldOffice
                        </h4>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        V17 consulta únicamente el espejo local de clientes. Una coincidencia NO significa que el pago o saldo estén verificados.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={
                        loadCorrelation
                      }
                      className="w-full sm:w-auto min-h-10 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold px-3 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Consultar espejo
                    </button>
                  </div>

                  {correlation && (
                    <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-white/70 dark:bg-slate-950/30 p-3 text-sm">
                      <p className="font-semibold">
                        {correlation.correlated
                          ? 'Cliente correlacionado'
                          : 'Sin correlación'}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {correlation.message}
                      </p>

                      {Array.isArray(
                        correlation.matches
                      ) &&
                        correlation.matches.map(
                          (
                            match,
                            index
                          ) => (
                            <div
                              key={`${match.id_externo}-${index}`}
                              className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2"
                            >
                              <p className="font-semibold">
                                {match.razon_social ||
                                  [
                                    match.primer_nombre,
                                    match.primer_apellido,
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      ' '
                                    ) ||
                                  'Cliente'}
                              </p>
                              <p className="text-xs mt-1">
                                ID externo:{' '}
                                {match.id_externo}
                                {' · '}
                                Documento:{' '}
                                {match.documento ||
                                  '—'}
                              </p>
                            </div>
                          )
                        )}
                    </div>
                  )}
                </section>
              )}

              {isAdmin && (
                <section className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-950/20 p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-cyan-700 dark:text-cyan-300" />
                        <h4 className="font-bold">
                          WorldOffice V18 · lectura financiera en vivo
                        </h4>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Usa la referencia de factura guardada en este Control financiero. No modifica WorldOffice.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          setShowWorldOffice(
                            true
                          )
                        }
                        className="min-h-10 rounded-xl border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 font-semibold px-3"
                      >
                        Configurar lectura
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={
                          runWorldOfficeLiveCheck
                        }
                        className="min-h-10 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-semibold px-3"
                      >
                        Consultar factura
                      </button>
                    </div>
                  </div>

                  {worldOfficeLive && (
                    <div className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900 bg-white/80 dark:bg-slate-950/40 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <p className="font-bold">
                            {worldOfficeLive.eligible_zero_balance
                              ? 'Saldo cero verificable'
                              : worldOfficeLive.result_status === 'not_found'
                                ? 'Factura no encontrada'
                                : worldOfficeLive.result_status === 'client_mismatch'
                                  ? 'Factura de otro cliente'
                                  : worldOfficeLive.result_status === 'ambiguous'
                                    ? 'Resultado ambiguo'
                                    : 'Revisión requerida'}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {worldOfficeLive.message}
                          </p>
                        </div>

                        <span className="rounded-full bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 px-2 py-1 text-xs font-semibold">
                          {worldOfficeLive.mapping?.source_schema}.{worldOfficeLive.mapping?.source_object}
                        </span>
                      </div>

                      {worldOfficeLive.record && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">
                              Factura
                            </p>
                            <p className="font-semibold break-words">
                              {worldOfficeLive.record.invoice_reference || '—'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Total
                            </p>
                            <p className="font-semibold">
                              {money(
                                worldOfficeLive.record.total_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Pagado
                            </p>
                            <p className="font-semibold">
                              {money(
                                worldOfficeLive.record.paid_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Saldo
                            </p>
                            <p className="font-semibold">
                              {money(
                                worldOfficeLive.record.balance_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Estado WO
                            </p>
                            <p className="font-semibold break-words">
                              {worldOfficeLive.record.status || '—'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Vencimiento
                            </p>
                            <p className="font-semibold break-words">
                              {worldOfficeLive.record.due_date
                                ? fmt(worldOfficeLive.record.due_date)
                                : '—'}
                            </p>
                          </div>
                        </div>
                      )}

                      {worldOfficeLive.eligible_zero_balance && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={
                            registerWorldOfficeZeroBalance
                          }
                          className="mt-4 w-full sm:w-auto min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4"
                        >
                          Registrar saldo cero y liberar
                        </button>
                      )}

                      {!worldOfficeLive.eligible_zero_balance &&
                        worldOfficeLive.record?.balance_amount > 0 && (
                          <p className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                            Un saldo mayor a cero no se libera automáticamente. Si existe crédito autorizado, usa la verificación manual “Crédito autorizado”.
                          </p>
                        )}
                    </div>
                  )}
                </section>
              )}

              {isAdmin && (
                <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold">
                      Registrar verificación
                    </h4>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <label>
                      <span className="text-sm font-semibold">
                        Fuente
                      </span>
                      <select
                        value={
                          verificationSource
                        }
                        onChange={(
                          event
                        ) =>
                          setVerificationSource(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      >
                        <option value="manual">
                          Manual
                        </option>
                        <option value="worldoffice_mirror">
                          Espejo WorldOffice
                        </option>
                        <option value="other">
                          Otra
                        </option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Tipo
                      </span>
                      <select
                        value={
                          verificationKind
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            event.target.value;

                          setVerificationKind(
                            value
                          );

                          if (
                            value ===
                            'not_required'
                          ) {
                            setResultStatus(
                              'not_required'
                            );
                          } else if (
                            value ===
                            'blocked'
                          ) {
                            setResultStatus(
                              'blocked'
                            );
                          }
                        }}
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      >
                        {Object.entries(
                          KIND_LABELS
                        ).map(
                          ([
                            key,
                            label,
                          ]) => (
                            <option
                              key={
                                key
                              }
                              value={
                                key
                              }
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Resultado
                      </span>
                      <select
                        value={
                          resultStatus
                        }
                        disabled={
                          [
                            'not_required',
                            'blocked',
                          ].includes(
                            verificationKind
                          )
                        }
                        onChange={(
                          event
                        ) =>
                          setResultStatus(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 disabled:opacity-60"
                      >
                        <option value="pending">
                          Pendiente
                        </option>
                        <option value="cleared">
                          Liberado
                        </option>
                        <option value="blocked">
                          Bloqueado
                        </option>
                        <option value="not_required">
                          No requerido
                        </option>
                      </select>
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Referencia externa
                      </span>
                      <input
                        value={
                          externalReference
                        }
                        onChange={(
                          event
                        ) =>
                          setExternalReference(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Saldo
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={
                          balanceAmount
                        }
                        onChange={(
                          event
                        ) =>
                          setBalanceAmount(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>

                    <label>
                      <span className="text-sm font-semibold">
                        Valor pagado
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={
                          paidAmount
                        }
                        onChange={(
                          event
                        ) =>
                          setPaidAmount(
                            event.target.value
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                      />
                    </label>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-sm font-semibold">
                      Evidencia / observación
                    </span>
                    <textarea
                      rows={3}
                      value={
                        verificationNote
                      }
                      onChange={(
                        event
                      ) =>
                        setVerificationNote(
                          event.target.value
                        )
                      }
                      placeholder="Ej: pago validado en caja, crédito autorizado por..., saldo revisado..."
                      className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={
                      saveVerification
                    }
                    className="mt-3 w-full sm:w-auto min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4"
                  >
                    Registrar verificación
                  </button>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold">
                    Historial financiero
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    Las verificaciones son inmutables; una corrección se registra como un nuevo evento.
                  </p>
                </div>

                <div className="p-3 sm:p-4 space-y-3">
                  {verifications.map(
                    (
                      item
                    ) => (
                      <article
                        key={
                          item.id
                        }
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm">
                              {KIND_LABELS[
                                item.verification_kind
                              ] ||
                                item.verification_kind}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {SOURCE_LABELS[
                                item.verification_source
                              ] ||
                                item.verification_source}
                              {' · '}
                              {STATUS_LABELS[
                                item.result_status
                              ] ||
                                item.result_status}
                            </p>
                          </div>

                          <span className="text-xs text-slate-500">
                            {fmt(
                              item.verified_at
                            )}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">
                              Factura
                            </p>
                            <p className="font-semibold break-words">
                              {item.invoice_reference ||
                                '—'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Saldo
                            </p>
                            <p className="font-semibold">
                              {money(
                                item.balance_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Pagado
                            </p>
                            <p className="font-semibold">
                              {money(
                                item.paid_amount
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Verificado por
                            </p>
                            <p className="font-semibold break-words">
                              {item.verified_by_name ||
                                item.verified_by_username ||
                                'Usuario'}
                            </p>
                          </div>
                        </div>

                        {item.evidence_note && (
                          <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                            {item.evidence_note}
                          </p>
                        )}
                      </article>
                    )
                  )}

                  {verifications.length ===
                    0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                      No hay verificaciones financieras registradas.
                    </div>
                  )}
                </div>
              </section>

              {!isAdmin && (
                <p className="text-xs text-slate-500">
                  El técnico puede consultar este control, pero solo administración puede modificarlo o liberar financieramente una orden.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5"
          >
            Cerrar
          </button>
        </footer>
      </section>

      <WorldOfficeDiscoveryModal
        open={showWorldOffice}
        onClose={() =>
          setShowWorldOffice(
            false
          )
        }
        onMappingChanged={() => {
          setWorldOfficeLive(null);
        }}
      />
    </div>
  );
}
