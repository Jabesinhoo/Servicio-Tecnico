import "../responsive.css";
import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  ShoppingCart,
  Search,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

const Ventas = () => {
  // =========================
  // UI / Estado principal
  // =========================
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");

  // Orden actual (OV)
  const [clientId, setClientId] = useState("");
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");

  // =========================
  // Debounce de búsqueda
  // =========================
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 450);
    return () => clearTimeout(t);
  }, [query]);

  // =========================
  // Buscar en WooCommerce vía backend
  // =========================
  useEffect(() => {
    const run = async () => {
      setSearchError("");
      setResults([]);

      if (!debounced || debounced.length < 2) return;

      try {
        setLoadingSearch(true);
        const res = await api.get(`/catalog/search?q=${encodeURIComponent(debounced)}`);
        setResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setSearchError("No se pudo consultar productos. Verifica conexión con WooCommerce.");
        setResults([]);
      } finally {
        setLoadingSearch(false);
      }
    };

    run();
  }, [debounced]);

  // =========================
  // Totales (solo UI)
  // =========================
  const totals = useMemo(() => {
    const total = items.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
    return { total };
  }, [items]);

  // =========================
  // Crear OV en borrador
  // =========================
  const createDraftOrder = async () => {
    if (!clientId.trim()) {
      setActionErr("Debes ingresar el ID del cliente para crear la OV.");
      return null;
    }

    try {
      setActionErr("");
      setActionMsg("");
      setLoadingOrder(true);

      const res = await api.post("/sales-orders", { client_id: clientId.trim() });
      setOrder(res.data);
      setItems([]); // vacía visual hasta que se agreguen items
      setActionMsg("OV creada en borrador ✅");
      return res.data;
    } catch (err) {
      setActionErr("No se pudo crear la OV. Revisa el client_id o el backend.");
      return null;
    } finally {
      setLoadingOrder(false);
    }
  };

  // =========================
  // Refrescar OV (items + totales)
  // =========================
  const refreshOrder = async (orderId) => {
    try {
      const res = await api.get(`/sales-orders/${orderId}`);
      setOrder(res.data);
      // Sequelize suele devolver SalesOrderItems:
      setItems(res.data?.SalesOrderItems || []);
    } catch (err) {
      // silent
    }
  };

  // =========================
  // Agregar item a la OV
  // =========================
  const addItem = async (product) => {
    try {
      setActionErr("");
      setActionMsg("");

      let currentOrder = order;
      if (!currentOrder) {
        currentOrder = await createDraftOrder();
        if (!currentOrder) return;
      }

      const cantidad = 1;
      const requiere_servicio = false;

      setLoadingOrder(true);
      await api.post(`/sales-orders/${currentOrder.id}/items`, {
        sku: product.sku,
        cantidad,
        requiere_servicio,
      });

      await refreshOrder(currentOrder.id);
      setActionMsg(`Agregado: ${product.nombre} ✅`);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "No se pudo agregar el producto. Revisa stock o conexión.";
      setActionErr(msg);
    } finally {
      setLoadingOrder(false);
    }
  };

  // =========================
  // Eliminar item
  // =========================
  const removeItem = async (itemId) => {
    if (!order) return;

    try {
      setActionErr("");
      setActionMsg("");
      setLoadingOrder(true);

      await api.delete(`/sales-orders/${order.id}/items/${itemId}`);
      await refreshOrder(order.id);

      setActionMsg("Producto eliminado ✅");
    } catch (err) {
      setActionErr("No se pudo eliminar el item.");
    } finally {
      setLoadingOrder(false);
    }
  };

  // =========================
  // Confirmar OV
  // =========================
  const confirmOrder = async () => {
    if (!order) return;

    try {
      setActionErr("");
      setActionMsg("");
      setLoadingOrder(true);

      const res = await api.post(`/sales-orders/${order.id}/confirm`);
      await refreshOrder(order.id);

      if (res.data?.serviceOrder) {
        setActionMsg(
          `OV confirmada ✅ Se creó una OS automática: ${res.data.serviceOrder.codigo_os}`
        );
      } else {
        setActionMsg("OV confirmada ✅");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || "No se pudo confirmar la OV.";
      setActionErr(msg);
    } finally {
      setLoadingOrder(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />
        <div className="p-4 sm:p-6 sm:p-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Módulo de Ventas
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Busca productos desde tu web (WooCommerce), arma una OV y confirma la venta.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <ShoppingCart className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Ventas / OV
            </span>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {(actionErr || actionMsg) && (
        <div
          className={`rounded-2xl border p-4 ${
            actionErr
              ? "bg-rose-50 dark:bg-rose-900/15 border-rose-200 dark:border-rose-800"
              : "bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800"
          }`}
        >
          <div className="flex items-start gap-3">
            {actionErr ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300 mt-0.5" />
            )}
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {actionErr || actionMsg}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Catálogo */}
        <div className="lg:col-span-2 space-y-6">
          {/* Buscar productos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-500" />
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Buscar productos (WooCommerce)
                </h2>
              </div>

              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                mínimo 2 letras
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca por nombre o escribe el SKU..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                />
              </div>

              {searchError && (
                <div className="mt-4 text-sm font-semibold text-rose-600 dark:text-rose-300">
                  {searchError}
                </div>
              )}

              <div className="mt-5">
                {loadingSearch ? (
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <div className="h-5 w-5 rounded-full border-b-2 border-sky-500 animate-spin" />
                    Buscando productos...
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Escribe para buscar productos y ver resultados aquí.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.map((p) => (
                      <div
                        key={`${p.id}-${p.sku}`}
                        className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:shadow-sm transition bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                            {p.imagen ? (
                              <img
                                src={p.imagen}
                                alt={p.nombre}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {p.nombre}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              SKU: <span className="font-semibold">{p.sku || "—"}</span>
                            </p>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                                ${Number(p.precio || 0).toFixed(2)}
                              </div>
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Stock:{" "}
                                {p.stock === null || p.stock === undefined ? (
                                  <span className="text-slate-500">No controlado</span>
                                ) : (
                                  <span
                                    className={`${
                                      p.stock > 0
                                        ? "text-emerald-600 dark:text-emerald-300"
                                        : "text-rose-600 dark:text-rose-300"
                                    }`}
                                  >
                                    {p.stock}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => addItem(p)}
                              disabled={loadingOrder}
                              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 transition disabled:opacity-60"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar a la OV
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: OV actual */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Orden de Venta
              </h2>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* client_id */}
              <div className="space-y-2">
                <label className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                  ID del Cliente (por ahora manual)
                </label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Pega el UUID del cliente..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Luego te pongo selector real de clientes (por nombre/documento).
                </p>
              </div>

              {/* Estado de orden */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Estado
                  </p>
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {order?.estado || "sin OV"}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  OV: <span className="font-semibold">{order?.numero_ov || "—"}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Productos agregados
                </p>

                {items.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Aún no agregas productos.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {it.nombre_producto}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              SKU: <span className="font-semibold">{it.sku}</span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Cantidad: <span className="font-semibold">{it.cantidad}</span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Subtotal:{" "}
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                ${Number(it.subtotal || 0).toFixed(2)}
                              </span>
                            </p>
                          </div>

                          <button
                            onClick={() => removeItem(it.id)}
                            disabled={loadingOrder}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-300" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totales */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Total
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                    ${totals.total.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={createDraftOrder}
                  disabled={loadingOrder || !!order}
                  className={`w-full py-3 rounded-xl font-extrabold transition ${
                    order
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700"
                  }`}
                >
                  Crear OV en borrador
                </button>

                <button
                  onClick={confirmOrder}
                  disabled={loadingOrder || !order || items.length === 0 || order?.estado !== "borrador"}
                  className={`w-full py-3 rounded-xl font-extrabold transition ${
                    !order || items.length === 0 || order?.estado !== "borrador"
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  }`}
                >
                  Confirmar OV
                </button>

                {loadingOrder && (
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <div className="h-5 w-5 rounded-full border-b-2 border-sky-500 animate-spin" />
                    Procesando...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nota */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            ✅ Siguiente mejora: selector de clientes, edición de cantidad por item y switch “requiere servicio”.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ventas;
