import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteServiceModal({ service, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    if (!service) return undefined;

    setError('');
    setResultMessage('');
    setSaving(false);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event) => {
      if (event.key === 'Escape' && !saving) onClose?.();
    };

    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [service, onClose, saving]);

  if (!service) return null;

  const remove = async () => {
    try {
      setSaving(true);
      setError('');
      const response = await onConfirm?.(service);
      setResultMessage(
        response?.message ||
          'La orden fue cancelada correctamente y su historial se conservó.'
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'No fue posible eliminar/cancelar la orden.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/65 p-3 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-red-100 dark:bg-red-950/40 p-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Eliminar servicio
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {service.codigo_os || 'Orden de servicio'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-4">
          {!resultMessage && (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                ¿Seguro que deseas eliminar este servicio de la operación activa?
              </p>

              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-800 dark:text-red-300 space-y-1">
                <p className="font-semibold">Esta acción cancelará la orden.</p>
                <p>• Se liberarán sus bloques activos de agenda.</p>
                <p>• Las asignaciones pendientes serán revocadas.</p>
                <p>• El historial y la trazabilidad se conservarán.</p>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {resultMessage && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/25 p-4 text-sm text-emerald-800 dark:text-emerald-300">
              {resultMessage}
            </div>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          {resultMessage ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {saving ? 'Eliminando...' : 'Eliminar servicio'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
