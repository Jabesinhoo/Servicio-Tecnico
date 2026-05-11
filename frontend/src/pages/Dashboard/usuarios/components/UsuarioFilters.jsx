// src/pages/Dashboard/usuarios/components/UsuarioFilters.jsx
import React from 'react';
import { Search, X, Filter } from 'lucide-react';

const roleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'admin', label: 'Administrador' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'inventario', label: 'Inventario' },
  { value: 'facturacion', label: 'Facturación' },
  { value: 'usuario', label: 'Usuario' },
];

const statusOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];

const UsuarioFilters = ({ filters, onFilterChange, onClearFilters, onSearch }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch();
  };

  const hasFilters = filters.rol !== '' || filters.estado !== 'todos' || filters.search !== '';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
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
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rol</label>
          <select
            name="rol"
            value={filters.rol || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estado</label>
          <select
            name="estado"
            value={filters.estado || 'todos'}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        <form onSubmit={handleSearchSubmit}>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Buscar</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="search"
              value={filters.search || ''}
              onChange={handleChange}
              placeholder="Nombre, usuario, cédula o email..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsuarioFilters;