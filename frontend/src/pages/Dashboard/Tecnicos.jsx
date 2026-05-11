// src/pages/Dashboard/Tecnicos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import TecnicoTable from './tecnicos/components/TecnicoTable';
import TecnicoFilters from './tecnicos/components/TecnicoFilters';
import TecnicoForm from './tecnicos/TecnicoForm';
import { Plus, RefreshCw, Users } from 'lucide-react';

const Tecnicos = () => {
  const { user } = useAuth();
  const [tecnicos, setTecnicos] = useState([]);
  const [filteredTecnicos, setFilteredTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: 'todos', search: '' });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState(null);
  const [editingTecnico, setEditingTecnico] = useState(null);
  const [statusAction, setStatusAction] = useState(null);

  const fetchTecnicos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/role?rol=tecnico');
      let data = res.data || [];
      
      // Aplicar filtros
      if (filters.estado === 'activos') {
        data = data.filter(t => t.activo === true);
      } else if (filters.estado === 'inactivos') {
        data = data.filter(t => t.activo === false);
      }
      
      if (filters.search) {
        const term = filters.search.toLowerCase();
        data = data.filter(t =>
          t.nombre1?.toLowerCase().includes(term) ||
          t.apellidos?.toLowerCase().includes(term) ||
          t.usuario?.toLowerCase().includes(term) ||
          t.cedula?.toLowerCase().includes(term) ||
          t.email?.toLowerCase().includes(term)
        );
      }
      
      setTecnicos(data);
      setFilteredTecnicos(data);
    } catch (error) {
      console.error('Error fetching tecnicos:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTecnicos();
  }, [fetchTecnicos]);

  const handleCreate = async (data) => {
    await api.post('/api/users', { ...data, rol: 'tecnico' });
    await fetchTecnicos();
  };

  const handleUpdate = async (data) => {
    await api.put(`/api/users/${editingTecnico.id}`, data);
    setEditingTecnico(null);
    await fetchTecnicos();
  };

  const handleDeleteClick = (tecnico) => {
    setSelectedTecnico(tecnico);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTecnico) return;
    try {
      await api.delete(`/api/users/${selectedTecnico.id}`);
      await fetchTecnicos();
      setShowConfirmModal(false);
      setSelectedTecnico(null);
    } catch (error) {
      console.error('Error deleting tecnico:', error);
    }
  };

  const handleToggleStatus = (tecnico) => {
    setSelectedTecnico(tecnico);
    setStatusAction(tecnico.activo ? 'desactivar' : 'activar');
    setShowStatusModal(true);
  };

  const handleConfirmStatus = async () => {
    if (!selectedTecnico) return;
    try {
      await api.put(`/api/users/${selectedTecnico.id}`, { 
        activo: !selectedTecnico.activo 
      });
      await fetchTecnicos();
      setShowStatusModal(false);
      setSelectedTecnico(null);
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleViewDetail = (id) => {
    // TODO: Implementar modal de detalle
    console.log('Ver detalle:', id);
  };

  const handleEdit = (tecnico) => {
    setEditingTecnico(tecnico);
    setShowFormModal(true);
  };

  const userRole = user?.rol || 'usuario';
  const canEdit = userRole === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Técnicos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona el equipo de técnicos</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchTecnicos}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingTecnico(null);
                setShowFormModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Técnico
            </button>
          )}
        </div>
      </div>

      <TecnicoFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters({ estado: 'todos', search: '' })}
        onSearch={fetchTecnicos}
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <TecnicoTable
          tecnicos={filteredTecnicos}
          loading={loading}
          onViewDetail={handleViewDetail}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedTecnico(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Técnico"
        message={`¿Estás seguro de eliminar a "${selectedTecnico?.nombre1} ${selectedTecnico?.apellidos}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedTecnico(null);
        }}
        onConfirm={handleConfirmStatus}
        title={statusAction === 'activar' ? 'Activar Técnico' : 'Desactivar Técnico'}
        message={`¿Estás seguro de ${statusAction === 'activar' ? 'activar' : 'desactivar'} a "${selectedTecnico?.nombre1} ${selectedTecnico?.apellidos}"?`}
        confirmText={statusAction === 'activar' ? 'Activar' : 'Desactivar'}
        cancelText="Cancelar"
        variant={statusAction === 'activar' ? 'success' : 'warning'}
      />

      <TecnicoForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTecnico(null);
        }}
        onSubmit={editingTecnico ? handleUpdate : handleCreate}
        initialData={editingTecnico}
      />
    </div>
  );
};

export default Tecnicos;