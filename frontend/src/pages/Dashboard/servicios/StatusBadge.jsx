import React from 'react';

const statusConfig = {
  pendiente: ['Pendiente', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'],
  aprobado: ['Aprobado', 'accent-soft accent-text dark:accent-soft dark:accent-text'],
  rechazado: ['Rechazado', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'],
  asignada: ['Asignada', 'accent-soft accent-text dark:accent-soft dark:accent-text'],
  en_ejecucion: ['En ejecución', 'accent-soft accent-text dark:accent-soft dark:accent-text'],
  en_espera: ['En espera', 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'],
  cancelado: ['Cancelada', 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'],
  cerrada: ['Cerrada', 'accent-soft accent-text dark:accent-soft dark:accent-text'],
};

const StatusBadge = ({ status }) => {
  const [label, color] = statusConfig[status] || [status || 'Sin estado', 'bg-gray-100 text-gray-700'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
