import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ServicioTable from './servicios/ServicioTable';
import ServicioFilters from './servicios/ServicioFilters';
import ServicioDetail from './servicios/ServicioDetail';
import ServicioForm from './servicios/ServicioForm';
import AssignTechModal from './servicios/AssignTechModal';
import AddPartModal from './servicios/components/AddPartModal'; 
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Plus, RefreshCw } from 'lucide-react';
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
  const [showDetailModal, setShowDetailModal] = useState(false);  // ← CORREGIDO: faltaba el =
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [selectedServicioId, setSelectedServicioId] = useState(null);

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

  const userRole = user?.rol || 'usuario';
  const canCreate = userRole === 'admin' || userRole === 'tecnico';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Servicio</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona los servicios técnicos - Total: {total} servicios
          </p>
        </div>
        <div className="flex gap-3">
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <ServicioTable
          servicios={servicios}
          loading={loading}
          onViewDetail={handleViewDetail}
          onAssignTech={handleAssignTech}
          onAddPart={handleAddPart}
          onChangeStatus={changeStatus}
          onDelete={handleDeleteClick}
          userRole={userRole}
        />
      </div>

      {/* Modals */}
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
    </div>
  );
};

export default Servicios;