// src/pages/Dashboard/Usuarios.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import ConfirmModal from '../../components/ui/ConfirmModal';
import UsuarioForm from './usuarios/UsuarioForm';

import {
  Plus,
  RefreshCw,
  Search,
  X,
  Users,
  Edit,
  Power,
  Shield,
  Mail,
  UserRound,
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

const isUsuarioActivo = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value).toLowerCase() === 'true';

const getNombreCompleto = (usuario) => {
  if (usuario?.nombre_completo) {
    return usuario.nombre_completo;
  }

  return [
    usuario?.nombre1,
    usuario?.nombre2,
    usuario?.apellidos,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const getRoleName = (usuario) =>
  usuario?.role?.name ||
  usuario?.rol ||
  'Sin rol';

// ============================================================
// COMPONENTE
// ============================================================

const Usuarios = () => {
  const {
    user,
    hasPermission,
  } = useAuth();

  const [usuarios, setUsuarios] =
    useState([]);

  const [roles, setRoles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [rolesLoading, setRolesLoading] =
    useState(false);

  const [pageError, setPageError] =
    useState('');

  const [filters, setFilters] =
    useState({
      search: '',
      estado: 'todos',
      role_id: '',
    });

  const [
    showFormModal,
    setShowFormModal,
  ] = useState(false);

  const [
    showStatusModal,
    setShowStatusModal,
  ] = useState(false);

  const [
    editingUsuario,
    setEditingUsuario,
  ] = useState(null);

  const [
    selectedUsuario,
    setSelectedUsuario,
  ] = useState(null);

  const [
    statusAction,
    setStatusAction,
  ] = useState(null);

  // ============================================================
  // PERMISOS
  // ============================================================

  const isAdmin =
    user?.rol === 'admin' ||
    user?.role?.name === 'admin';

  const canCreate =
    isAdmin ||
    hasPermission?.(
      'usuarios_create'
    );

  const canEdit =
    isAdmin ||
    hasPermission?.(
      'usuarios_edit'
    );

  // ============================================================
  // CARGAR USUARIOS
  // ============================================================

  const fetchUsuarios =
    useCallback(async () => {
      try {
        setLoading(true);
        setPageError('');

        const response =
          await api.get(
            '/api/usuarios'
          );

        const data =
          Array.isArray(
            response.data?.data
          )
            ? response.data.data
            : Array.isArray(
                  response.data
                )
              ? response.data
              : [];

        setUsuarios(data);
      } catch (error) {
        console.error(
          'Error cargando usuarios:',
          error.response?.data ||
            error
        );

        setUsuarios([]);

        setPageError(
          error.response?.data
            ?.message ||
            'No fue posible cargar los usuarios'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  // ============================================================
  // CARGAR ROLES DINÁMICAMENTE
  // ============================================================

  const fetchRoles =
    useCallback(async () => {
      try {
        setRolesLoading(true);

        const response =
          await api.get(
            '/api/roles'
          );

        const data =
          Array.isArray(
            response.data?.data
          )
            ? response.data.data
            : Array.isArray(
                  response.data
                )
              ? response.data
              : [];

        setRoles(
          data
            .filter(
              (role) =>
                role.active !== false
            )
            .sort((a, b) =>
              String(
                a.name || ''
              ).localeCompare(
                String(
                  b.name || ''
                ),
                'es',
                {
                  sensitivity:
                    'base',
                }
              )
            )
        );
      } catch (error) {
        console.error(
          'Error cargando roles:',
          error.response?.data ||
            error
        );

        /*
         * No bloqueamos la pantalla.
         * Si alguien puede ver usuarios
         * pero no roles, la lista de
         * usuarios debe seguir funcionando.
         */
        setRoles([]);
      } finally {
        setRolesLoading(false);
      }
    }, []);

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
  }, [
    fetchUsuarios,
    fetchRoles,
  ]);

  // ============================================================
  // FILTRADO LOCAL
  // ============================================================

  const filteredUsuarios =
    useMemo(() => {
      const search =
        normalizeText(
          filters.search
        );

      const estado =
        String(
          filters.estado ||
            'todos'
        ).toLowerCase();

      return usuarios.filter(
        (usuario) => {
          // ====================================================
          // BUSCADOR
          // ====================================================

          const searchableText =
            normalizeText(
              [
                usuario?.nombre1,
                usuario?.nombre2,
                usuario?.apellidos,
                usuario?.nombre_completo,
                usuario?.usuario,
                usuario?.email,
                usuario?.cedula,
                usuario?.celular,
                usuario?.rol,
                usuario?.role?.name,
                usuario?.role
                  ?.description,
              ]
                .filter(Boolean)
                .join(' ')
            );

          const matchesSearch =
            !search ||
            searchableText.includes(
              search
            );

          // ====================================================
          // ESTADO
          // ====================================================

          const active =
            isUsuarioActivo(
              usuario?.activo
            );

          let matchesEstado = true;

          if (
            estado === 'activo' ||
            estado === 'activos' ||
            estado === 'true' ||
            estado === '1'
          ) {
            matchesEstado =
              active;
          }

          if (
            estado ===
              'inactivo' ||
            estado ===
              'inactivos' ||
            estado === 'false' ||
            estado === '0'
          ) {
            matchesEstado =
              !active;
          }

          // ====================================================
          // ROL
          // ====================================================

          const usuarioRoleId =
            usuario?.role_id ??
            usuario?.role?.id ??
            '';

          const matchesRole =
            !filters.role_id ||
            Number(
              usuarioRoleId
            ) ===
              Number(
                filters.role_id
              );

          return (
            matchesSearch &&
            matchesEstado &&
            matchesRole
          );
        }
      );
    }, [
      usuarios,
      filters,
    ]);

  // ============================================================
  // CREAR
  // ============================================================

  const handleCreate =
    async (data) => {
      await api.post(
        '/api/usuarios',
        data
      );

      await fetchUsuarios();
      await fetchRoles();
    };

  // ============================================================
  // EDITAR
  // ============================================================

  const handleUpdate =
    async (data) => {
      if (
        !editingUsuario?.id
      ) {
        throw new Error(
          'No hay un usuario seleccionado para editar'
        );
      }

      await api.put(
        `/api/usuarios/${editingUsuario.id}`,
        data
      );

      setEditingUsuario(
        null
      );

      await fetchUsuarios();
      await fetchRoles();
    };

  const handleEdit = (
    usuario
  ) => {
    setEditingUsuario(
      usuario
    );

    setShowFormModal(
      true
    );
  };

  // ============================================================
  // ACTIVAR / DESACTIVAR
  // ============================================================

  const handleToggleStatus = (
    usuario
  ) => {
    setSelectedUsuario(
      usuario
    );

    setStatusAction(
      isUsuarioActivo(
        usuario.activo
      )
        ? 'desactivar'
        : 'activar'
    );

    setShowStatusModal(
      true
    );
  };

  const handleConfirmStatus =
    async () => {
      if (
        !selectedUsuario?.id
      ) {
        return;
      }

      try {
        const nuevoEstado =
          !isUsuarioActivo(
            selectedUsuario.activo
          );

        await api.put(
          `/api/usuarios/${selectedUsuario.id}`,
          {
            activo:
              nuevoEstado,
          }
        );

        await fetchUsuarios();

        setShowStatusModal(
          false
        );

        setSelectedUsuario(
          null
        );

        setStatusAction(
          null
        );
      } catch (error) {
        console.error(
          'Error cambiando estado del usuario:',
          error.response?.data ||
            error
        );

        setPageError(
          error.response?.data
            ?.message ||
            'No fue posible cambiar el estado del usuario'
        );
      }
    };

  // ============================================================
  // FILTROS
  // ============================================================

  const clearFilters = () => {
    setFilters({
      search: '',
      estado: 'todos',
      role_id: '',
    });
  };

  const hasActiveFilters =
    Boolean(
      filters.search
    ) ||
    filters.estado !==
      'todos' ||
    Boolean(
      filters.role_id
    );

  // ============================================================
  // CONTADORES
  // ============================================================

  const totalActivos =
    useMemo(
      () =>
        usuarios.filter(
          (usuario) =>
            isUsuarioActivo(
              usuario.activo
            )
        ).length,
      [usuarios]
    );

  const totalInactivos =
    usuarios.length -
    totalActivos;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">

      {/* ======================================================
          CABECERA
      ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">

            <Users className="w-6 h-6" />

            Usuarios
          </h1>

          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona cuentas,
            roles y estados de
            acceso.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={() => {
              fetchUsuarios();
              fetchRoles();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
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
                setEditingUsuario(
                  null
                );

                setShowFormModal(
                  true
                );
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >

              <Plus className="w-4 h-4" />

              Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {pageError && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">

          <div className="flex items-center justify-between gap-3">

            <p className="text-sm text-red-700 dark:text-red-300">
              {pageError}
            </p>

            <button
              type="button"
              onClick={() =>
                setPageError('')
              }
              className="text-red-500 hover:text-red-700"
              aria-label="Cerrar error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          RESUMEN
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">

          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total usuarios
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {usuarios.length}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">

          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Activos
          </p>

          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {totalActivos}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">

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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Buscar */}

          <div className="lg:col-span-2">

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar
            </label>

            <div className="relative">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

              <input
                type="search"
                value={
                  filters.search
                }
                onChange={(
                  event
                ) =>
                  setFilters(
                    (
                      previous
                    ) => ({
                      ...previous,
                      search:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Nombre, usuario, correo, cédula, celular o rol..."
                className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {filters.search && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters(
                      (
                        previous
                      ) => ({
                        ...previous,
                        search: '',
                      })
                    )
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
              value={
                filters.estado
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    estado:
                      event
                        .target
                        .value,
                  })
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">
                Todos
              </option>

              <option value="activo">
                Activos
              </option>

              <option value="inactivo">
                Inactivos
              </option>
            </select>
          </div>

          {/* Rol */}

          <div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rol
            </label>

            <select
              value={
                filters.role_id
              }
              onChange={(
                event
              ) =>
                setFilters(
                  (
                    previous
                  ) => ({
                    ...previous,
                    role_id:
                      event
                        .target
                        .value,
                  })
                )
              }
              disabled={
                rolesLoading
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            >
              <option value="">
                {rolesLoading
                  ? 'Cargando roles...'
                  : 'Todos los roles'}
              </option>

              {roles.map(
                (role) => (
                  <option
                    key={
                      role.id
                    }
                    value={String(
                      role.id
                    )}
                  >
                    {role.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          <p className="text-sm text-gray-500 dark:text-gray-400">

            Mostrando{' '}

            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {
                filteredUsuarios.length
              }
            </span>{' '}

            de{' '}

            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {usuarios.length}
            </span>{' '}

            usuarios.
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          TABLA
      ====================================================== */}

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">

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
                    Usuario
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

                {filteredUsuarios.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      No hay usuarios
                      que coincidan con
                      los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map(
                    (usuario) => {
                      const active =
                        isUsuarioActivo(
                          usuario.activo
                        );

                      return (
                        <tr
                          key={
                            usuario.id
                          }
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        >

                          {/* Usuario */}

                          <td className="px-4 py-4">

                            <div className="flex items-start gap-3">

                              <div className="mt-0.5 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">

                                <UserRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />

                              </div>

                              <div className="min-w-0">

                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {getNombreCompleto(
                                    usuario
                                  ) ||
                                    'Sin nombre'}
                                </p>

                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">

                                  @
                                  {usuario.usuario ||
                                    'sin-usuario'}

                                </p>

                                {usuario.cedula && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    CC{' '}
                                    {
                                      usuario.cedula
                                    }
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
                                  {usuario.email ||
                                    '—'}
                                </span>
                              </div>

                              {usuario.celular && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {
                                    usuario.celular
                                  }
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Rol */}

                          <td className="px-4 py-4">

                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">

                              <Shield className="w-3 h-3" />

                              {getRoleName(
                                usuario
                              )}

                            </span>
                          </td>

                          {/* Estado */}

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                active
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              }`}
                            >
                              {active
                                ? 'Activo'
                                : 'Inactivo'}
                            </span>
                          </td>

                          {/* Acciones */}

                          <td className="px-4 py-4">

                            <div className="flex items-center justify-end gap-2">

                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEdit(
                                        usuario
                                      )
                                    }
                                    className="p-2 rounded-lg text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors"
                                    title="Editar usuario"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleStatus(
                                        usuario
                                      )
                                    }
                                    className={`p-2 rounded-lg transition-colors ${
                                      active
                                        ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30'
                                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'
                                    }`}
                                    title={
                                      active
                                        ? 'Desactivar usuario'
                                        : 'Activar usuario'
                                    }
                                  >
                                    <Power className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================
          MODAL ESTADO
      ====================================================== */}

      <ConfirmModal
        isOpen={
          showStatusModal
        }
        onClose={() => {
          setShowStatusModal(
            false
          );

          setSelectedUsuario(
            null
          );

          setStatusAction(
            null
          );
        }}
        onConfirm={
          handleConfirmStatus
        }
        title={
          statusAction ===
          'activar'
            ? 'Activar Usuario'
            : 'Desactivar Usuario'
        }
        message={`¿Estás seguro de ${
          statusAction ===
          'activar'
            ? 'activar'
            : 'desactivar'
        } a "${
          getNombreCompleto(
            selectedUsuario
          ) ||
          selectedUsuario?.usuario ||
          'este usuario'
        }"?`}
        confirmText={
          statusAction ===
          'activar'
            ? 'Activar'
            : 'Desactivar'
        }
        cancelText="Cancelar"
        variant={
          statusAction ===
          'activar'
            ? 'success'
            : 'warning'
        }
      />

      {/* ======================================================
          FORMULARIO
      ====================================================== */}

      <UsuarioForm
        isOpen={
          showFormModal
        }
        onClose={() => {
          setShowFormModal(
            false
          );

          setEditingUsuario(
            null
          );
        }}
        onSubmit={
          editingUsuario
            ? handleUpdate
            : handleCreate
        }
        initialData={
          editingUsuario
        }
      />
    </div>
  );
};

export default Usuarios;