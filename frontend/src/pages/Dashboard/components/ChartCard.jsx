// src/pages/Dashboard/components/ChartCard.jsx
import React from 'react';

const ChartCard = ({ title, children, onRefresh }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
          >
            Actualizar
          </button>
        )}
      </div>
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
};

export default ChartCard;