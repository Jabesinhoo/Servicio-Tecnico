import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../../../services/api';

const TYPE_LABELS = {
  reception_act:
    'Acta de recepción',
  technical_closure:
    'Acta de cierre técnico',
  final_delivery:
    'Acta de entrega final',
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

const fileSize = (bytes) => {
  const value =
    Number(bytes || 0);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '—';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    1024 /
    1024
  ).toFixed(1)} MB`;
};

export default function ServiceDocumentsModal({
  service,
  isAdmin,
  onClose,
}) {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [busyType, setBusyType] =
    useState('');

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
            `/api/service-orders/${service.id}/documents`
          );

        setData(
          response.data?.data ||
          null
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar documentos formales'
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

  const documents =
    Array.isArray(
      data?.documents
    )
      ? data.documents
      : [];

  const availableTypes =
    Array.isArray(
      data?.available_types
    )
      ? data.available_types
      : Object.keys(
          TYPE_LABELS
        ).map(
          (key) => ({
            key,
            label:
              TYPE_LABELS[key],
          })
        );

  const grouped =
    useMemo(() => {
      const result =
        new Map();

      for (
        const document of
        documents
      ) {
        if (
          !result.has(
            document.document_type
          )
        ) {
          result.set(
            document.document_type,
            []
          );
        }

        result
          .get(
            document.document_type
          )
          .push(
            document
          );
      }

      return result;
    }, [documents]);

  const generate =
    async (
      documentType
    ) => {
      try {
        setBusyType(
          documentType
        );
        setError('');

        await api.post(
          `/api/service-orders/${service.id}/documents/${documentType}/generate`
        );

        await load();
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible generar el PDF formal'
        );
      } finally {
        setBusyType('');
      }
    };

  const openDocument =
    async (document) => {
      try {
        setError('');

        const response =
          await api.get(
            `/api/service-orders/${service.id}/documents/${document.id}/file`,
            {
              responseType:
                'blob',
            }
          );

        const blob =
          response.data;

        const url =
          URL.createObjectURL(
            blob
          );

        window.open(
          url,
          '_blank',
          'noopener,noreferrer'
        );

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          60000
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible abrir el documento'
        );
      }
    };

  if (!service) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[146] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold text-blue-600">
              {service.codigo_os}
            </p>

            <h3 className="text-lg sm:text-xl font-bold">
              Documentos formales
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              PDFs versionados, inmutables y auditables.
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
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
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

          <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />

              <div className="text-sm">
                <p className="font-bold">
                  Control documental V16
                </p>

                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Cada regeneración crea una nueva versión con SHA-256 y conserva las versiones anteriores.
                </p>
              </div>
            </div>
          </div>

          {loading &&
          documents.length ===
            0 ? (
            <div className="py-12 text-center text-slate-500">
              Cargando documentos...
            </div>
          ) : (
            availableTypes.map(
              (type) => {
                const versions =
                  grouped.get(
                    type.key
                  ) || [];

                const latest =
                  versions[0] ||
                  null;

                return (
                  <section
                    key={
                      type.key
                    }
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />

                          <h4 className="font-bold">
                            {type.label ||
                              TYPE_LABELS[
                                type.key
                              ] ||
                              type.key}
                          </h4>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {latest
                            ? `Última versión: v${latest.version} · ${fmt(
                                latest.generated_at
                              )}`
                            : 'Todavía no se ha generado.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          generate(
                            type.key
                          )
                        }
                        disabled={
                          busyType ===
                          type.key
                        }
                        className="w-full lg:w-auto min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
                      >
                        <FileCheck2 className="w-4 h-4" />

                        {busyType ===
                        type.key
                          ? 'Generando...'
                          : latest
                            ? 'Generar nueva versión'
                            : 'Generar PDF'}
                      </button>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800">
                      {versions.length >
                      0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {versions.map(
                            (
                              document
                            ) => (
                              <article
                                key={
                                  document.id
                                }
                                className="p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm">
                                      v{document.version}
                                    </span>

                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        document.status ===
                                        'generated'
                                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      {document.status ===
                                      'generated'
                                        ? 'VIGENTE'
                                        : 'HISTÓRICO'}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-xs text-slate-500 break-all">
                                    {fmt(
                                      document.generated_at
                                    )}
                                    {' · '}
                                    {fileSize(
                                      document.size_bytes
                                    )}
                                    {' · SHA-256 '}
                                    {String(
                                      document.sha256 ||
                                        ''
                                    ).slice(
                                      0,
                                      12
                                    )}
                                    …
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openDocument(
                                      document
                                    )
                                  }
                                  className="w-full sm:w-auto min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  Abrir PDF
                                </button>
                              </article>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="p-5 text-center text-sm text-slate-500">
                          Sin versiones.
                        </div>
                      )}
                    </div>
                  </section>
                );
              }
            )
          )}

          {!isAdmin && (
            <p className="text-xs text-slate-500">
              Los requisitos de cada documento se validan en el servidor. El acta de entrega final solo puede generarla administración.
            </p>
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
    </div>
  );
}
