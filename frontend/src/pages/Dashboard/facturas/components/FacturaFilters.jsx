// src/pages/Dashboard/facturas/components/FacturaFilters.jsx
import React from 'react';
import { Filter, X, Calendar } from 'lucide-react';

const estadoOptions = [
  { value: '', label: 'Todos' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'emitida', label: 'Emitida' },
  { value: 'pagada', label: 'Pagada' },
  { value: 'anulada', label: 'Anulada' },
];

const FacturaFilters = ({ filters, onFilterChange, onClearFilters }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const hasFilters = filters.estado !== '' || filters.fecha_inicio !== '' || filters.fecha_fin !== '';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros</h3>
        </div>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estado</label>
          <select
            name="estado"
            value={filters.estado || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {estadoOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha Desde</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              name="fecha_inicio"
              value={filters.fecha_inicio || ''}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha Hasta</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              name="fecha_fin"
              value={filters.fecha_fin || ''}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturaFilters;