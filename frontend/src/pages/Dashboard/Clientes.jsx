// src/pages/Dashboard/Clientes.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ClienteDetailModal from './clientes/ClienteDetailModal';
import ClienteForm from './ClienteForm';
import ClientCard from './clientes/components/ClientCard';
import { Plus, RefreshCw, Search, X, Eye, Edit, Trash2, Phone, Mail, MapPin, LayoutGrid, Table } from 'lucide-react';

const Clientes = () => {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' o 'cards'
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState(null);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [editingCliente, setEditingCliente] = useState(null);

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/clients');
      setClientes(res.data || []);
      setFilteredClientes(res.data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredClientes(clientes);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = clientes.filter(c => {
        const nombreCompleto = c.tipo_persona === 'natural' 
          ? `${c.primer_nombre || ''} ${c.primer_apellido || ''}`.trim()
          : c.razon_social || '';
        return (
          nombreCompleto.toLowerCase().includes(term) ||
          c.documento?.toLowerCase().includes(term) ||
          c.telefono?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term)
        );
      });
      setFilteredClientes(filtered);
    }
  }, [searchTerm, clientes]);

  const handleCreate = async (data) => {
    try {
      await api.post('/api/clients', data);
      await fetchClientes();
      setShowFormModal(false);
    } catch (error) {
      console.error('Error creating client:', error);
      setErrorModalMessage(error.response?.data?.message || 'Error al crear el cliente');
      setShowErrorModal(true);
    }
  };

  const handleUpdate = async (data) => {
    try {
      await api.put(`/api/clients/${editingCliente.id}`, data);
      await fetchClientes();
      setShowFormModal(false);
      setEditingCliente(null);
    } catch (error) {
      console.error('Error updating client:', error);
      setErrorModalMessage(error.response?.data?.message || 'Error al actualizar el cliente');
      setShowErrorModal(true);
    }
  };

  const handleDeleteClick = (cliente) => {
    setClienteToDelete(cliente);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!clienteToDelete) return;

    try {
      await api.delete(`/api/clients/${clienteToDelete.id}`);
      await fetchClientes();
      setShowConfirmModal(false);
      setClienteToDelete(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      setErrorModalMessage(error.response?.data?.message || 'Error al eliminar el cliente');
      setShowErrorModal(true);
    }
  };

  const handleViewDetail = (id) => {
    setSelectedClienteId(id);
    setShowDetailModal(true);
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setShowFormModal(true);
  };

  const getNombreMostrar = (cliente) => {
    if (cliente.tipo_persona === 'juridica') {
      return cliente.razon_social || '—';
    }
    return `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim() || '—';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona la base de datos de clientes</p>
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
            onClick={fetchClientes}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingCliente(null);
                setShowFormModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
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
            placeholder="Buscar por nombre, razón social, documento, teléfono o email..."
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre / Razón Social</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contacto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No hay clientes registrados
                    </td>
                  </tr>
                ) : (
                  filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {getNombreMostrar(cliente)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {cliente.documento || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {cliente.telefono && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <Phone className="w-3 h-3" />
                              <span>{cliente.telefono}</span>
                            </div>
                          )}
                          {cliente.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{cliente.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          cliente.tipo_persona === 'juridica' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {cliente.tipo_persona === 'juridica' ? 'Empresa' : 'Persona Natural'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetail(cliente.id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleEdit(cliente)}
                                className="text-green-600 hover:text-green-800 dark:text-green-400 p-1"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(cliente)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 p-1"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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
          {filteredClientes.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No hay clientes registrados
            </div>
          ) : (
            filteredClientes.map((cliente) => (
              <ClientCard
                key={cliente.id}
                cliente={cliente}
                onViewDetail={handleViewDetail}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      )}

      {/* Modales */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setClienteToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Cliente"
        message={`¿Estás seguro de eliminar a "${clienteToDelete?.tipo_persona === 'juridica' ? clienteToDelete?.razon_social : `${clienteToDelete?.primer_nombre} ${clienteToDelete?.primer_apellido}`}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        title="Error"
        message={errorModalMessage}
        confirmText="Aceptar"
        cancelText={null}
        variant="warning"
      />

      <ClienteDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedClienteId(null);
        }}
        clienteId={selectedClienteId}
        onRefresh={fetchClientes}
      />

      <ClienteForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingCliente(null);
        }}
        onSubmit={editingCliente ? handleUpdate : handleCreate}
        initialData={editingCliente}
      />
    </div>
  );
};

export default Clientes;