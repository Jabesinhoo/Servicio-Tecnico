// frontend/src/pages/Dashboard/Tecnicos.jsx

import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import ConfirmModal from '../../components/ui/ConfirmModal';

import TecnicoTable from './tecnicos/components/TecnicoTable';
import TecnicoFilters from './tecnicos/components/TecnicoFilters';
import TecnicoForm from './tecnicos/TecnicoForm';

import {
  Plus,
  RefreshCw,
  Users,
  AlertCircle,
} from 'lucide-react';

const Tecnicos = () => {
  const { user } = useAuth();

  const [tecnicos, setTecnicos] = useState([]);
  const [filteredTecnicos, setFilteredTecnicos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    estado: 'todos',
    search: '',
  });

  const [showFormModal, setShowFormModal] =
    useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [showStatusModal, setShowStatusModal] =
    useState(false);

  const [selectedTecnico, setSelectedTecnico] =
    useState(null);

  const [editingTecnico, setEditingTecnico] =
    useState(null);

  const [statusAction, setStatusAction] =
    useState(null);

  // ============================================================
  // OBTENER TÉCNICOS
  // ============================================================

  const fetchTecnicos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /*
       * Backend:
       * GET /api/usuarios/role/:roleName
       */
      const response = await api.get(
        '/api/usuarios/role/tecnico'
      );

      /*
       * Soporta ambos formatos:
       *
       * { success: true, data: [...] }
       *
       * o directamente:
       *
       * [...]
       */
      let data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      // ========================================================
      // FILTRO POR ESTADO
      // ========================================================

      if (filters.estado === 'activos') {
        data = data.filter(
          (tecnico) => tecnico.activo === true
        );
      }

      if (filters.estado === 'inactivos') {
        data = data.filter(
          (tecnico) => tecnico.activo === false
        );
      }

      // ========================================================
      // BÚSQUEDA
      // ========================================================

      if (filters.search?.trim()) {
        const term =
          filters.search.trim().toLowerCase();

        data = data.filter((tecnico) => {
          const nombre =
            tecnico.nombre1?.toLowerCase() || '';

          const apellidos =
            tecnico.apellidos?.toLowerCase() || '';

          const usuario =
            tecnico.usuario?.toLowerCase() || '';

          const cedula =
            String(tecnico.cedula || '').toLowerCase();

          const email =
            tecnico.email?.toLowerCase() || '';

          return (
            nombre.includes(term) ||
            apellidos.includes(term) ||
            usuario.includes(term) ||
            cedula.includes(term) ||
            email.includes(term)
          );
        });
      }

      setTecnicos(data);
      setFilteredTecnicos(data);
    } catch (error) {
      console.error(
        'Error fetching tecnicos:',
        error
      );

      setTecnicos([]);
      setFilteredTecnicos([]);

      setError(
        error.response?.data?.message ||
          'No fue posible cargar los técnicos.'
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    fetchTecnicos();
  }, [fetchTecnicos]);

  // ============================================================
  // CREAR TÉCNICO
  // ============================================================

  const handleCreate = async (data) => {
    try {
      setLoading(true);
      setError(null);

      await api.post('/api/usuarios', {
        ...data,
        rol: 'tecnico',
      });

      setShowFormModal(false);

      await fetchTecnicos();
    } catch (error) {
      console.error(
        'Error creating tecnico:',
        error
      );

      setError(
        error.response?.data?.message ||
          'No fue posible crear el técnico.'
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ACTUALIZAR TÉCNICO
  // ============================================================

  const handleUpdate = async (data) => {
    if (!editingTecnico?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.put(
        `/api/usuarios/${editingTecnico.id}`,
        data
      );

      setEditingTecnico(null);
      setShowFormModal(false);

      await fetchTecnicos();
    } catch (error) {
      console.error(
        'Error updating tecnico:',
        error
      );

      setError(
        error.response?.data?.message ||
          'No fue posible actualizar el técnico.'
      );

      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ELIMINAR
  // ============================================================

  const handleDeleteClick = (tecnico) => {
    setSelectedTecnico(tecnico);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTecnico?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.delete(
        `/api/usuarios/${selectedTecnico.id}`
      );

      setShowConfirmModal(false);
      setSelectedTecnico(null);

      await fetchTecnicos();
    } catch (error) {
      console.error(
        'Error deleting tecnico:',
        error
      );

      setError(
        error.response?.data?.message ||
          'No fue posible eliminar el técnico.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ACTIVAR / DESACTIVAR
  // ============================================================

  const handleToggleStatus = (tecnico) => {
    setSelectedTecnico(tecnico);

    setStatusAction(
      tecnico.activo
        ? 'desactivar'
        : 'activar'
    );

    setShowStatusModal(true);
  };

  const handleConfirmStatus = async () => {
    if (!selectedTecnico?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.put(
        `/api/usuarios/${selectedTecnico.id}`,
        {
          activo: !selectedTecnico.activo,
        }
      );

      setShowStatusModal(false);
      setSelectedTecnico(null);

      await fetchTecnicos();
    } catch (error) {
      console.error(
        'Error toggling tecnico status:',
        error
      );

      setError(
        error.response?.data?.message ||
          'No fue posible cambiar el estado del técnico.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // VER DETALLE
  // ============================================================

  const handleViewDetail = (id) => {
    console.log(
      'Ver detalle técnico:',
      id
    );

    // TODO:
    // implementar modal o página de detalle
  };

  // ============================================================
  // EDITAR
  // ============================================================

  const handleEdit = (tecnico) => {
    setEditingTecnico(tecnico);
    setShowFormModal(true);
  };

  // ============================================================
  // PERMISOS
  // ============================================================

  const userRole =
    user?.role?.name ||
    user?.rol ||
    'usuario';

  const canEdit =
    userRole === 'admin';

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="page-shell space-y-6">

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="page-header">
        <div className="flex items-start gap-3">

          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              color: 'var(--color-primary)',
              backgroundColor:
                'var(--color-primary-light)',
            }}
          >
            <Users className="w-5 h-5" />
          </div>

          <div>
            <h1 className="page-title">
              Técnicos
            </h1>

            <p className="page-description">
              Gestiona el equipo de técnicos del
              sistema.
            </p>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row gap-2">

          <button
            type="button"
            onClick={fetchTecnicos}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Actualizar
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditingTecnico(null);
                setShowFormModal(true);
              }}
              className="btn-primary"
              disabled={loading}
            >
              <Plus className="w-4 h-4" />

              Nuevo Técnico
            </button>
          )}

        </div>
      </div>

      {/* ====================================================== */}
      {/* ERROR */}
      {/* ====================================================== */}

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{
            color: '#f87171',
            backgroundColor:
              'rgba(239,68,68,.10)',
            border:
              '1px solid rgba(239,68,68,.20)',
          }}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          <div className="flex-1 text-sm">
            {error}
          </div>

          <button
            type="button"
            onClick={() => setError(null)}
            className="icon-button"
          >
            ×
          </button>
        </div>
      )}

      {/* ====================================================== */}
      {/* FILTROS */}
      {/* ====================================================== */}

      <TecnicoFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() =>
          setFilters({
            estado: 'todos',
            search: '',
          })
        }
        onSearch={fetchTecnicos}
      />

      {/* ====================================================== */}
      {/* TABLA */}
      {/* ====================================================== */}

      <div className="surface overflow-hidden">
        <TecnicoTable
          tecnicos={filteredTecnicos}
          loading={loading}
          onViewDetail={handleViewDetail}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onToggleStatus={handleToggleStatus}
        />
      </div>

      {/* ====================================================== */}
      {/* CONFIRMAR ELIMINACIÓN */}
      {/* ====================================================== */}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedTecnico(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Técnico"
        message={
          `¿Estás seguro de eliminar a "${
            selectedTecnico?.nombre1 || ''
          } ${
            selectedTecnico?.apellidos || ''
          }"?`
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* ====================================================== */}
      {/* CONFIRMAR ESTADO */}
      {/* ====================================================== */}

      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedTecnico(null);
        }}
        onConfirm={handleConfirmStatus}
        title={
          statusAction === 'activar'
            ? 'Activar Técnico'
            : 'Desactivar Técnico'
        }
        message={
          `¿Estás seguro de ${
            statusAction === 'activar'
              ? 'activar'
              : 'desactivar'
          } a "${
            selectedTecnico?.nombre1 || ''
          } ${
            selectedTecnico?.apellidos || ''
          }"?`
        }
        confirmText={
          statusAction === 'activar'
            ? 'Activar'
            : 'Desactivar'
        }
        cancelText="Cancelar"
        variant={
          statusAction === 'activar'
            ? 'success'
            : 'warning'
        }
      />

      {/* ====================================================== */}
      {/* FORMULARIO */}
      {/* ====================================================== */}

      <TecnicoForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTecnico(null);
        }}
        onSubmit={
          editingTecnico
            ? handleUpdate
            : handleCreate
        }
        initialData={editingTecnico}
      />

    </div>
  );
};

export default Tecnicos;