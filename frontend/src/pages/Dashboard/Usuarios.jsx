import "../responsive.css";
// src/pages/Dashboard/Usuarios.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import UsuarioTable from './usuarios/components/UsuarioTable';
import UsuarioFilters from './usuarios/components/UsuarioFilters';
import UsuarioForm from './usuarios/UsuarioForm';
import { Plus, RefreshCw, Users } from 'lucide-react';

const Usuarios = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ rol: '', estado: 'todos', search: '' });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [statusAction, setStatusAction] = useState(null);

  // src/pages/Dashboard/Usuarios.jsx - corregir la URL
const fetchUsuarios = useCallback(async () => {
  try {
    setLoading(true);
    let url = '/api/users';  // Esta es la URL correcta
    const params = new URLSearchParams();
    
    if (filters.rol) params.append('rol', filters.rol);
    
    const res = await api.get(`${url}?${params.toString()}`);
    let data = res.data || [];
    
    // Filtrar por estado
    if (filters.estado === 'activos') {
      data = data.filter(u => u.activo === true);
    } else if (filters.estado === 'inactivos') {
      data = data.filter(u => u.activo === false);
    }
    
    // Filtrar por búsqueda
    if (filters.search) {
      const term = filters.search.toLowerCase();
      data = data.filter(u =>
        u.nombre1?.toLowerCase().includes(term) ||
        u.apellidos?.toLowerCase().includes(term) ||
        u.usuario?.toLowerCase().includes(term) ||
        u.cedula?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      );
    }
    
    setUsuarios(data);
    setFilteredUsuarios(data);
  } catch (error) {
    console.error('Error fetching usuarios:', error);
  } finally {
    setLoading(false);
  }
}, [filters]);
  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleCreate = async (data) => {
    await api.post('/api/users', data);
    await fetchUsuarios();
  };

  const handleUpdate = async (data) => {
    await api.put(`/api/users/${editingUsuario.id}`, data);
    setEditingUsuario(null);
    await fetchUsuarios();
  };

  const handleDeleteClick = (usuario) => {
    setSelectedUsuario(usuario);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUsuario) return;
    try {
      await api.delete(`/api/users/${selectedUsuario.id}`);
      await fetchUsuarios();
      setShowConfirmModal(false);
      setSelectedUsuario(null);
    } catch (error) {
      console.error('Error deleting usuario:', error);
    }
  };

  const handleToggleStatus = (usuario) => {
    setSelectedUsuario(usuario);
    setStatusAction(usuario.activo ? 'desactivar' : 'activar');
    setShowStatusModal(true);
  };

  const handleConfirmStatus = async () => {
    if (!selectedUsuario) return;
    try {
      await api.put(`/api/users/${selectedUsuario.id}`, { 
        activo: !selectedUsuario.activo 
      });
      await fetchUsuarios();
      setShowStatusModal(false);
      setSelectedUsuario(null);
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleViewDetail = (id) => {
    // TODO: Implementar modal de detalle
    console.log('Ver detalle:', id);
  };

  const handleEdit = (usuario) => {
    setEditingUsuario(usuario);
    setShowFormModal(true);
  };

  const userRole = user?.rol || 'usuario';
  const canEdit = userRole === 'admin';

  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona los usuarios del sistema y sus roles</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchUsuarios}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingUsuario(null);
                setShowFormModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      <UsuarioFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters({ rol: '', estado: 'todos', search: '' })}
        onSearch={fetchUsuarios}
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <UsuarioTable
          usuarios={filteredUsuarios}
          loading={loading}
          onViewDetail={handleViewDetail}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onToggleStatus={handleToggleStatus}
          canEdit={canEdit}
        />
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedUsuario(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Usuario"
        message={`¿Estás seguro de eliminar a "${selectedUsuario?.nombre1} ${selectedUsuario?.apellidos}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedUsuario(null);
        }}
        onConfirm={handleConfirmStatus}
        title={statusAction === 'activar' ? 'Activar Usuario' : 'Desactivar Usuario'}
        message={`¿Estás seguro de ${statusAction === 'activar' ? 'activar' : 'desactivar'} a "${selectedUsuario?.nombre1} ${selectedUsuario?.apellidos}"?`}
        confirmText={statusAction === 'activar' ? 'Activar' : 'Desactivar'}
        cancelText="Cancelar"
        variant={statusAction === 'activar' ? 'success' : 'warning'}
      />

      <UsuarioForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingUsuario(null);
        }}
        onSubmit={editingUsuario ? handleUpdate : handleCreate}
        initialData={editingUsuario}
      />
    </div>
  );
};

export default Usuarios;