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
import UsuarioDetailModal from './usuarios/UsuarioDetailModal';

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
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
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

const formatDateTimeShort = (value) => {
  if (!value) {
    return 'Nunca';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

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

  const [pageSuccess, setPageSuccess] =
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


  const [
    showPasswordModal,
    setShowPasswordModal,
  ] = useState(false);

  const [
    passwordUsuario,
    setPasswordUsuario,
  ] = useState(null);

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState('');

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    passwordLoading,
    setPasswordLoading,
  ] = useState(false);

  const [
    passwordError,
    setPasswordError,
  ] = useState('');

  const [
    detailUsuarioId,
    setDetailUsuarioId,
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
  // RESTABLECER CONTRASEÑA (ADMIN)
  // ============================================================

  const openPasswordModal = (usuario) => {
    if (!isAdmin) {
      return;
    }

    setPasswordUsuario(usuario);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setPasswordError('');
    setPageSuccess('');
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (passwordLoading) {
      return;
    }

    setShowPasswordModal(false);
    setPasswordUsuario(null);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setPasswordError('');
  };

  const handleAdminPasswordReset = async (event) => {
    event.preventDefault();

    if (!isAdmin || !passwordUsuario?.id) {
      setPasswordError(
        'Solo un administrador puede restablecer contraseñas.'
      );
      return;
    }

    if (!newPassword) {
      setPasswordError('La nueva contraseña es requerida.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        'La nueva contraseña debe tener mínimo 8 caracteres.'
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError('');
      setPageError('');
      setPageSuccess('');

      await api.put(
        `/api/usuarios/${passwordUsuario.id}/password`,
        {
          // No se aplica trim: las contraseñas se respetan exactamente.
          newPassword,
        }
      );

      const nombre =
        getNombreCompleto(passwordUsuario) ||
        passwordUsuario.usuario ||
        'el usuario';

      await fetchUsuarios();

      setShowPasswordModal(false);
      setPasswordUsuario(null);
      setNewPassword('');
      setConfirmNewPassword('');
      setShowNewPassword(false);

      setPageSuccess(
        `Contraseña de ${nombre} actualizada correctamente.`
      );
    } catch (error) {
      console.error(
        'Error restableciendo contraseña:',
        error.response?.data || error
      );

      setPasswordError(
        error.response?.data?.message ||
          'No fue posible restablecer la contraseña.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // ============================================================
  // FICHA DEL USUARIO (ADMIN)
  // ============================================================

  const openUserDetail = (usuario) => {
    if (!isAdmin || !usuario?.id) {
      return;
    }

    setDetailUsuarioId(usuario.id);
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

      {pageSuccess && (
        <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pageSuccess}</span>
            </div>

            <button
              type="button"
              onClick={() => setPageSuccess('')}
              className="text-green-600 hover:text-green-800"
              aria-label="Cerrar mensaje"
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

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Último acceso
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
                      colSpan="6"
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

                          {/* Último acceso */}

                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {formatDateTimeShort(
                              usuario.last_login
                            )}
                          </td>

                          {/* Acciones */}

                          <td className="px-4 py-4">

                            <div className="flex items-center justify-end gap-2">

                              {canEdit && (
                                <>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openUserDetail(
                                          usuario
                                        )
                                      }
                                      className="p-2 rounded-lg text-sky-600 hover:text-sky-800 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/30 transition-colors"
                                      title="Ver ficha y accesos"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  )}

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

                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPasswordModal(
                                          usuario
                                        )
                                      }
                                      className="p-2 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
                                      title="Cambiar contraseña"
                                    >
                                      <KeyRound className="w-4 h-4" />
                                    </button>
                                  )}

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
          MODAL CAMBIAR CONTRASEÑA
      ====================================================== */}

      {showPasswordModal && passwordUsuario && (
        <div
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center overflow-hidden p-0 sm:p-4 bg-black/50"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-xl shadow-xl max-w-md w-full h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Cambiar contraseña
                </h3>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getNombreCompleto(passwordUsuario) ||
                    passwordUsuario.usuario}
                  {passwordUsuario.usuario
                    ? ` · @${passwordUsuario.usuario}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={closePasswordModal}
                disabled={passwordLoading}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminPasswordReset} className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>

                {passwordError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
                    {passwordError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nueva contraseña *
                  </label>

                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        if (passwordError) {
                          setPasswordError('');
                        }
                      }}
                      autoComplete="new-password"
                      disabled={passwordLoading}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewPassword((previous) => !previous)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label={
                        showNewPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirmar contraseña *
                  </label>

                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(event) => {
                      setConfirmNewPassword(event.target.value);
                      if (passwordError) {
                        setPasswordError('');
                      }
                    }}
                    autoComplete="new-password"
                    disabled={passwordLoading}
                    placeholder="Repite la nueva contraseña"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={passwordLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {passwordLoading
                    ? 'Actualizando...'
                    : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          FICHA / ACTIVIDAD DEL USUARIO
      ====================================================== */}

      <UsuarioDetailModal
        isOpen={Boolean(detailUsuarioId)}
        userId={detailUsuarioId}
        onClose={() =>
          setDetailUsuarioId(null)
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