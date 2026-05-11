// src/pages/Dashboard/Servicios.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ServicioTable from './servicios/ServicioTable';
import ServicioFilters from './servicios/ServicioFilters';
import ServicioDetail from './servicios/ServicioDetail';
import ServicioForm from './servicios/ServicioForm';
import AssignTechModal from './servicios/AssignTechModal';
import { Plus, RefreshCw } from 'lucide-react';

const Servicios = () => {
  const { user } = useAuth();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', search: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [selectedServicioId, setSelectedServicioId] = useState(null);

  const fetchServicios = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.estado) params.append('estado', filters.estado);
      
      const res = await api.get(`/api/service-orders?${params.toString()}`);
      let data = res.data.data || [];
      
      if (filters.search) {
        data = data.filter(s => 
          s.codigo_os?.toLowerCase().includes(filters.search.toLowerCase()) ||
          s.cliente_nombre?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }
      
      setServicios(data);
    } catch (error) {
      console.error('Error fetching servicios:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchServicios();
  }, [fetchServicios]);

  const handleViewDetail = async (id) => {
    try {
      const res = await api.get(`/api/service-orders/${id}`);
      setSelectedServicio(res.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching servicio detail:', error);
    }
  };

  const handleAssignTech = (id) => {
    setSelectedServicioId(id);
    setShowAssignModal(true);
  };

  const handleAssignTechSubmit = async (tecnicoId) => {
    try {
      await api.patch(`/api/service-orders/${selectedServicioId}/assign`, { tecnico_id: tecnicoId });
      await fetchServicios();
      setShowAssignModal(false);
    } catch (error) {
      console.error('Error assigning tech:', error);
    }
  };

  const handleStartService = async (id) => {
    try {
      await api.patch(`/api/service-orders/${id}/status`, { estado: 'en_ejecucion' });
      await fetchServicios();
    } catch (error) {
      console.error('Error starting service:', error);
    }
  };

  const handleCompleteService = async (id) => {
    try {
      await api.patch(`/api/service-orders/${id}/status`, { estado: 'cerrada' });
      await fetchServicios();
    } catch (error) {
      console.error('Error completing service:', error);
    }
  };

  const handleCreateService = async (data) => {
    try {
      await api.post('/api/service-orders', data);
      await fetchServicios();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating service:', error);
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona los servicios técnicos</p>
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
        onClearFilters={() => setFilters({ estado: '', search: '' })}
        onSearch={fetchServicios}
      />

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <ServicioTable
          servicios={servicios}
          loading={loading}
          onViewDetail={handleViewDetail}
          onAssignTech={handleAssignTech}
          onStartService={handleStartService}
          onCompleteService={handleCompleteService}
          userRole={userRole}
        />
      </div>

      {/* Modals */}
      <ServicioForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateService}
      />

      <ServicioDetail
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        servicio={selectedServicio}
        onRefresh={fetchServicios}
      />

      <AssignTechModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSubmit={handleAssignTechSubmit}
      />
    </div>
  );
};

export default Servicios;