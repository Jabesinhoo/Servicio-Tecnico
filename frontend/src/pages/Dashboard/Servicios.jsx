// src/pages/Dashboard/Servicios.jsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ServicioTable from './servicios/ServicioTable';
import ServicioFilters from './servicios/ServicioFilters';
import ServicioDetail from './servicios/ServicioDetail';
import ServicioForm from './servicios/ServicioForm';
import AssignTechModal from './servicios/AssignTechModal';
import AddPartModal from './servicios/components/AddPartModal';
import ServiceCard from './servicios/components/ServiceCard';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Plus, RefreshCw, LayoutGrid, Table, CheckCircle, XCircle } from 'lucide-react';
import { useServicios } from './servicios/hooks/useServicios';

const Servicios = () => {
    const { user } = useAuth();
    const {
        servicios,
        loading,
        total,
        filters,
        setFilters,
        fetchServicios,
        createServicio,
        changeStatus,
        assignTech,
        deleteServicio
    } = useServicios();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showAddPartModal, setShowAddPartModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedServicio, setSelectedServicio] = useState(null);
    const [selectedServicioId, setSelectedServicioId] = useState(null);
    const [rejectMotivo, setRejectMotivo] = useState('');
    const [editingServicio, setEditingServicio] = useState(null);
    const [viewMode, setViewMode] = useState('table');

    const handleViewDetail = (id) => {
        setSelectedServicioId(id);
        setShowDetailModal(true);
    };

    const handleAssignTech = (id) => {
        setSelectedServicioId(id);
        setShowAssignModal(true);
    };

    const handleAddPart = (id) => {
        setSelectedServicioId(id);
        setShowAddPartModal(true);
    };

    const handleDeleteClick = (servicio) => {
        setSelectedServicio(servicio);
        setShowConfirmModal(true);
    };

    const handleConfirmDelete = async () => {
        if (selectedServicio) {
            await deleteServicio(selectedServicio.id);
            setShowConfirmModal(false);
            setSelectedServicio(null);
        }
    };

    const handleApprove = async (id) => {
        try {
            const response = await api.patch(`/api/service-orders/${id}/approve`);
            console.log('Servicio aprobado:', response.data);
            await fetchServicios(); // Recargar la lista
            setShowApproveModal(false);
            setSelectedServicioId(null);
            // Mostrar mensaje de éxito
            alert('Servicio aprobado correctamente');
        } catch (error) {
            console.error('Error aprobando servicio:', error);
            alert(error.response?.data?.message || 'Error al aprobar el servicio');
        }
    };

    const handleReject = async () => {
        if (!rejectMotivo.trim()) {
            alert('Debe ingresar un motivo de rechazo');
            return;
        }
        try {
            const response = await api.patch(`/api/service-orders/${selectedServicioId}/reject`, {
                motivo: rejectMotivo
            });
            console.log('Servicio rechazado:', response.data);
            await fetchServicios(); // Recargar la lista
            setShowRejectModal(false);
            setRejectMotivo('');
            setSelectedServicioId(null);
            alert('Servicio rechazado correctamente');
        } catch (error) {
            console.error('Error rechazando servicio:', error);
            alert(error.response?.data?.message || 'Error al rechazar el servicio');
        }
    };

    const handleEdit = (servicio) => {
        setEditingServicio(servicio);
        setShowEditModal(true);
    };

    const handleUpdateServicio = async (data) => {
        try {
            await api.put(`/api/service-orders/${editingServicio.id}`, data);
            await fetchServicios();
            setShowEditModal(false);
            setEditingServicio(null);
        } catch (error) {
            console.error('Error actualizando servicio:', error);
            alert(error.response?.data?.message || 'Error al actualizar el servicio');
        }
    };

    const userRole = user?.rol || 'usuario';
    const canCreate = userRole === 'admin' || userRole === 'tecnico';
    const isAdmin = userRole === 'admin';

    return (
        <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Servicio</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Gestiona los servicios técnicos - Total: {total} servicios
                    </p>
                </div>
                <div className="flex gap-3">
                    {/* Botones de cambio de vista */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'table'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            title="Vista de tabla"
                        >
                            <Table className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'cards'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            title="Vista de tarjetas"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={fetchServicios}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualizar
                    </button>
                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva OS
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <ServicioFilters
                filters={filters}
                onFilterChange={setFilters}
                onClearFilters={() => setFilters({ estado: '', tecnico_id: '', page: 1, limit: 20 })}
                onSearch={fetchServicios}
            />

            {/* Vista de Tabla */}
            {viewMode === 'table' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <ServicioTable
                        servicios={servicios}
                        loading={loading}
                        onViewDetail={handleViewDetail}
                        onAssignTech={handleAssignTech}
                        onAddPart={handleAddPart}
                        onChangeStatus={changeStatus}
                        onDelete={handleDeleteClick}
                        onEdit={handleEdit}
                        onApprove={handleApprove}
                        onReject={(id) => {
                            setSelectedServicioId(id);
                            setShowRejectModal(true);
                        }}
                        userRole={userRole}
                        isAdmin={isAdmin}
                    />
                </div>
            )}

            {/* Vista de Tarjetas */}
            {viewMode === 'cards' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {servicios.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                            No hay órdenes de servicio
                        </div>
                    ) : (
                        servicios.map((servicio) => (
                            <ServiceCard
                                key={servicio.id}
                                servicio={servicio}
                                onViewDetail={handleViewDetail}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                                onApprove={(id) => {
                                    setSelectedServicioId(id);
                                    setShowApproveModal(true);
                                }}
                                onReject={(id) => {
                                    setSelectedServicioId(id);
                                    setShowRejectModal(true);
                                }}
                                canEdit={isAdmin}
                                userRole={userRole}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Modales */}
            <ServicioForm
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={createServicio}
            />

            <ServicioDetail
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setSelectedServicioId(null);
                }}
                servicioId={selectedServicioId}
                onRefresh={fetchServicios}
                onAssignTech={handleAssignTech}
                onAddPart={handleAddPart}
                onChangeStatus={changeStatus}
            />

            <AssignTechModal
                isOpen={showAssignModal}
                onClose={() => {
                    setShowAssignModal(false);
                    setSelectedServicioId(null);
                }}
                onSubmit={assignTech}
                servicioId={selectedServicioId}
            />

            <AddPartModal
                isOpen={showAddPartModal}
                onClose={() => {
                    setShowAddPartModal(false);
                    setSelectedServicioId(null);
                }}
                onSubmit={async (id, data) => {
                    await api.post(`/api/service-orders/${id}/parts`, data);
                    await fetchServicios();
                }}
                servicioId={selectedServicioId}
            />

            {/* Modal de Eliminación */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => {
                    setShowConfirmModal(false);
                    setSelectedServicio(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Eliminar Orden de Servicio"
                message={`¿Estás seguro de eliminar la OS "${selectedServicio?.codigo_os}"?`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />

            {/* Modal de Aprobación */}
            <ConfirmModal
                isOpen={showApproveModal}
                onClose={() => {
                    setShowApproveModal(false);
                    setSelectedServicioId(null);
                }}
                onConfirm={() => handleApprove(selectedServicioId)}
                title="Aprobar Servicio"
                message="¿Estás seguro de aprobar este servicio? Se procederá a la asignación de técnico."
                confirmText="Aprobar"
                cancelText="Cancelar"
                variant="success"
            />

            {/* Modal de Edición */}
            {showEditModal && editingServicio && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b flex justify-between">
                            <h3 className="text-lg font-semibold">Editar Servicio - {editingServicio.codigo_os}</h3>
                            <button onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Descripción</label>
                                <textarea
                                    value={editingServicio.descripcion_inicial || ''}
                                    onChange={(e) => setEditingServicio({ ...editingServicio, descripcion_inicial: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Prioridad</label>
                                    <select
                                        value={editingServicio.prioridad || 'normal'}
                                        onChange={(e) => setEditingServicio({ ...editingServicio, prioridad: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="baja">Baja</option>
                                        <option value="normal">Normal</option>
                                        <option value="alta">Alta</option>
                                        <option value="urgente">Urgente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Fecha agendada</label>
                                    <input
                                        type="date"
                                        value={editingServicio.fecha_agendada?.split('T')[0] || ''}
                                        onChange={(e) => setEditingServicio({ ...editingServicio, fecha_agendada: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-4 sm:px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                            <button onClick={() => handleUpdateServicio(editingServicio)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Rechazo */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
                        <div className="px-4 sm:px-6 py-4 border-b flex justify-between">
                            <h3 className="text-lg font-semibold">Rechazar Servicio</h3>
                            <button onClick={() => setShowRejectModal(false)}>✕</button>
                        </div>
                        <div className="p-4 sm:p-6">
                            <label className="block text-sm font-medium mb-2">Motivo del rechazo *</label>
                            <textarea
                                value={rejectMotivo}
                                onChange={(e) => setRejectMotivo(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Especifique la razón por la que se rechaza este servicio..."
                            />
                        </div>
                        <div className="px-4 sm:px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                            <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg">Rechazar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Servicios;