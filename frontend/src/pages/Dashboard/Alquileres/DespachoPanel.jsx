// frontend/src/pages/Dashboard/Alquileres/DespachoPanel.jsx
import React, { useState } from 'react';
import { Package, Truck, CheckCircle, Eye, Search, Printer, Barcode, XCircle } from 'lucide-react';
import api from '../../../services/api';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';
import BarcodeScanner from '../../../components/ui/BarcodeScanner';

const DespachoPanel = ({ solicitudes, loading, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedProducts, setScannedProducts] = useState([]);
    const [despachando, setDespachando] = useState(false);
    const [productos, setProductos] = useState([]);
    const [seriales, setSeriales] = useState([]);

    // Filtrar solicitudes aprobadas que necesitan despacho
    const pendientesDespacho = solicitudes.filter(s => 
        s.estado === 'aprobado' || s.estado === 'en_proceso'
    );

    const filtered = pendientesDespacho.filter(s => {
        const matchSearch = 
            s.numero_solicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cliente_documento?.includes(searchTerm);
        return matchSearch;
    });

    const handleScan = (items) => {
        setScannedProducts([...scannedProducts, ...items]);
        console.log('Productos escaneados:', items);
    };

    const handleDespachar = async () => {
        if (!selectedSolicitud) return;
        setDespachando(true);
        try {
            await api.post(`/api/alquiler/solicitudes/${selectedSolicitud.id}/despacho`, {
                observaciones: 'Despacho iniciado desde el sistema',
                productos_escaneados: scannedProducts
            });
            await onRefresh();
            setShowModal(false);
            setSelectedSolicitud(null);
            setScannedProducts([]);
        } catch (error) {
            console.error('Error al despachar:', error);
            alert(error.response?.data?.message || 'Error al despachar');
        } finally {
            setDespachando(false);
        }
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Despacho de Productos
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {pendientesDespacho.length} solicitudes listas para despachar
                    </p>
                </div>
                <button
                    onClick={onRefresh}
                    className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 self-start"
                >
                    Actualizar
                </button>
            </div>

            {/* Buscador */}
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por numero, cliente o documento..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {pendientesDespacho.length === 0 
                            ? 'No hay solicitudes listas para despachar' 
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
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {solicitud.numero_solicitud}
                                        </span>
                                        <AlquilerStatusBadge status={solicitud.estado} />
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">
                                        {solicitud.cliente_nombre || '—'}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
                                        <span>Doc: {solicitud.cliente_documento || '—'}</span>
                                        <span>Inicio: {new Date(solicitud.fecha_inicio).toLocaleDateString()}</span>
                                        <span>Fin: {new Date(solicitud.fecha_fin).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedSolicitud(solicitud);
                                        setShowModal(true);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 w-full sm:w-auto justify-center"
                                >
                                    <Truck className="w-4 h-4" />
                                    Despachar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de despacho */}
            {showModal && selectedSolicitud && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Confirmar Despacho
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                                    <Barcode className="w-5 h-5 flex-shrink-0" />
                                    <span>Recuerde leer los codigos de barras de cada producto antes de despachar</span>
                                </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-gray-500">Solicitud</p>
                                        <p className="text-sm font-medium break-all">{selectedSolicitud.numero_solicitud}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Cliente</p>
                                        <p className="text-sm break-words">{selectedSolicitud.cliente_nombre}</p>
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

                            {/* Boton de escaneo */}
                            <button
                                onClick={() => setShowScanner(true)}
                                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                            >
                                <Barcode className="w-5 h-5" />
                                Escanear Productos ({scannedProducts.length})
                            </button>

                            {scannedProducts.length > 0 && (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-32 overflow-y-auto">
                                    <p className="text-xs text-gray-500 mb-2">Productos escaneados:</p>
                                    {scannedProducts.map((item, idx) => (
                                        <div key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                            {item.codigo || item.serial || item.nombre}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    <strong>Proceso:</strong> Despache los productos a servicio tecnico para su revision
                                </p>
                            </div>
                        </div>

                        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDespachar}
                                disabled={despachando}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Truck className="w-4 h-4" />
                                {despachando ? 'Procesando...' : 'Confirmar Despacho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner */}
            {showScanner && (
                <BarcodeScanner
                    onScan={handleScan}
                    onClose={() => setShowScanner(false)}
                    title="Escanear productos para despacho"
                    productos={productos}
                    seriales={seriales}
                />
            )}
        </div>
    );
};

export default DespachoPanel;