// frontend/src/pages/Dashboard/Alquileres/DevolucionPanel.jsx
import React, { useState } from 'react';
import { Undo2, CheckCircle, Search, User, Calendar, FileText, Truck, Home, Globe, AlertCircle } from 'lucide-react';
import api from '../../../services/api';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';

const DevolucionPanel = ({ solicitudes, loading, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [tipoDevolucion, setTipoDevolucion] = useState('local');
    const [observaciones, setObservaciones] = useState('');
    const [procesando, setProcesando] = useState(false);

    // Filtrar solicitudes completadas que necesitan devolucion
    const paraDevolucion = solicitudes.filter(s => 
        s.estado === 'completado'
    );

    const filtered = paraDevolucion.filter(s => {
        const matchSearch = 
            s.numero_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_documento?.includes(searchTerm);
        return matchSearch;
    });

    const handleIniciarDevolucion = async () => {
        if (!selectedSolicitud) return;
        setProcesando(true);
        try {
            await api.post(`/api/alquiler/solicitudes/${selectedSolicitud.id}/devolucion`, {
                tipo: tipoDevolucion,
                observaciones: observaciones
            });
            await onRefresh();
            setShowModal(false);
            setSelectedSolicitud(null);
            setObservaciones('');
        } catch (error) {
            console.error('Error al iniciar devolucion:', error);
            alert(error.response?.data?.message || 'Error al iniciar devolucion');
        } finally {
            setProcesando(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const tiposDevolucion = [
        { value: 'local', label: 'Local', icon: Home, desc: 'Cliente se presenta en la empresa' },
        { value: 'nacional', label: 'Nacional', icon: Truck, desc: 'Envio por transportadora' },
        { value: 'alto_volumen', label: 'Alto Volumen', icon: Globe, desc: 'Gran cantidad de productos' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Devolucion de Equipos
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {paraDevolucion.length} solicitudes listas para devolucion
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
                    <Undo2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {paraDevolucion.length === 0 
                            ? 'No hay solicitudes listas para devolucion' 
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
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                        <Undo2 className="w-4 h-4" />
                                        Iniciar Devolucion
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de devolucion */}
            {showModal && selectedSolicitud && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Iniciar Devolucion
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4">
                            {/* Informacion de la solicitud */}
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Solicitud</p>
                                        <p className="text-sm font-medium">{selectedSolicitud.numero_solicitud}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Cliente</p>
                                        <p className="text-sm">{selectedSolicitud.cliente_nombre}</p>
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

                            {/* Tipo de devolucion */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tipo de Devolucion
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {tiposDevolucion.map((tipo) => {
                                        const Icon = tipo.icon;
                                        const isSelected = tipoDevolucion === tipo.value;
                                        return (
                                            <button
                                                key={tipo.value}
                                                type="button"
                                                onClick={() => setTipoDevolucion(tipo.value)}
                                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                <Icon className={`w-6 h-6 mx-auto ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                                                <p className={`text-sm font-medium mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                                                    {tipo.label}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{tipo.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Observaciones */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Observaciones
                                </label>
                                <textarea
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Detalles adicionales sobre la devolucion..."
                                />
                            </div>

                            {/* Proceso de devolucion */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                    Proceso de Devolucion
                                </h4>
                                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                                    <li>El vendedor recibe al cliente o los productos</li>
                                    <li>Servicio tecnico verifica los productos y seriales</li>
                                    <li>Bodega recibe y valida el inventario</li>
                                    <li>Contabilidad genera el desembolso del deposito</li>
                                    <li>Inventario registra el ingreso de productos</li>
                                </ol>
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
                                onClick={handleIniciarDevolucion}
                                disabled={procesando}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Undo2 className="w-4 h-4" />
                                {procesando ? 'Procesando...' : 'Iniciar Devolucion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevolucionPanel;