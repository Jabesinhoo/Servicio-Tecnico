// frontend/src/pages/Dashboard/Alquileres/RevisionPanel.jsx
import React, { useState } from 'react';
import { Wrench, CheckCircle, Clock, User, Search, Eye, AlertCircle } from 'lucide-react';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';

const RevisionPanel = ({ solicitudes, loading, onRefresh, tecnicoId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [showItems, setShowItems] = useState(false);

    // Filtrar solicitudes que estan en proceso de revision
    const enRevision = solicitudes.filter(s => 
        s.estado === 'en_proceso'
    );

    const filtered = enRevision.filter(s => {
        const matchSearch = 
            s.numero_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSearch;
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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Revision Tecnica
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {enRevision.length} solicitudes en proceso de revision
                    </p>
                </div>
                <button
                    onClick={onRefresh}
                    className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
                >
                    Actualizar
                </button>
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por numero o cliente..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {enRevision.length === 0 
                            ? 'No hay solicitudes en revision tecnica' 
                            : 'No se encontraron resultados'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((solicitud) => (
                        <div
                            key={solicitud.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {solicitud.numero_solicitud}
                                        </span>
                                        <AlquilerStatusBadge status={solicitud.estado} />
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                            <Clock className="w-3 h-3" />
                                            En Revision
                                        </span>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                        {solicitud.cliente_nombre || '—'}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
                                        <span>Inicio: {new Date(solicitud.fecha_inicio).toLocaleDateString()}</span>
                                        <span>Fin: {new Date(solicitud.fecha_fin).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedSolicitud(solicitud);
                                            setShowItems(true);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Ver Items
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de items para revision */}
            {showItems && selectedSolicitud && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Items a Revisar - {selectedSolicitud.numero_solicitud}
                            </h3>
                            <button onClick={() => setShowItems(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6">
                            {selectedSolicitud.items && selectedSolicitud.items.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedSolicitud.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {item.producto_codigo} - {item.producto_nombre}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Serial: {item.serial || '—'}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                        item.estado_revision === 'aprobado' ? 'bg-green-100 text-green-800' :
                                                        item.estado_revision === 'en_revision' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {item.estado_revision === 'aprobado' ? 'Aprobado' :
                                                         item.estado_revision === 'en_revision' ? 'En Revision' :
                                                         'Pendiente'}
                                                    </span>
                                                    {item.tecnico_nombre && (
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {item.tecnico_nombre}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!item.tecnico_id && item.estado_revision === 'pendiente' && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Pendiente de asignacion de tecnico
                                                </div>
                                            )}
                                            {item.tecnico_id && item.estado_revision === 'pendiente' && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                    <Clock className="w-4 h-4" />
                                                    Esperando revision del tecnico
                                                </div>
                                            )}
                                            {item.estado_revision === 'en_revision' && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                    <Wrench className="w-4 h-4" />
                                                    Tecnico {item.tecnico_nombre} esta revisando
                                                </div>
                                            )}
                                            {item.estado_revision === 'aprobado' && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Revision completada y aprobada
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No hay items para revisar</p>
                                </div>
                            )}

                            {selectedSolicitud.items && selectedSolicitud.items.length > 0 && (
                                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{selectedSolicitud.items.length}</p>
                                            <p className="text-xs text-gray-500">Total Items</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-yellow-600">
                                                {selectedSolicitud.items.filter(i => i.estado_revision === 'pendiente' || i.estado_revision === 'en_revision').length}
                                            </p>
                                            <p className="text-xs text-gray-500">Pendientes</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-green-600">
                                                {selectedSolicitud.items.filter(i => i.estado_revision === 'aprobado').length}
                                            </p>
                                            <p className="text-xs text-gray-500">Completados</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                            <button
                                onClick={() => setShowItems(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevisionPanel;