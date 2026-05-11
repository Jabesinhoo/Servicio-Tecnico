// src/pages/Dashboard/servicios/ServicioDetail.jsx
import React, { useState } from 'react';
import api from '../../../services/api';
import { X, User, Clock, Calendar, CheckCircle, AlertCircle, Wrench, Package } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ServicioDetail = ({ isOpen, onClose, servicio, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [repuestos, setRepuestos] = useState([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [newPart, setNewPart] = useState({ product_id: '', cantidad: 1, observaciones: '' });

  if (!isOpen || !servicio) return null;

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post(`/api/service-orders/${servicio.id}/parts`, newPart);
      setShowAddPart(false);
      setNewPart({ product_id: '', cantidad: 1, observaciones: '' });
      onRefresh();
    } catch (error) {
      console.error('Error adding part:', error);
      alert('Error al agregar repuesto');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (newStatus) => {
    try {
      setLoading(true);
      await api.patch(`/api/service-orders/${servicio.id}/status`, { estado: newStatus });
      onRefresh();
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {servicio.codigo_os}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Creado: {new Date(servicio.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={servicio.estado} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Información del Cliente */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Cliente
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Nombre/Razón Social</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.cliente_nombre || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Documento</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.cliente_documento || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.cliente_telefono || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.cliente_email || '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Dirección</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.cliente_direccion || '—'}</p>
              </div>
            </div>
          </div>

          {/* Información del Servicio */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Información del Servicio
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Técnico Asignado</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.tecnico_nombre || 'Sin asignar'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fecha Asignación</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {servicio.fecha_asignacion ? new Date(servicio.fecha_asignacion).toLocaleString() : '—'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Descripción Inicial</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.descripcion_inicial || '—'}</p>
              </div>
              {servicio.diagnostico_final && (
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Diagnóstico Final</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.diagnostico_final}</p>
                </div>
              )}
              {servicio.observaciones && (
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Observaciones</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{servicio.observaciones}</p>
                </div>
              )}
            </div>
          </div>

          {/* Acciones según estado */}
          <div className="flex flex-wrap gap-3">
            {servicio.estado === 'pendiente' && (
              <button
                onClick={() => handleChangeStatus('asignada')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Asignar Servicio
              </button>
            )}
            {servicio.estado === 'asignada' && (
              <button
                onClick={() => handleChangeStatus('en_ejecucion')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                Iniciar Servicio
              </button>
            )}
            {servicio.estado === 'en_ejecucion' && (
              <>
                <button
                  onClick={() => setShowAddPart(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
                >
                  <Package className="w-4 h-4 inline mr-1" />
                  Agregar Repuesto
                </button>
                <button
                  onClick={() => handleChangeStatus('cerrada')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Completar Servicio
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modal para agregar repuesto */}
        {showAddPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agregar Repuesto</h3>
                <button onClick={() => setShowAddPart(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddPart}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Producto ID
                    </label>
                    <input
                      type="text"
                      value={newPart.product_id}
                      onChange={(e) => setNewPart({ ...newPart, product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newPart.cantidad}
                      onChange={(e) => setNewPart({ ...newPart, cantidad: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Observaciones
                    </label>
                    <textarea
                      value={newPart.observaciones}
                      onChange={(e) => setNewPart({ ...newPart, observaciones: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddPart(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicioDetail;