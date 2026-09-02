import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Clock3,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react';
import api from '../../../../services/api';

const labels = {
  client_notified:
    'Cliente notificado',
  final_delivery_confirmed:
    'Entrega final confirmada',
  client_satisfaction:
    'Satisfacción registrada',
  direction_validated:
    'Dirección Técnica validó',
  direction_rejected_rework:
    'Dirección devolvió a reproceso',
  technical_closed:
    'Cierre técnico confirmado',
  handed_to_direction:
    'Entregado a Dirección Técnica',
  direction_received:
    'Dirección Técnica recibió',
  technician_work_logged:
    'Actividad técnica registrada',
  service_team_updated:
    'Equipo técnico actualizado',
  primary_technician_assigned:
    'Técnico principal asignado',
};

const prettify = (value) => {
  if (!value) return 'Evento';

  return (
    labels[value] ||
    String(value)
      .replaceAll('_', ' ')
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
};

const fmt = (value) =>
  value
    ? new Date(
        value
      ).toLocaleString(
        'es-CO',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    : '—';

const compactMetadata = (metadata) => {
  if (
    !metadata ||
    typeof metadata !==
      'object'
  ) {
    return [];
  }

  return Object.entries(
    metadata
  )
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== ''
    )
    .slice(0, 8);
};

export default function AuditTimelineModal({
  service,
  onClose,
}) {
  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

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
            `/api/service-orders/${service.id}/audit-timeline`
          );

        setItems(
          Array.isArray(
            response.data?.data
          )
            ? response.data.data
            : []
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar la auditoría'
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

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-[145] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-violet-600">
              {service.codigo_os}
            </p>

            <h3 className="text-lg sm:text-xl font-bold">
              Auditoría integral
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Eventos, custodia, trabajo técnico, cierre y entrega.
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

        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={load}
            className="w-full sm:w-auto min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Actualizar
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6"
          style={{
            WebkitOverflowScrolling:
              'touch',
          }}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading &&
          items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              Cargando auditoría...
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="space-y-4">
                {items.map(
                  (item, index) => (
                    <article
                      key={`${item.created_at}-${item.event_type}-${index}`}
                      className="relative pl-10"
                    >
                      <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold">
                              {prettify(
                                item.event_type
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {item.actor_name ||
                                'Sistema'}
                              {' · '}
                              {item.source}
                            </p>
                          </div>

                          <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                            <Clock3 className="w-3 h-3" />
                            {fmt(
                              item.created_at
                            )}
                          </span>
                        </div>

                        {compactMetadata(
                          item.metadata
                        ).length >
                          0 && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {compactMetadata(
                              item.metadata
                            ).map(
                              ([
                                key,
                                value,
                              ]) => (
                                <div
                                  key={key}
                                  className="rounded-lg bg-slate-50 dark:bg-slate-950/40 p-2 min-w-0"
                                >
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500 break-all">
                                    {key.replaceAll(
                                      '_',
                                      ' '
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs sm:text-sm break-words whitespace-pre-wrap">
                                    {typeof value ===
                                    'object'
                                      ? JSON.stringify(
                                          value
                                        )
                                      : String(
                                          value
                                        )}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                )}

                {items.length ===
                  0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                    No hay eventos de auditoría para esta orden.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4">
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
