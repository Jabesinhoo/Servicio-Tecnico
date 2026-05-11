// src/pages/Dashboard/components/RecentOrdersTable.jsx
import React from 'react';
import { Eye } from 'lucide-react';

const RecentOrdersTable = ({ orders, loading, onViewOrder }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No hay órdenes recientes</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
            <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
            <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
            <th className="text-left py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
            <th className="text-right py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="py-3 text-sm font-medium text-gray-900 dark:text-white">{order.numero_ov}</td>
              <td className="py-3 text-sm text-gray-600 dark:text-gray-400">{order.cliente_nombre}</td>
              <td className="py-3 text-sm font-medium text-gray-900 dark:text-white">${order.total}</td>
              <td className="py-3">
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                  order.estado === 'confirmada' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                  order.estado === 'borrador' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {order.estado === 'confirmada' ? 'Confirmada' : order.estado === 'borrador' ? 'Borrador' : order.estado}
                </span>
               </td>
              <td className="py-3 text-right">
                <button
                  onClick={() => onViewOrder(order.id)}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Eye className="w-4 h-4" />
                </button>
               </td>
             </tr>
          ))}
        </tbody>
       </table>
    </div>
  );
};

export default RecentOrdersTable;