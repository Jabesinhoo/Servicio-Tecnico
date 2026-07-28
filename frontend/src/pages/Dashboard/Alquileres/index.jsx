// frontend/src/pages/Dashboard/Alquileres/index.jsx
import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SolicitudList from './SolicitudList';
import SolicitudForm from './SolicitudForm';
import SolicitudDetail from './SolicitudDetail';
import AprobacionPanel from './AprobacionPanel';
import DespachoPanel from './DespachoPanel';
import RevisionPanel from './RevisionPanel';
import DevolucionPanel from './DevolucionPanel';
import { useAlquileres } from '../../../hooks/useAlquileres';
import { Plus, RefreshCw, FileText, CheckCircle, Package, Wrench, Undo2 } from 'lucide-react';

const tabs = [
    { id: 'list', label: 'Solicitudes', icon: FileText, roles: ['admin', 'ventas', 'tecnico', 'inventario'] },
    { id: 'aprobacion', label: 'Aprobacion', icon: CheckCircle, roles: ['admin', 'facturacion'] },
    { id: 'despacho', label: 'Despacho', icon: Package, roles: ['admin', 'inventario'] },
    { id: 'revision', label: 'Revision Tecnica', icon: Wrench, roles: ['admin', 'tecnico'] },
    { id: 'devolucion', label: 'Devoluciones', icon: Undo2, roles: ['admin', 'ventas', 'tecnico'] },
];

const Alquileres = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('list');
    const [showForm, setShowForm] = useState(false);
    const [selectedSolicitud, setSelectedSolicitud] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const { solicitudes, loading, cargarSolicitudes, crearSolicitud, actualizarEstado, aprobarDocumentacion } = useAlquileres();

    const userRole = user?.rol || 'usuario';
    const canCreate = userRole === 'admin' || userRole === 'ventas';

    const availableTabs = tabs.filter(tab => 
        tab.roles.includes(userRole) || tab.roles.includes('admin')
    );

    const handleViewDetail = (id) => {
        setViewDetail(id);
        setActiveTab('list');
    };

    const handleCloseDetail = () => {
        setViewDetail(null);
    };

    return (
        <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                        Gestion de Alquileres
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Gestiona todo el ciclo de vida de los alquileres
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">                    
                    <button
                        onClick={cargarSolicitudes}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 sm:gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Actualizar</span>
                    </button>
                    
                    {canCreate && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 sm:gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nueva Solicitud</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-800 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <nav className="flex gap-1 min-w-max">
                    {availableTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 ${
                                    isActive 
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden xs:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Contenido */}
            <div className="mt-4">
                {viewDetail ? (
                    <SolicitudDetail 
                        solicitudId={viewDetail} 
                        onClose={handleCloseDetail}
                        onRefresh={cargarSolicitudes}
                        onEdit={() => {}}
                    />
                ) : (
                    <>
                        {activeTab === 'list' && (
                            <SolicitudList 
                                solicitudes={solicitudes}
                                loading={loading}
                                onViewDetail={handleViewDetail}
                                onRefresh={cargarSolicitudes}
                            />
                        )}

                        {activeTab === 'aprobacion' && (
                            <AprobacionPanel 
                                solicitudes={solicitudes}
                                loading={loading}
                                onApprove={aprobarDocumentacion}
                                onRefresh={cargarSolicitudes}
                            />
                        )}

                        {activeTab === 'despacho' && (
                            <DespachoPanel 
                                solicitudes={solicitudes}
                                loading={loading}
                                onRefresh={cargarSolicitudes}
                            />
                        )}

                        {activeTab === 'revision' && (
                            <RevisionPanel 
                                solicitudes={solicitudes}
                                loading={loading}
                                onRefresh={cargarSolicitudes}
                                tecnicoId={user?.id}
                            />
                        )}

                        {activeTab === 'devolucion' && (
                            <DevolucionPanel 
                                solicitudes={solicitudes}
                                loading={loading}
                                onRefresh={cargarSolicitudes}
                            />
                        )}
                    </>
                )}
            </div>

            <SolicitudForm 
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                onSubmit={crearSolicitud}
                onSuccess={cargarSolicitudes}
            />
        </div>
    );
};

export default Alquileres;