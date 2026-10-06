import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../../../services/api';

const STATUS_LABELS = {
  solicitado: 'Solicitado',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  entrega_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  en_uso: 'En uso',
  consumido: 'Consumido',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado',
};

const STATUS_CLASSES = {
  solicitado: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  aprobado: 'accent-soft accent-text dark:accent-soft dark:accent-text',
  rechazado: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  entrega_parcial: 'accent-soft accent-text dark:accent-soft dark:accent-text',
  entregado: 'accent-soft accent-text dark:accent-soft dark:accent-text',
  en_uso: 'accent-soft accent-text dark:accent-soft dark:accent-text',
  consumido: 'accent-soft accent-text dark:accent-soft dark:accent-text',
  devuelto: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

function unwrapArray(response) {
  const value = response?.data;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_CLASSES[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {STATUS_LABELS[status] || status || 'Sin estado'}
    </span>
  );
}

function ModalShell({ title, children, onClose, busy, footer }) {
  return (
    <div className="workflow-theme fixed inset-0 z-[240] bg-black/65 p-3 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer && (
          <footer className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export default function MaterialesPanel({ servicioId, onRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [requestQty, setRequestQty] = useState(1);
  const [requestNote, setRequestNote] = useState('');
  const [requestError, setRequestError] = useState('');

  const [actionQty, setActionQty] = useState(1);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const role = user?.rol || user?.role?.name || '';
  const canRequest = role === 'admin' || role === 'tecnico';
  const canManage = role === 'admin' || role === 'inventario';
  const canUse = role === 'admin' || role === 'tecnico';

  const load = async () => {
    if (!servicioId) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/materiales/servicio/${servicioId}`);
      setItems(unwrapArray(response));
    } catch (requestErrorValue) {
      setItems([]);
      setError(
        requestErrorValue?.response?.data?.message ||
          'No fue posible cargar los materiales del servicio.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [servicioId]);

  useEffect(() => {
    if (!showRequest) return undefined;

    const timer = window.setTimeout(async () => {
      try {
        setProductsLoading(true);
        const response = await api.get('/api/products', {
          params: {
            search: productQuery.trim() || undefined,
            q: productQuery.trim() || undefined,
            limit: 100,
          },
        });

        const rows = unwrapArray(response)
          .filter((item) => item && item.estado !== false && item.tipo !== 'servicio')
          .filter((item) => {
            const query = productQuery.trim().toLowerCase();
            if (!query) return true;
            return [item.codigo, item.nombre, item.proveedor]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query));
          })
          .slice(0, 50);

        setProducts(rows);
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [showRequest, productQuery]);

  const closeRequest = () => {
    setShowRequest(false);
    setSelectedProduct(null);
    setProductQuery('');
    setProducts([]);
    setRequestQty(1);
    setRequestNote('');
    setRequestError('');
  };

  const submitRequest = async () => {
    if (!selectedProduct?.id) {
      setRequestError('Selecciona un producto del inventario.');
      return;
    }

    const qty = Number(requestQty);
    if (!Number.isInteger(qty) || qty < 1) {
      setRequestError('La cantidad debe ser mayor que cero.');
      return;
    }

    if (qty > Number(selectedProduct.stock_actual || 0)) {
      setRequestError(`Solo hay ${Number(selectedProduct.stock_actual || 0)} unidad(es) disponibles.`);
      return;
    }

    try {
      setBusy(true);
      setRequestError('');
      await api.post(`/api/materiales/servicio/${servicioId}/solicitar`, {
        product_id: selectedProduct.id,
        cantidad: qty,
        observaciones: requestNote.trim() || null,
      });
      closeRequest();
      await load();
      onRefresh?.();
    } catch (requestErrorValue) {
      setRequestError(
        requestErrorValue?.response?.data?.message ||
          'No fue posible solicitar el material.'
      );
    } finally {
      setBusy(false);
    }
  };

  const openAction = (type, item) => {
    setAction({ type, item });
    setActionError('');
    setActionReason('');

    const approved = Number(item.cantidad_aprobada || item.cantidad_solicitada || 0);
    const delivered = Number(item.cantidad_entregada || 0);
    const used = Number(item.cantidad_usada || 0);
    const returned = Number(item.cantidad_devuelta || 0);

    if (type === 'approve') setActionQty(Number(item.cantidad_solicitada || 1));
    else if (type === 'deliver') setActionQty(Math.max(1, approved - delivered));
    else if (type === 'use' || type === 'return') {
      setActionQty(Math.max(1, delivered - used - returned));
    } else setActionQty(1);
  };

  const closeAction = () => {
    setAction(null);
    setActionError('');
    setActionReason('');
    setActionQty(1);
  };

  const submitAction = async () => {
    if (!action?.item?.id) return;

    try {
      setBusy(true);
      setActionError('');

      const id = action.item.id;
      const qty = Number(actionQty);

      if (action.type === 'approve') {
        await api.put(`/api/materiales/${id}/aprobar`, { cantidad: qty });
      } else if (action.type === 'reject') {
        if (actionReason.trim().length < 3) {
          setActionError('Indica el motivo del rechazo.');
          return;
        }
        await api.put(`/api/materiales/${id}/rechazar`, { motivo: actionReason.trim() });
      } else if (action.type === 'deliver') {
        await api.put(`/api/materiales/${id}/entregar`, { cantidad: qty });
      } else if (action.type === 'use') {
        await api.put(`/api/materiales/${id}/usar`, { cantidad: qty });
      } else if (action.type === 'return') {
        await api.put(`/api/materiales/${id}/devolver`, { cantidad: qty });
      }

      closeAction();
      await load();
      onRefresh?.();
    } catch (requestErrorValue) {
      setActionError(
        requestErrorValue?.response?.data?.message ||
          'No fue posible completar la operación.'
      );
    } finally {
      setBusy(false);
    }
  };

  const actionTitle = {
    approve: 'Aprobar material',
    reject: 'Rechazar material',
    deliver: 'Entregar material',
    use: 'Registrar consumo',
    return: 'Devolver al inventario',
  }[action?.type];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Package className="w-4 h-4" /> Materiales y repuestos
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            El producto sale del inventario local. El stock se descuenta cuando Inventario/Admin registra la entrega, no al solicitarlo.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          {canRequest && (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="px-3 py-2 rounded-xl accent-fill text-white text-sm font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Solicitar material
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Cargando materiales...</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <Package className="w-8 h-8 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No hay materiales solicitados para esta orden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const delivered = Number(item.cantidad_entregada || 0);
            const used = Number(item.cantidad_usada || 0);
            const returned = Number(item.cantidad_devuelta || 0);
            const available = Math.max(0, delivered - used - returned);

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950/30"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold">{item.producto_nombre || 'Producto'}</h4>
                      <StatusBadge status={item.estado} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.producto_codigo || 'Sin código'} · stock actual {Number(item.stock_actual || 0)}
                    </p>
                    {item.observaciones && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{item.observaciones}</p>
                    )}
                    {item.motivo_rechazo && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        Motivo de rechazo: {item.motivo_rechazo}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center shrink-0">
                    {[
                      ['Solicitado', item.cantidad_solicitada],
                      ['Aprobado', item.cantidad_aprobada ?? '—'],
                      ['Entregado', delivered],
                      ['Usado', used],
                      ['Devuelto', returned],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2 min-w-20">
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="font-bold">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    Solicitado por {item.solicitado_por_nombre || 'usuario'} · {formatDateTime(item.solicitado_at || item.created_at)}
                    {available > 0 ? ` · ${available} unidad(es) entregadas sin consumir` : ''}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canManage && item.estado === 'solicitado' && (
                      <>
                        <button onClick={() => openAction('approve', item)} className="px-3 py-1.5 rounded-lg accent-fill text-white text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" />Aprobar</button>
                        <button onClick={() => openAction('reject', item)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Rechazar</button>
                      </>
                    )}

                    {canManage && ['aprobado', 'entrega_parcial'].includes(item.estado) && (
                      <button onClick={() => openAction('deliver', item)} className="px-3 py-1.5 rounded-lg accent-fill text-white text-xs font-semibold flex items-center gap-1"><Send className="w-3.5 h-3.5" />Entregar</button>
                    )}

                    {canUse && available > 0 && ['entregado', 'en_uso'].includes(item.estado) && (
                      <button onClick={() => openAction('use', item)} className="px-3 py-1.5 rounded-lg accent-fill text-white text-xs font-semibold">Registrar uso</button>
                    )}

                    {canManage && available > 0 && ['entregado', 'en_uso'].includes(item.estado) && (
                      <button onClick={() => openAction('return', item)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-semibold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Devolver</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showRequest && (
        <ModalShell
          title="Solicitar material"
          onClose={closeRequest}
          busy={busy}
          footer={
            <>
              <button type="button" onClick={closeRequest} disabled={busy} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold">Cancelar</button>
              <button type="button" onClick={submitRequest} disabled={busy || !selectedProduct} className="px-4 py-2 rounded-xl accent-fill text-white font-semibold disabled:opacity-50">{busy ? 'Solicitando...' : 'Solicitar'}</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Buscar producto en inventario *</label>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  value={productQuery}
                  onChange={(event) => {
                    setProductQuery(event.target.value);
                    setSelectedProduct(null);
                  }}
                  placeholder="Código, nombre o proveedor..."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2"
                />
              </div>

              <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {productsLoading ? (
                  <p className="p-3 text-sm text-gray-500">Buscando...</p>
                ) : products.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">No se encontraron productos disponibles.</p>
                ) : (
                  products.map((product) => {
                    const stock = Number(product.stock_actual || 0);
                    const disabled = stock <= 0;
                    const selected = selectedProduct?.id === product.id;
                    return (
                      <button
                        type="button"
                        key={product.id}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedProduct(product);
                          setRequestQty(1);
                          setRequestError('');
                        }}
                        className={`w-full p-3 text-left disabled:opacity-45 ${selected ? 'accent-soft dark:accent-soft' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{product.nombre}</p>
                            <p className="text-xs text-gray-500">{product.codigo || 'Sin código'}{product.proveedor ? ` · ${product.proveedor}` : ''}</p>
                          </div>
                          <span className={`text-xs font-bold ${stock > 0 ? 'accent-text' : 'text-red-500'}`}>Stock: {stock}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedProduct && (
              <div className="rounded-xl accent-soft dark:accent-soft border accent-border dark:accent-border p-3 text-sm">
                <strong>{selectedProduct.nombre}</strong>
                <div className="text-xs accent-text dark:accent-text mt-1">Disponible: {Number(selectedProduct.stock_actual || 0)} unidad(es)</div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-semibold">Cantidad *</span>
              <input
                type="number"
                min="1"
                max={selectedProduct ? Number(selectedProduct.stock_actual || 1) : undefined}
                value={requestQty}
                onChange={(event) => setRequestQty(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">Observaciones</span>
              <textarea
                rows={4}
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Ej: Reemplazo del SSD diagnosticado con falla."
                className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
              />
            </label>

            {requestError && <div className="rounded-xl bg-red-50 dark:bg-red-950/25 p-3 text-sm text-red-700 dark:text-red-300">{requestError}</div>}
          </div>
        </ModalShell>
      )}

      {action && (
        <ModalShell
          title={actionTitle}
          onClose={closeAction}
          busy={busy}
          footer={
            <>
              <button type="button" onClick={closeAction} disabled={busy} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold">Cancelar</button>
              <button type="button" onClick={submitAction} disabled={busy} className="px-4 py-2 rounded-xl accent-fill text-white font-semibold disabled:opacity-50">{busy ? 'Guardando...' : 'Confirmar'}</button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3">
              <p className="font-semibold">{action.item.producto_nombre}</p>
              <p className="text-xs text-gray-500">{action.item.producto_codigo || 'Sin código'}</p>
            </div>

            {action.type === 'reject' ? (
              <label className="block">
                <span className="text-sm font-semibold">Motivo del rechazo *</span>
                <textarea rows={4} value={actionReason} onChange={(event) => setActionReason(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2" />
              </label>
            ) : (
              <label className="block">
                <span className="text-sm font-semibold">Cantidad *</span>
                <input type="number" min="1" value={actionQty} onChange={(event) => setActionQty(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2" />
              </label>
            )}

            {actionError && <div className="rounded-xl bg-red-50 dark:bg-red-950/25 p-3 text-sm text-red-700 dark:text-red-300">{actionError}</div>}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
