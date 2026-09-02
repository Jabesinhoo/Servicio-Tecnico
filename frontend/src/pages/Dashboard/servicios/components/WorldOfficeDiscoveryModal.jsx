import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Database,
  Eye,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../../../services/api';

const emptyMapping = () => ({
  profile_name:
    'WorldOffice financiero',
  source_schema: '',
  source_object: '',
  invoice_reference_column: '',
  client_document_column: '',
  client_external_id_column: '',
  total_amount_column: '',
  paid_amount_column: '',
  balance_amount_column: '',
  status_column: '',
  due_date_column: '',
  currency_column: '',
  balance_tolerance: '0',
  active: true,
  note: '',
});

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

export default function WorldOfficeDiscoveryModal({
  open,
  onClose,
  onMappingChanged,
}) {
  const [status, setStatus] =
    useState(null);

  const [discovery, setDiscovery] =
    useState(null);

  const [mapping, setMapping] =
    useState(emptyMapping);

  const [selectedCandidate, setSelectedCandidate] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [busy, setBusy] =
    useState('');

  const [error, setError] =
    useState('');

  const candidates =
    useMemo(() => {
      const value =
        discovery?.candidate_snapshot ||
        discovery?.candidates ||
        [];

      return Array.isArray(value)
        ? value
        : [];
    }, [discovery]);

  const columns =
    selectedCandidate?.columns ||
    [];

  const load = useCallback(
    async () => {
      if (!open) {
        return;
      }

      try {
        setBusy('load');
        setError('');

        const [
          statusResponse,
          discoveryResponse,
          mappingResponse,
        ] = await Promise.all([
          api.get(
            '/api/service-orders/financial/worldoffice/status'
          ),
          api.get(
            '/api/service-orders/financial/worldoffice/discovery/latest'
          ),
          api.get(
            '/api/service-orders/financial/worldoffice/mappings'
          ),
        ]);

        const statusData =
          statusResponse.data?.data ||
          null;

        const discoveryData =
          discoveryResponse.data?.data ||
          null;

        const mappings =
          Array.isArray(
            mappingResponse.data?.data
          )
            ? mappingResponse.data.data
            : [];

        const active =
          mappings.find(
            (item) =>
              item.active
          ) ||
          mappings[0] ||
          null;

        setStatus(statusData);
        setDiscovery(discoveryData);

        if (active) {
          setMapping({
            profile_name:
              active.profile_name ||
              'WorldOffice financiero',

            source_schema:
              active.source_schema ||
              '',

            source_object:
              active.source_object ||
              '',

            invoice_reference_column:
              active.invoice_reference_column ||
              '',

            client_document_column:
              active.client_document_column ||
              '',

            client_external_id_column:
              active.client_external_id_column ||
              '',

            total_amount_column:
              active.total_amount_column ||
              '',

            paid_amount_column:
              active.paid_amount_column ||
              '',

            balance_amount_column:
              active.balance_amount_column ||
              '',

            status_column:
              active.status_column ||
              '',

            due_date_column:
              active.due_date_column ||
              '',

            currency_column:
              active.currency_column ||
              '',

            balance_tolerance:
              String(
                active.balance_tolerance ??
                0
              ),

            active:
              active.active !==
              false,

            note:
              active.note ||
              '',
          });

          if (
            discoveryData
          ) {
            const candidateList =
              Array.isArray(
                discoveryData.candidate_snapshot
              )
                ? discoveryData.candidate_snapshot
                : [];

            const candidate =
              candidateList.find(
                (item) =>
                  item.schema_name ===
                    active.source_schema &&
                  item.object_name ===
                    active.source_object
              ) ||
              null;

            setSelectedCandidate(
              candidate
            );
          }
        }
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar WorldOffice V18'
        );
      } finally {
        setBusy('');
      }
    },
    [open]
  );

  useEffect(() => {
    if (!open) {
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
    open,
    load,
    onClose,
  ]);

  if (!open) {
    return null;
  }

  const run = async (
    key,
    fn
  ) => {
    try {
      setBusy(key);
      setError('');
      await fn();
    } catch (requestError) {
      setError(
        requestError.response
          ?.data?.message ||
        requestError.message ||
        'No fue posible completar la operación'
      );
    } finally {
      setBusy('');
    }
  };

  const probe = () =>
    run(
      'probe',
      async () => {
        await api.post(
          '/api/service-orders/financial/worldoffice/probe'
        );

        await load();
      }
    );

  const discover = () =>
    run(
      'discover',
      async () => {
        const response =
          await api.post(
            '/api/service-orders/financial/worldoffice/discover'
          );

        const data =
          response.data?.data ||
          null;

        setDiscovery({
          id:
            data?.run_id,
          database_name:
            data?.database_name,
          object_count:
            data?.object_count,
          candidate_count:
            data?.candidate_count,
          candidate_snapshot:
            data?.candidates ||
            [],
          completed_at:
            new Date().toISOString(),
        });

        setSelectedCandidate(
          null
        );

        setPreview(null);
      }
    );

  const chooseCandidate = (
    candidate
  ) => {
    setSelectedCandidate(
      candidate
    );

    setPreview(null);

    setMapping(
      (previous) => ({
        ...previous,
        source_schema:
          candidate.schema_name,
        source_object:
          candidate.object_name,
        invoice_reference_column:
          '',
        client_document_column:
          '',
        client_external_id_column:
          '',
        total_amount_column:
          '',
        paid_amount_column:
          '',
        balance_amount_column:
          '',
        status_column:
          '',
        due_date_column:
          '',
        currency_column:
          '',
      })
    );
  };

  const previewCandidate = (
    candidate =
      selectedCandidate
  ) => {
    if (!candidate) {
      setError(
        'Selecciona una tabla o vista.'
      );
      return;
    }

    run(
      'preview',
      async () => {
        const response =
          await api.post(
            '/api/service-orders/financial/worldoffice/preview',
            {
              schema_name:
                candidate.schema_name,
              object_name:
                candidate.object_name,
              limit: 3,
            }
          );

        setPreview(
          response.data?.data ||
          null
        );
      }
    );
  };

  const saveMapping = () =>
    run(
      'save',
      async () => {
        const response =
          await api.put(
            '/api/service-orders/financial/worldoffice/mapping',
            {
              ...mapping,
              balance_tolerance:
                Number(
                  mapping.balance_tolerance ||
                  0
                ),
            }
          );

        const saved =
          response.data?.data;

        if (saved) {
          setMapping(
            (previous) => ({
              ...previous,
              active:
                saved.active !==
                false,
            })
          );
        }

        await onMappingChanged?.();
        await load();
      }
    );

  const updateMapping = (
    key,
    value
  ) =>
    setMapping(
      (previous) => ({
        ...previous,
        [key]:
          value,
      })
    );

  const selectField = (
    label,
    key,
    required = false
  ) => (
    <label>
      <span className="text-sm font-semibold">
        {label}
        {required
          ? ' *'
          : ''}
      </span>

      <select
        value={
          mapping[key] ||
          ''
        }
        onChange={(
          event
        ) =>
          updateMapping(
            key,
            event.target.value
          )
        }
        className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
      >
        <option value="">
          Sin mapear
        </option>

        {columns.map(
          (column) => (
            <option
              key={
                column.name
              }
              value={
                column.name
              }
            >
              {column.name}
              {' · '}
              {column.data_type}
            </option>
          )
        )}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[155] bg-black/70 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[96dvh] sm:max-w-7xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-blue-600">
              V18 · Solo lectura
            </p>

            <h3 className="text-lg sm:text-xl font-bold">
              Descubrimiento financiero WorldOffice
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Descubre tablas/vistas, previsualiza máximo 3 filas y configura un mapeo sin modificar WorldOffice.
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

          <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />

              <div>
                <p className="font-bold">
                  Barrera read-only
                </p>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Este módulo solo ejecuta SELECT y consultas de catálogo. No reutiliza las rutinas de sincronización que escriben en PostgreSQL y no contiene INSERT, UPDATE o DELETE contra SQL Server.
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs text-slate-500">
                Lectura habilitada
              </p>
              <p className="mt-1 font-bold">
                {status?.config
                  ?.enabled
                  ? 'Sí'
                  : 'No'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs text-slate-500">
                Variables SQL Server
              </p>
              <p className="mt-1 font-bold">
                {status?.config
                  ?.configured
                  ? 'Configuradas'
                  : 'Incompletas'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs text-slate-500">
                Base
              </p>
              <p className="mt-1 font-bold break-words">
                {status?.config
                  ?.database ||
                  discovery?.database_name ||
                  '—'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold">
                    1. Conexión y descubrimiento
                  </h4>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Último análisis: {fmt(
                    discovery?.completed_at
                  )}
                  {' · '}
                  Objetos: {discovery?.object_count ?? '—'}
                  {' · '}
                  Candidatos: {discovery?.candidate_count ?? candidates.length}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={probe}
                  className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 px-4 font-semibold flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Probar conexión
                </button>

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={discover}
                  className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 font-semibold flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Descubrir estructura
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold">
                2. Candidatos financieros
              </h4>

              <p className="mt-1 text-xs text-slate-500">
                La puntuación se basa únicamente en nombres de tabla/vista y columnas. No significa que la tabla sea correcta.
              </p>
            </div>

            <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {candidates.map(
                (
                  candidate
                ) => {
                  const selected =
                    selectedCandidate
                      ?.schema_name ===
                      candidate.schema_name &&
                    selectedCandidate
                      ?.object_name ===
                      candidate.object_name;

                  return (
                    <button
                      type="button"
                      key={`${candidate.schema_name}.${candidate.object_name}`}
                      onClick={() =>
                        chooseCandidate(
                          candidate
                        )
                      }
                      className={`rounded-xl border p-4 text-left ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold break-all">
                            {candidate.schema_name}.{candidate.object_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {candidate.object_type}
                            {' · '}
                            {candidate.columns?.length || 0} columnas
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-bold">
                          {candidate.score}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {(candidate.columns || [])
                          .slice(0, 8)
                          .map(
                            (column) => (
                              <span
                                key={
                                  column.name
                                }
                                className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px]"
                              >
                                {column.name}
                              </span>
                            )
                          )}
                      </div>
                    </button>
                  );
                }
              )}

              {candidates.length ===
                0 && (
                <div className="lg:col-span-2 py-10 text-center text-sm text-slate-500">
                  Ejecuta el descubrimiento para ver tablas y vistas candidatas.
                </div>
              )}
            </div>
          </section>

          {selectedCandidate && (
            <section className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-violet-50/30 dark:bg-violet-950/20 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-bold">
                    3. Previsualización limitada
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedCandidate.schema_name}.{selectedCandidate.object_name}
                    {' · '}
                    máximo 3 filas
                  </p>
                </div>

                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    previewCandidate()
                  }
                  className="w-full sm:w-auto min-h-10 rounded-xl border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 px-3 font-semibold flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver muestra
                </button>
              </div>

              {preview && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <table className="min-w-max w-full text-xs">
                    <thead>
                      <tr>
                        {(preview.preview_columns || []).map(
                          (
                            column
                          ) => (
                            <th
                              key={
                                column
                              }
                              className="px-3 py-2 text-left border-b border-slate-200 dark:border-slate-800"
                            >
                              {column}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {(preview.rows || []).map(
                        (
                          row,
                          index
                        ) => (
                          <tr
                            key={
                              index
                            }
                          >
                            {(preview.preview_columns || []).map(
                              (
                                column
                              ) => (
                                <td
                                  key={
                                    column
                                  }
                                  className="px-3 py-2 border-b border-slate-100 dark:border-slate-900 max-w-xs truncate"
                                  title={String(
                                    row[column] ??
                                    ''
                                  )}
                                >
                                  {String(
                                    row[column] ??
                                    '—'
                                  )}
                                </td>
                              )
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {selectedCandidate && (
            <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 sm:p-5">
              <div>
                <h4 className="font-bold">
                  4. Mapeo financiero
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  V18 solo considera verificación automática segura cuando la consulta devuelve una sola fila y el saldo es cero dentro de la tolerancia.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <label>
                  <span className="text-sm font-semibold">
                    Nombre del perfil
                  </span>

                  <input
                    value={
                      mapping.profile_name
                    }
                    onChange={(
                      event
                    ) =>
                      updateMapping(
                        'profile_name',
                        event.target.value
                      )
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                  />
                </label>

                {selectField(
                  'Referencia factura',
                  'invoice_reference_column',
                  true
                )}

                {selectField(
                  'Documento cliente',
                  'client_document_column'
                )}

                {selectField(
                  'ID externo cliente',
                  'client_external_id_column'
                )}

                {selectField(
                  'Saldo',
                  'balance_amount_column'
                )}

                {selectField(
                  'Total',
                  'total_amount_column'
                )}

                {selectField(
                  'Pagado',
                  'paid_amount_column'
                )}

                {selectField(
                  'Estado',
                  'status_column'
                )}

                {selectField(
                  'Vencimiento',
                  'due_date_column'
                )}

                {selectField(
                  'Moneda',
                  'currency_column'
                )}

                <label>
                  <span className="text-sm font-semibold">
                    Tolerancia saldo
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      mapping.balance_tolerance
                    }
                    onChange={(
                      event
                    ) =>
                      updateMapping(
                        'balance_tolerance',
                        event.target.value
                      )
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-sm font-semibold">
                  Nota de validación
                </span>

                <textarea
                  rows={2}
                  value={
                    mapping.note
                  }
                  onChange={(
                    event
                  ) =>
                    updateMapping(
                      'note',
                      event.target.value
                    )
                  }
                  placeholder="Ej: Validado contra factura real de prueba..."
                  className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </label>

              <label className="mt-3 min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={
                    mapping.active
                  }
                  onChange={(
                    event
                  ) =>
                    updateMapping(
                      'active',
                      event.target.checked
                    )
                  }
                  className="mt-0.5 w-5 h-5"
                />

                <span>
                  <span className="block text-sm font-semibold">
                    Activar este mapeo
                  </span>
                  <span className="block mt-0.5 text-xs text-slate-500">
                    Solo puede existir un mapeo activo. Sigue en modo observation_only.
                  </span>
                </span>
              </label>

              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={
                  saveMapping
                }
                className="mt-4 w-full sm:w-auto min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar y validar mapeo
              </button>
            </section>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2 sm:justify-between">
          <p className="text-xs text-slate-500 self-center">
            No se muestran ni almacenan credenciales SQL Server.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5"
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}
