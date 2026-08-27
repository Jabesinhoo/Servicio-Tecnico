import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  FileText,
  Ban,
} from 'lucide-react';
import api from '../../../../services/api';

const STATUS = {
  draft: 'Pendiente',
  ready: 'Lista',
  activated: 'OS creada',
  cancelled: 'Cancelada',
};

function fmt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO');
}

export default function ServiceIntakeBoard({
  isOpen,
  onClose,
  onActivated,
}) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isOpen) return;

    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/service-orders/intakes', {
        params: {
          status: status || undefined,
          search: search || undefined,
          limit: 100,
        },
      });
      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar las solicitudes previas'
      );
    } finally {
      setLoading(false);
    }
  }, [isOpen, status, search]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(load, 250);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
    };
  }, [isOpen, load]);

  const verifyPayment = async (row) => {
    const invoice =
      window.prompt(
        'Referencia de factura',
        row.invoice_reference || ''
      )?.trim() || '';

    if (!invoice) return;

    const paymentReference =
      window.prompt(
        'Referencia o soporte del pago',
        row.payment_reference || ''
      )?.trim() || '';

    if (!paymentReference) return;

    const paymentMethod =
      window.prompt(
        'Método: cash, card, transfer, credit u other',
        row.payment_method || 'transfer'
      )?.trim() || 'transfer';

    try {
      setBusy(row.id);
      setError('');

      await api.post(
        `/api/service-orders/intakes/${row.id}/verify-payment`,
        {
          invoice_reference: invoice,
          payment_reference: paymentReference,
          payment_method: paymentMethod,
        }
      );

      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible verificar el pago'
      );
    } finally {
      setBusy(null);
    }
  };

  const activate = async (row) => {
    try {
      setBusy(row.id);
      setError('');

      const response = await api.post(
        `/api/service-orders/intakes/${row.id}/activate`
      );

      window.alert(
        response.data?.message ||
          'Orden de servicio creada'
      );

      await load();
      await onActivated?.();
    } catch (requestError) {
      const missing = requestError.response?.data?.missing;

      setError(
        missing?.length
          ? `No puede activarse. Falta: ${missing.join(', ')}`
          : requestError.response?.data?.message ||
              'No fue posible crear la OS'
      );
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (row) => {
    const reason =
      window.prompt('Motivo de cancelación')?.trim() || '';

    if (!reason) return;

    try {
      setBusy(row.id);
      setError('');
      await api.post(
        `/api/service-orders/intakes/${row.id}/cancel`,
        { reason }
      );
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible cancelar la solicitud'
      );
    } finally {
      setBusy(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[115] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-blue-600">
              Antes de convertirse en OS
            </p>
            <h2 className="text-xl font-bold">Solicitudes de servicio</h2>
            <p className="text-sm text-gray-500 mt-1">
              Control de clasificación, aceptación, factura y pago.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-3 grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cliente, factura, tipo o solicitud"
              className="w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
          >
            <option value="">Todos</option>
            <option value="draft">Pendientes</option>
            <option value="activated">OS creada</option>
            <option value="cancelled">Canceladas</option>
          </select>

          <button
            type="button"
            onClick={load}
            className="min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 px-4 font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-gray-500">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No hay solicitudes previas.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {rows.map((row) => {
                const ready = Boolean(row.readiness?.ready);
                const isBusy = busy === row.id;

                return (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {row.client_name || 'Cliente'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.client_document || 'Sin documento'} · {fmt(row.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.status === 'activated'
                          ? 'bg-emerald-100 text-emerald-700'
                          : row.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-600'
                            : ready
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status === 'draft' && ready
                          ? 'Lista'
                          : STATUS[row.status] || row.status}
                      </span>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold">
                        {row.service_type_name || 'Tipo por definir'}
                      </p>
                      <p className="text-gray-500 line-clamp-2 mt-1">
                        {row.request_description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-3">
                        <p className="text-xs text-gray-500">Modalidad</p>
                        <p className="font-semibold">
                          {row.billing_mode === 'prepaid' ? 'Prepago' : 'Pospago'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-3">
                        <p className="text-xs text-gray-500">Pago</p>
                        <p className="font-semibold">
                          {row.payment_status === 'verified'
                            ? 'Verificado'
                            : row.payment_status === 'not_required'
                              ? 'No requerido'
                              : 'Pendiente'}
                        </p>
                      </div>
                    </div>

                    {row.status === 'draft' && !ready && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                        Falta: {(row.readiness?.missing || []).join(', ')}
                      </div>
                    )}

                    {row.status === 'activated' && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {row.codigo_os || 'OS creada'}
                      </div>
                    )}

                    {row.status === 'draft' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {row.billing_mode === 'prepaid' &&
                          row.payment_status !== 'verified' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => verifyPayment(row)}
                              className="min-h-11 rounded-xl border border-blue-300 text-blue-700 font-semibold px-3 flex items-center justify-center gap-2"
                            >
                              <CreditCard className="w-4 h-4" />
                              Verificar pago
                            </button>
                          )}

                        <button
                          type="button"
                          disabled={isBusy || !ready}
                          onClick={() => activate(row)}
                          className="min-h-11 rounded-xl bg-emerald-600 disabled:opacity-40 text-white font-semibold px-3 flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Crear OS
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => cancel(row)}
                          className="min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold px-3 flex items-center justify-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold px-5"
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}
