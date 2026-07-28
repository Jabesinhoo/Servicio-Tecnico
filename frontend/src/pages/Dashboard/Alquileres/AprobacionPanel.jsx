// frontend/src/pages/Dashboard/Alquileres/AprobacionPanel.jsx
import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, FileText, Search, Calendar, User } from 'lucide-react';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';

const AprobacionPanel = ({ solicitudes, loading, onApprove, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [observaciones, setObservaciones] = useState('');

    // Filtrar solicitudes que necesitan aprobacion
    const pendientesAprobacion = solicitudes.filter(s => 
        s.estado === 'pendiente' && !s.documentacion_aprobada
    );

    const filtered = pendientesAprobacion.filter(s => {
        const matchSearch = 
            s.numero_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_documento?.includes(searchTerm);
        return matchSearch;
    });

    const handleAprobar = async (aprobado) => {
        if (!selectedSolicitud) return;
        await onApprove(selectedSolicitud.id, aprobado, observaciones);
        setShowModal(false);
        setSelectedSolicitud(null);
        setObservaciones('');
    };

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
                        Aprobacion de Documentacion
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {pendientesAprobacion.length} solicitudes pendientes de aprobacion
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
                    placeholder="Buscar por numero, cliente o documento..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {pendientesAprobacion.length === 0 
                            ? 'No hay solicitudes pendientes de aprobacion' 
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
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                        {solicitud.cliente_nombre || '—'}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
                                        <span>Documento: {solicitud.cliente_documento || '—'}</span>
                                        <span>Inicio: {new Date(solicitud.fecha_inicio).toLocaleDateString()}</span>
                                        <span>Fin: {new Date(solicitud.fecha_fin).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedSolicitud(solicitud);
                                            setShowModal(true);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Revisar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de aprobacion */}
            {showModal && selectedSolicitud && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Revisar Documentacion
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Numero Solicitud</p>
                                        <p className="text-sm font-medium">{selectedSolicitud.numero_solicitud}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Estado</p>
                                        <AlquilerStatusBadge status={selectedSolicitud.estado} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Cliente</p>
                                        <p className="text-sm">{selectedSolicitud.cliente_nombre}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Documento</p>
                                        <p className="text-sm">{selectedSolicitud.cliente_documento}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Fecha Inicio</p>
                                        <p className="text-sm">{new Date(selectedSolicitud.fecha_inicio).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Fecha Fin</p>
                                        <p className="text-sm">{new Date(selectedSolicitud.fecha_fin).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Observaciones
                                </label>
                                <textarea
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Observaciones sobre la aprobacion..."
                                />
                            </div>
                        </div>

                        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleAprobar(false)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                <XCircle className="w-4 h-4 inline mr-1" />
                                Rechazar
                            </button>
                            <button
                                onClick={() => handleAprobar(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                <CheckCircle className="w-4 h-4 inline mr-1" />
                                Aprobar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AprobacionPanel;