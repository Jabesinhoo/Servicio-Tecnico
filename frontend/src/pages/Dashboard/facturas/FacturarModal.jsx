// src/pages/Dashboard/facturas/FacturarModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const FacturarModal = ({ isOpen, onClose, onSuccess }) => {
  const [serviceOrders, setServiceOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchServiceOrders();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOrders(serviceOrders);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = serviceOrders.filter(os =>
        os.codigo_os?.toLowerCase().includes(term) ||
        os.Client?.razon_social?.toLowerCase().includes(term) ||
        `${os.Client?.primer_nombre || ''} ${os.Client?.primer_apellido || ''}`.toLowerCase().includes(term)
      );
      setFilteredOrders(filtered);
    }
  }, [searchTerm, serviceOrders]);

  const fetchServiceOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/service-orders?estado=cerrada');
      setServiceOrders(res.data.data || []);
      setFilteredOrders(res.data.data || []);
    } catch (error) {
      console.error('Error fetching service orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFacturar = async () => {
    if (!selectedOrder) {
      setError('Seleccione una orden de servicio');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      await api.post(`/api/invoices/service-order/${selectedOrder.id}`);
      onSuccess();
      onClose();
      setSelectedOrder(null);
      setSearchTerm('');
    } catch (error) {
      setError(error.response?.data?.message || 'Error al facturar');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Facturar Servicio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buscar Orden de Servicio
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Código OS o nombre del cliente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Cargando órdenes...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay órdenes de servicio disponibles para facturar
            </div>
          ) : (
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {filteredOrders.map((os) => {
                const clienteNombre = os.Client?.razon_social || 
                  `${os.Client?.primer_nombre || ''} ${os.Client?.primer_apellido || ''}`.trim() || '—';

                return (
                  <button
                    key={os.id}
                    type="button"
                    onClick={() => setSelectedOrder(os)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-0 transition-colors ${
                      selectedOrder?.id === os.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{os.codigo_os}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Cliente: {clienteNombre}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${Number(os.total_general || 0).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedOrder && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Orden seleccionada: {selectedOrder.codigo_os}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Total: ${Number(selectedOrder.total_general || 0).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFacturar}
            disabled={!selectedOrder || processing}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {processing ? 'Facturando...' : 'Facturar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacturarModal;