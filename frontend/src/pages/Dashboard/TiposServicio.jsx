// src/pages/Dashboard/TiposServicio.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import TipoServicioForm from './tipos-servicio/TipoServicioForm';
import TipoServicioCard from './tipos-servicio/components/TipoServicioCard';
import { Plus, RefreshCw, Search, X, Edit, Trash2, Clock, DollarSign, LayoutGrid, Table, CheckCircle, XCircle } from 'lucide-react';

const TiposServicio = () => {
  const { user } = useAuth();
  const [tipos, setTipos] = useState([]);
  const [filteredTipos, setFilteredTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [editingTipo, setEditingTipo] = useState(null);
  const [statusAction, setStatusAction] = useState(null);

  const fetchTipos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tipos-servicio');
      setTipos(res.data || []);
      setFilteredTipos(res.data || []);
    } catch (error) {
      console.error('Error fetching tipos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTipos();
  }, [fetchTipos]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTipos(tipos);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = tipos.filter(t =>
        t.nombre?.toLowerCase().includes(term) ||
        t.categoria?.toLowerCase().includes(term) ||
        t.descripcion?.toLowerCase().includes(term)
      );
      setFilteredTipos(filtered);
    }
  }, [searchTerm, tipos]);

  const handleCreate = async (data) => {
    await api.post('/api/tipos-servicio', data);
    await fetchTipos();
  };

  const handleUpdate = async (data) => {
    await api.put(`/api/tipos-servicio/${editingTipo.id}`, data);
    setEditingTipo(null);
    await fetchTipos();
  };

  const handleDeleteClick = (tipo) => {
    setSelectedTipo(tipo);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTipo) return;
    try {
      await api.delete(`/api/tipos-servicio/${selectedTipo.id}`);
      await fetchTipos();
      setShowConfirmModal(false);
      setSelectedTipo(null);
    } catch (error) {
      console.error('Error deleting tipo:', error);
    }
  };

  const handleToggleStatus = (tipo) => {
    setSelectedTipo(tipo);
    setStatusAction(tipo.activo ? 'desactivar' : 'activar');
    setShowStatusModal(true);
  };

  const handleConfirmStatus = async () => {
    if (!selectedTipo) return;
    try {
      await api.put(`/api/tipos-servicio/${selectedTipo.id}`, { 
        activo: !selectedTipo.activo 
      });
      await fetchTipos();
      setShowStatusModal(false);
      setSelectedTipo(null);
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleEdit = (tipo) => {
    setEditingTipo(tipo);
    setShowFormModal(true);
  };

  const userRole = user?.rol || 'usuario';
  const canEdit = userRole === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tipos de Servicio</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona los tipos de servicios predefinidos</p>
        </div>
        <div className="flex gap-3">
          {/* Botones de cambio de vista */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tabla"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          
          <button
            onClick={fetchTipos}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingTipo(null);
                setShowFormModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Tipo
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, categoría o descripción..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Vista de Tabla */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor Base</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duración</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredTipos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No hay tipos de servicio registrados
                    </td>
                  </tr>
                ) : (
                  filteredTipos.map((tipo) => (
                    <tr key={tipo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {tipo.nombre}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {tipo.categoria || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        ${Number(tipo.valor_base).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {tipo.duracion_estimada} min
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(tipo)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                            tipo.activo 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {tipo.activo ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {tipo.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tipo)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteClick(tipo)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                              title="Eliminar permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista de Tarjetas */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTipos.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No hay tipos de servicio registrados
            </div>
          ) : (
            filteredTipos.map((tipo) => (
              <TipoServicioCard
                key={tipo.id}
                tipo={tipo}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleStatus={handleToggleStatus}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      )}

      {/* Modal para Eliminar (físicamente) */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedTipo(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Tipo de Servicio"
        message={`¿Estás seguro de ELIMINAR PERMANENTEMENTE el tipo de servicio "${selectedTipo?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar Permanentemente"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal para Activar/Desactivar */}
      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedTipo(null);
        }}
        onConfirm={handleConfirmStatus}
        title={statusAction === 'activar' ? 'Activar Tipo de Servicio' : 'Desactivar Tipo de Servicio'}
        message={`¿Estás seguro de ${statusAction === 'activar' ? 'activar' : 'desactivar'} el tipo de servicio "${selectedTipo?.nombre}"?`}
        confirmText={statusAction === 'activar' ? 'Activar' : 'Desactivar'}
        cancelText="Cancelar"
        variant={statusAction === 'activar' ? 'success' : 'warning'}
      />

      <TipoServicioForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTipo(null);
        }}
        onSubmit={editingTipo ? handleUpdate : handleCreate}
        initialData={editingTipo}
      />
    </div>
  );
};

export default TiposServicio;