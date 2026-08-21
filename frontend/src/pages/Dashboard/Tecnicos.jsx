// frontend/src/pages/Dashboard/Tecnicos.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import ConfirmModal from '../../components/ui/ConfirmModal';
import TecnicoForm from './tecnicos/TecnicoForm';

import {
  Plus,
  RefreshCw,
  Users,
  AlertCircle,
  Search,
  X,
  Edit3,
  Power,
  Trash2,
  Mail,
  UserRound,
  ShieldCheck,
} from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isTecnicoActivo = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value).toLowerCase() === 'true';

const getNombreCompleto = (tecnico) => {
  if (tecnico?.nombre_completo) {
    return tecnico.nombre_completo;
  }

  return [
    tecnico?.nombre1,
    tecnico?.nombre2,
    tecnico?.apellidos,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
};

// ============================================================
// COMPONENTE
// ============================================================

const Tecnicos = () => {
  const {
    user,
    hasPermission,
  } = useAuth();

  // ============================================================
  // ESTADOS
  // ============================================================

  const [tecnicos, setTecnicos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    estado: 'todos',
    search: '',
  });

  const [
    showFormModal,
    setShowFormModal,
  ] = useState(false);

  const [
    showConfirmModal,
    setShowConfirmModal,
  ] = useState(false);

  const [
    showStatusModal,
    setShowStatusModal,
  ] = useState(false);

  const [
    selectedTecnico,
    setSelectedTecnico,
  ] = useState(null);

  const [
    editingTecnico,
    setEditingTecnico,
  ] = useState(null);

  const [
    statusAction,
    setStatusAction,
  ] = useState(null);

  // ============================================================
  // PERMISOS
  // ============================================================

  const userRole =
    user?.role?.name ||
    user?.rol ||
    'usuario';

  const isAdmin =
    userRole === 'admin';

  /*
   * Técnicos son usuarios.
   *
   * Mientras terminamos de migrar completamente
   * el frontend a permisos granulares, Admin
   * conserva acceso total.
   */

  const canCreate =
    isAdmin ||
    hasPermission?.('usuarios_create');

  const canEdit =
    isAdmin ||
    hasPermission?.('usuarios_edit');

  const canDelete =
    isAdmin ||
    hasPermission?.('usuarios_delete');

  // ============================================================
  // OBTENER TÉCNICOS
  // ============================================================

  const fetchTecnicos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/api/usuarios/role/tecnico'
      );

      const data = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      /*
       * Guardamos SIEMPRE la colección completa.
       *
       * Los filtros se aplican después con useMemo.
       */
      setTecnicos(data);
    } catch (err) {
      console.error(
        'Error cargando técnicos:',
        err.response?.data || err
      );

      setTecnicos([]);

      setError(
        err.response?.data?.message ||
          'No fue posible cargar los técnicos.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    fetchTecnicos();
  }, [fetchTecnicos]);

  // ============================================================
  // FILTROS LOCALES
  // ============================================================

  const filteredTecnicos = useMemo(() => {
    const search = normalizeText(
      filters.search
    );

    const estado = String(
      filters.estado || 'todos'
    ).toLowerCase();

    return tecnicos.filter((tecnico) => {
      // ========================================================
      // BÚSQUEDA
      // ========================================================

      const searchableText = normalizeText(
        [
          tecnico?.nombre1,
          tecnico?.nombre2,
          tecnico?.apellidos,
          tecnico?.nombre_completo,
          tecnico?.usuario,
          tecnico?.cedula,
          tecnico?.email,
          tecnico?.celular,
          tecnico?.rol,
          tecnico?.role?.name,
        ]
          .filter(Boolean)
          .join(' ')
      );

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      // ========================================================
      // ESTADO
      // ========================================================

      const activo = isTecnicoActivo(
        tecnico?.activo
      );

      let matchesEstado = true;

      if (
        estado === 'activos' ||
        estado === 'activo' ||
        estado === 'true' ||
        estado === '1'
      ) {
        matchesEstado = activo;
      }

      if (
        estado === 'inactivos' ||
        estado === 'inactivo' ||
        estado === 'false' ||
        estado === '0'
      ) {
        matchesEstado = !activo;
      }

      return (
        matchesSearch &&
        matchesEstado
      );
    });
  }, [
    tecnicos,
    filters,
  ]);

  // ============================================================
  // CONTADORES
  // ============================================================

  const totalActivos = useMemo(
    () =>
      tecnicos.filter((tecnico) =>
        isTecnicoActivo(tecnico.activo)
      ).length,
    [tecnicos]
  );

  const totalInactivos =
    tecnicos.length - totalActivos;

  // ============================================================
  // CREAR TÉCNICO
  // ============================================================

  const handleCreate = async (data) => {
    try {
      setError('');

      /*
       * TecnicoForm ya resolvió dinámicamente
       * el role_id del rol "tecnico".
       *
       * NO mandamos:
       *
       * rol: 'tecnico'
       *
       * El backend sincroniza role_id -> rol.
       */

      await api.post(
        '/api/usuarios',
        data
      );

      await fetchTecnicos();
    } catch (err) {
      console.error(
        'Error creando técnico:',
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          'No fue posible crear el técnico.'
      );

      /*
       * Re-lanzamos para que TecnicoForm
       * pueda mostrar el error dentro del modal.
       */
      throw err;
    }
  };

  // ============================================================
  // ACTUALIZAR TÉCNICO
  // ============================================================

  const handleUpdate = async (data) => {
    if (!editingTecnico?.id) {
      throw new Error(
        'No hay un técnico seleccionado para editar.'
      );
    }

    try {
      setError('');

      await api.put(
        `/api/usuarios/${editingTecnico.id}`,
        data
      );

      await fetchTecnicos();

      setEditingTecnico(null);
    } catch (err) {
      console.error(
        'Error actualizando técnico:',
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          'No fue posible actualizar el técnico.'
      );

      throw err;
    }
  };

  // ============================================================
  // EDITAR
  // ============================================================

  const handleEdit = (tecnico) => {
    if (!canEdit) {
      return;
    }

    setEditingTecnico(tecnico);
    setShowFormModal(true);
  };

  // ============================================================
  // ACTIVAR / DESACTIVAR
  // ============================================================

  const handleToggleStatus = (tecnico) => {
    if (!canEdit) {
      return;
    }

    setSelectedTecnico(tecnico);

    setStatusAction(
      isTecnicoActivo(tecnico.activo)
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
      setError('');

      const nuevoEstado =
        !isTecnicoActivo(
          selectedTecnico.activo
        );

      await api.put(
        `/api/usuarios/${selectedTecnico.id}`,
        {
          activo: nuevoEstado,
        }
      );

      setShowStatusModal(false);
      setSelectedTecnico(null);
      setStatusAction(null);

      await fetchTecnicos();
    } catch (err) {
      console.error(
        'Error cambiando estado del técnico:',
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          'No fue posible cambiar el estado del técnico.'
      );
    }
  };

  // ============================================================
  // DAR DE BAJA
  // ============================================================

  const handleDeleteClick = (tecnico) => {
    if (!canDelete) {
      return;
    }

    setSelectedTecnico(tecnico);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTecnico?.id) {
      return;
    }

    try {
      setError('');

      /*
       * Utilizamos el endpoint existente.
       *
       * El backend es quien define la política
       * de eliminación / soft-delete.
       */
      await api.delete(
        `/api/usuarios/${selectedTecnico.id}`
      );

      setShowConfirmModal(false);
      setSelectedTecnico(null);

      await fetchTecnicos();
    } catch (err) {
      console.error(
        'Error dando de baja técnico:',
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          'No fue posible dar de baja al técnico.'
      );
    }
  };

  // ============================================================
  // LIMPIAR FILTROS
  // ============================================================

  const clearFilters = () => {
    setFilters({
      estado: 'todos',
      search: '',
    });
  };

  const hasFilters =
    Boolean(filters.search) ||
    filters.estado !== 'todos';

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="page-shell space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

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
              Gestiona las cuentas del equipo
              técnico del sistema.
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

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingTecnico(null);
                setShowFormModal(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />

              Nuevo Técnico
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

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
            onClick={() => setError('')}
            className="icon-button"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================
          RESUMEN
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total técnicos
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {tecnicos.length}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Activos
          </p>

          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {totalActivos}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Inactivos
          </p>

          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {totalInactivos}
          </p>
        </div>
      </div>

      {/* ======================================================
          FILTROS
      ====================================================== */}

      <div className="surface p-4">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Buscar */}

          <div className="md:col-span-2">

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar técnico
            </label>

            <div className="relative">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    search: event.target.value,
                  }))
                }
                placeholder="Nombre, usuario, correo, cédula o celular..."
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {filters.search && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((previous) => ({
                      ...previous,
                      search: '',
                    }))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Estado */}

          <div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estado
            </label>

            <select
              value={filters.estado}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  estado: event.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">
                Todos
              </option>

              <option value="activos">
                Activos
              </option>

              <option value="inactivos">
                Inactivos
              </option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mostrando{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {filteredTecnicos.length}
            </span>{' '}
            de{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {tecnicos.length}
            </span>{' '}
            técnicos.
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          TABLA
      ====================================================== */}

      <div className="surface overflow-hidden">

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">

              <thead className="bg-gray-50 dark:bg-gray-800/60">

                <tr>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Técnico
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Contacto
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Rol
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Estado
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Acciones
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">

                {filteredTecnicos.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      No hay técnicos que coincidan
                      con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredTecnicos.map((tecnico) => {
                    const activo =
                      isTecnicoActivo(
                        tecnico.activo
                      );

                    return (
                      <tr
                        key={tecnico.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      >

                        {/* Técnico */}

                        <td className="px-4 py-4">

                          <div className="flex items-start gap-3">

                            <div className="mt-0.5 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                              <UserRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>

                            <div className="min-w-0">

                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {getNombreCompleto(tecnico) ||
                                  'Sin nombre'}
                              </p>

                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                @{tecnico.usuario ||
                                  'sin-usuario'}
                              </p>

                              {tecnico.cedula && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                  CC {tecnico.cedula}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}

                        <td className="px-4 py-4">

                          <div className="space-y-1">

                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">

                              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />

                              <span className="break-all">
                                {tecnico.email || '—'}
                              </span>
                            </div>

                            {tecnico.celular && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {tecnico.celular}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Rol */}

                        <td className="px-4 py-4">

                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">

                            <ShieldCheck className="w-3 h-3" />

                            {tecnico.role?.name ||
                              tecnico.rol ||
                              'tecnico'}

                          </span>
                        </td>

                        {/* Estado */}

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                              activo
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                          >
                            {activo
                              ? 'Activo'
                              : 'Inactivo'}
                          </span>
                        </td>

                        {/* Acciones */}

                        <td className="px-4 py-4">

                          <div className="flex items-center justify-end gap-2">

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(tecnico)
                                }
                                className="p-2 rounded-lg text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors"
                                title="Editar técnico"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleStatus(
                                    tecnico
                                  )
                                }
                                className={`p-2 rounded-lg transition-colors ${
                                  activo
                                    ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30'
                                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'
                                }`}
                                title={
                                  activo
                                    ? 'Desactivar técnico'
                                    : 'Activar técnico'
                                }
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteClick(
                                    tecnico
                                  )
                                }
                                className="p-2 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                                title="Dar de baja"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================
          MODAL BAJA
      ====================================================== */}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedTecnico(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Dar de baja técnico"
        message={`¿Estás seguro de dar de baja a "${
          getNombreCompleto(selectedTecnico) ||
          selectedTecnico?.usuario ||
          'este técnico'
        }"?`}
        confirmText="Dar de baja"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* ======================================================
          MODAL ESTADO
      ====================================================== */}

      <ConfirmModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedTecnico(null);
          setStatusAction(null);
        }}
        onConfirm={handleConfirmStatus}
        title={
          statusAction === 'activar'
            ? 'Activar Técnico'
            : 'Desactivar Técnico'
        }
        message={`¿Estás seguro de ${
          statusAction === 'activar'
            ? 'activar'
            : 'desactivar'
        } a "${
          getNombreCompleto(selectedTecnico) ||
          selectedTecnico?.usuario ||
          'este técnico'
        }"?`}
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

      {/* ======================================================
          FORMULARIO
      ====================================================== */}

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