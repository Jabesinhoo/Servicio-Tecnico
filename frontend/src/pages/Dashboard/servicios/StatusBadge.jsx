// src/pages/Dashboard/servicios/components/StatusBadge.jsx
import React from 'react';

const statusConfig = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: 'Clock' },
  asignada: { label: 'Asignada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: 'UserCheck' },
  en_ejecucion: { label: 'En Ejecución', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: 'Wrench' },
  en_espera: { label: 'En Espera', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: 'Pause' },
  cerrada: { label: 'Cerrada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: 'CheckCircle' },
};

const StatusBadge = ({ status, showIcon = false }) => {
  const config = statusConfig[status] || statusConfig.pendiente;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;