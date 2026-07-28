import React from 'react';

const statusConfig = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    en_proceso: { label: 'En Proceso', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    completado: { label: 'Completado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

const AlquilerStatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.pendiente;
    
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
        </span>
    );
};

export default AlquilerStatusBadge;