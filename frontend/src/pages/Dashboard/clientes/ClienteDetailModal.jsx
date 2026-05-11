// src/pages/Dashboard/clientes/ClienteDetailModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, TrendingUp, Clock, Package, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../../services/api';

const ClienteDetailModal = ({ isOpen, onClose, clienteId, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [servicios, setServicios] = useState([]);

  useEffect(() => {
    if (isOpen && clienteId) {
      fetchClienteStats();
      fetchServicios();
    }
  }, [isOpen, clienteId]);

  const fetchClienteStats = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/clients/${clienteId}/stats`);
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching client stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServicios = async () => {
    try {
      const res = await api.get(`/api/clients/${clienteId}/service-orders`);
      setServicios(res.data || []);
    } catch (error) {
      console.error('Error fetching servicios:', error);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {stats?.cliente?.nombre_razon_social}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats?.cliente?.documento || 'Sin documento'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Métricas Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500">Total Servicios</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalServicios || 0}</p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-500">Total Generado</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${stats?.totalGenerado?.toLocaleString() || 0}</p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-gray-500">Servicios Completados</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.serviciosCompletados || 0}</p>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-gray-500">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.serviciosPendientes || 0}</p>
            </div>
          </div>

          {/* Información Financiera */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Información Financiera
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Promedio por Servicio</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">${stats?.promedioPorServicio?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Servicio Más Caro</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">${stats?.servicioMasCaro?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Servicio Más Barato</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">${stats?.servicioMasBarato?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Saldo Pendiente</p>
                <p className="text-sm font-semibold text-red-600">${stats?.saldoPendiente?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          {/* Servicios por Tipo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Servicios por Tipo</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats?.serviciosPorTipo?.map((item) => (
                <div key={item.tipo} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{item.tipo}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.cantidad}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Servicios por Mes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Servicios por Mes</h4>
            <div className="space-y-2">
              {stats?.serviciosPorMes?.map((item) => (
                <div key={item.mes}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.mes_nombre}</span>
                    <span>{item.cantidad} servicios</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 rounded-full h-2" 
                      style={{ width: `${Math.min((item.cantidad / Math.max(...(stats?.serviciosPorMes?.map(m => m.cantidad) || [1]))) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Productos/Repuestos más comprados */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Productos Más Comprados
            </h4>
            <div className="space-y-2">
              {stats?.productosMasComprados?.map((producto) => (
                <div key={producto.producto_id} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{producto.nombre}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{producto.cantidad} unidades</span>
                </div>
              ))}
              {(!stats?.productosMasComprados || stats.productosMasComprados.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No hay productos registrados</p>
              )}
            </div>
          </div>

          {/* Tabla de Servicios Recientes */}
          {servicios.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Últimos Servicios</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2">Código</th>
                      <th className="text-left py-2">Estado</th>
                      <th className="text-left py-2">Fecha</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.slice(0, 5).map((servicio) => (
                      <tr key={servicio.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{servicio.codigo_os}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            servicio.estado === 'cerrada' ? 'bg-green-100 text-green-800' :
                            servicio.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {servicio.estado}
                          </span>
                        </td>
                        <td className="py-2">{new Date(servicio.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right">${servicio.total_general?.toLocaleString() || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClienteDetailModal;