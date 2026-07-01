// src/pages/Dashboard/facturas/components/FacturaTable.jsx
import React from 'react';
import { Eye, CheckCircle, XCircle, FileText } from 'lucide-react';

const estadoColors = {
  borrador: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  emitida: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pagada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  anulada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const estadoLabels = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  pagada: 'Pagada',
  anulada: 'Anulada',
};

const FacturaTable = ({ facturas, loading, onViewDetail, onCancel, onMarkPaid, canEdit }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Cargando facturas...</p>
      </div>
    );
  }

  if (!facturas || facturas.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No hay facturas registradas</p>
        <p className="text-sm text-gray-400 mt-1">Haz clic en "Nueva Factura" para comenzar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">N° Factura</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {facturas.map((factura) => {
            const clienteNombre = factura.Client?.razon_social || 
              `${factura.Client?.primer_nombre || ''} ${factura.Client?.primer_apellido || ''}`.trim() || '—';

            return (
              <tr key={factura.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                  {factura.numero_factura}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {clienteNombre}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                  ${Number(factura.total_general).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${estadoColors[factura.estado]}`}>
                    {estadoLabels[factura.estado]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(factura.fecha_emision).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewDetail(factura.id)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && factura.estado === 'emitida' && (
                      <>
                        <button
                          onClick={() => onMarkPaid(factura.id)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 p-1"
                          title="Marcar como pagada"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onCancel(factura)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                          title="Anular"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FacturaTable;