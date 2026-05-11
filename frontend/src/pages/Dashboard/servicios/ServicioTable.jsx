// src/pages/Dashboard/servicios/ServicioTable.jsx
import React from 'react';
import { Eye, User, Play, CheckCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ServicioTable = ({ servicios, loading, onViewDetail, onAssignTech, onStartService, onCompleteService, userRole }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Cargando servicios...</p>
      </div>
    );
  }

  if (!servicios || servicios.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">No hay órdenes de servicio</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Técnico</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {servicios.map((servicio) => (
            <tr key={servicio.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {servicio.codigo_os}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                {servicio.cliente_nombre || '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                {servicio.tecnico_nombre || 'Sin asignar'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={servicio.estado} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {new Date(servicio.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewDetail(servicio.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 transition-colors"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {userRole === 'admin' && !servicio.tecnico_nombre && servicio.estado === 'pendiente' && (
                    <button
                      onClick={() => onAssignTech(servicio.id)}
                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 transition-colors"
                      title="Asignar técnico"
                    >
                      <User className="w-4 h-4" />
                    </button>
                  )}
                  {userRole === 'tecnico' && servicio.estado === 'asignada' && (
                    <button
                      onClick={() => onStartService(servicio.id)}
                      className="text-green-600 hover:text-green-800 dark:text-green-400 transition-colors"
                      title="Iniciar servicio"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {userRole === 'tecnico' && servicio.estado === 'en_ejecucion' && (
                    <button
                      onClick={() => onCompleteService(servicio.id)}
                      className="text-green-600 hover:text-green-800 dark:text-green-400 transition-colors"
                      title="Completar servicio"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServicioTable;