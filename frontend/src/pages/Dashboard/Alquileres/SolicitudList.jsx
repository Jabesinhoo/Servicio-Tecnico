// frontend/src/pages/Dashboard/Alquileres/SolicitudList.jsx
import React, { useState } from 'react';
import { Eye, Calendar, User, FileText, Search, X, ChevronDown } from 'lucide-react';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';

const SolicitudList = ({ solicitudes, loading, onViewDetail, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    const estados = ['pendiente', 'aprobado', 'rechazado', 'en_proceso', 'completado'];

    const filtered = solicitudes.filter(s => {
        const matchSearch = 
            s.numero_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_documento?.includes(searchTerm);
        const matchEstado = filterEstado ? s.estado === filterEstado : true;
        return matchSearch && matchEstado;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por numero, cliente o documento..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm min-w-[140px]"
                    >
                        <option value="">Todos los estados</option>
                        {estados.map(estado => (
                            <option key={estado} value={estado}>
                                {estado.charAt(0).toUpperCase() + estado.slice(1)}
                            </option>
                        ))}
                    </select>
                    {filterEstado && (
                        <button
                            onClick={() => setFilterEstado('')}
                            className="px-3 py-2 text-red-500 hover:text-red-700 border border-gray-300 dark:border-gray-700 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No hay solicitudes de alquiler
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Solicitud
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Cliente
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Fechas
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                {filtered.map((solicitud) => (
                                    <tr key={solicitud.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {solicitud.numero_solicitud}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Creado: {new Date(solicitud.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px]">
                                                {solicitud.cliente_nombre || '—'}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {solicitud.cliente_documento || '—'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(solicitud.fecha_inicio).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {new Date(solicitud.fecha_fin).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <AlquilerStatusBadge status={solicitud.estado} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => onViewDetail(solicitud.id)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Total: {filtered.length} solicitudes</span>
                <button
                    onClick={onRefresh}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                >
                    Actualizar
                </button>
            </div>
        </div>
    );
};

export default SolicitudList;