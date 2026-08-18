// src/pages/Dashboard/usuarios/UsuarioForm.jsx

import React, {
  useEffect,
  useState,
} from 'react';

import {
  X,
  Save,
  AlertCircle,
} from 'lucide-react';

import api from '../../../services/api';

// ============================================================
// ESTADO INICIAL
// ============================================================

const getInitialFormData = () => ({
  nombre1: '',
  nombre2: '',
  apellidos: '',
  usuario: '',
  cedula: '',
  email: '',
  celular: '',
  role_id: '',
  password: '',
  confirmPassword: '',
});

// ============================================================
// COMPONENTE
// ============================================================

const UsuarioForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [
    formData,
    setFormData,
  ] = useState(
    getInitialFormData()
  );

  const [
    errors,
    setErrors,
  ] = useState({});

  const [
    serverError,
    setServerError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    roleOptions,
    setRoleOptions,
  ] = useState([]);

  const [
    rolesLoading,
    setRolesLoading,
  ] = useState(false);

  const [
    rolesError,
    setRolesError,
  ] = useState('');

  // ============================================================
  // CARGAR DATOS DEL USUARIO / LIMPIAR
  // ============================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErrors({});
    setServerError('');
    setRolesError('');

    if (initialData) {
      setFormData({
        nombre1:
          initialData.nombre1 ||
          '',

        nombre2:
          initialData.nombre2 ||
          '',

        apellidos:
          initialData.apellidos ||
          '',

        usuario:
          initialData.usuario ||
          '',

        cedula:
          initialData.cedula ||
          '',

        email:
          initialData.email ||
          '',

        celular:
          initialData.celular ||
          '',

        role_id: String(
          initialData.role_id ??
            initialData.role?.id ??
            ''
        ),

        password: '',

        confirmPassword: '',
      });

      return;
    }

    setFormData(
      getInitialFormData()
    );
  }, [
    initialData,
    isOpen,
  ]);

  // ============================================================
  // CARGAR ROLES REALES
  // ============================================================

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let mounted = true;

    const loadRoles =
      async () => {
        setRolesLoading(
          true
        );

        setRolesError('');

        try {
          const response =
            await api.get(
              '/api/roles'
            );

          const rawRoles =
            Array.isArray(
              response.data?.data
            )
              ? response.data.data
              : Array.isArray(
                    response.data
                  )
                ? response.data
                : [];

          const currentRoleId =
            String(
              initialData
                ?.role_id ??
                initialData
                  ?.role?.id ??
                ''
            );

          /*
           * Mostrar roles activos.
           *
           * Si estamos editando un
           * usuario que tiene un rol
           * actualmente inactivo,
           * mantenemos ese rol visible
           * para no perderlo sin querer.
           */

          const availableRoles =
            rawRoles.filter(
              (role) =>
                role.active !==
                  false ||
                String(
                  role.id
                ) ===
                  currentRoleId
            );

          const mappedRoles =
            availableRoles
              .map(
                (role) => ({
                  value:
                    String(
                      role.id
                    ),

                  name:
                    role.name ||
                    `Rol ${role.id}`,

                  description:
                    role.description ||
                    '',

                  is_default:
                    Boolean(
                      role.is_default
                    ),

                  active:
                    role.active !==
                    false,
                })
              )
              .sort(
                (a, b) =>
                  a.name.localeCompare(
                    b.name,
                    'es',
                    {
                      sensitivity:
                        'base',
                    }
                  )
              );

          if (!mounted) {
            return;
          }

          setRoleOptions(
            mappedRoles
          );

          /*
           * En edición jamás
           * modificamos el rol
           * automáticamente.
           */

          if (initialData) {
            return;
          }

          /*
           * En creación:
           *
           * 1. Rol marcado default.
           * 2. Rol llamado usuario.
           * 3. Primer rol activo.
           */

          const defaultRole =
            mappedRoles.find(
              (role) =>
                role.active &&
                role.is_default
            ) ||
            mappedRoles.find(
              (role) =>
                role.active &&
                role.name
                  ?.toLowerCase()
                  .trim() ===
                  'usuario'
            ) ||
            mappedRoles.find(
              (role) =>
                role.active
            );

          setFormData(
            (previous) => {
              const selectedStillExists =
                mappedRoles.some(
                  (role) =>
                    role.value ===
                      String(
                        previous.role_id
                      ) &&
                    role.active
                );

              return {
                ...previous,

                role_id:
                  selectedStillExists
                    ? previous.role_id
                    : defaultRole
                        ?.value ||
                      '',
              };
            }
          );
        } catch (error) {
          console.error(
            'Error cargando roles:',
            error.response
              ?.data ||
              error
          );

          if (!mounted) {
            return;
          }

          setRoleOptions([]);

          setRolesError(
            error.response
              ?.data?.message ||
              'No fue posible cargar los roles'
          );
        } finally {
          if (mounted) {
            setRolesLoading(
              false
            );
          }
        }
      };

    loadRoles();

    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    initialData,
  ]);

  // ============================================================
  // CAMBIOS
  // ============================================================

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );

    if (errors[name]) {
      setErrors(
        (previous) => ({
          ...previous,
          [name]: '',
        })
      );
    }

    if (serverError) {
      setServerError('');
    }
  };

  // ============================================================
  // VALIDACIONES
  // ============================================================

  const validate = () => {
    const newErrors = {};

    const nombre1 =
      formData.nombre1
        ?.trim() || '';

    const apellidos =
      formData.apellidos
        ?.trim() || '';

    const usuario =
      formData.usuario
        ?.trim() || '';

    const cedula =
      formData.cedula
        ?.trim() || '';

    const email =
      formData.email
        ?.trim() || '';

    // ==========================================================
    // NOMBRE
    // ==========================================================

    if (!nombre1) {
      newErrors.nombre1 =
        'El primer nombre es requerido';
    }

    // ==========================================================
    // APELLIDOS
    // ==========================================================

    if (!apellidos) {
      newErrors.apellidos =
        'Los apellidos son requeridos';
    }

    // ==========================================================
    // USUARIO
    // ==========================================================

    if (!usuario) {
      newErrors.usuario =
        'El nombre de usuario es requerido';
    } else if (
      usuario.length < 3
    ) {
      newErrors.usuario =
        'El usuario debe tener mínimo 3 caracteres';
    }

    // ==========================================================
    // CÉDULA
    // ==========================================================

    if (!cedula) {
      newErrors.cedula =
        'La cédula es requerida';
    }

    // ==========================================================
    // EMAIL
    // ==========================================================

    if (!email) {
      newErrors.email =
        'El correo electrónico es requerido';
    } else {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          email
        )
      ) {
        newErrors.email =
          'El correo electrónico no es válido';
      }
    }

    // ==========================================================
    // ROL
    // ==========================================================

    if (!formData.role_id) {
      newErrors.role_id =
        'Debes seleccionar un rol';
    } else {
      const selectedRole =
        roleOptions.find(
          (role) =>
            role.value ===
            String(
              formData.role_id
            )
        );

      if (!selectedRole) {
        newErrors.role_id =
          'El rol seleccionado no está disponible';
      }

      if (
        selectedRole &&
        !selectedRole.active &&
        !initialData
      ) {
        newErrors.role_id =
          'No puedes asignar un rol inactivo';
      }
    }

    // ==========================================================
    // CONTRASEÑA
    // ==========================================================

    if (!initialData) {
      if (
        !formData.password
      ) {
        newErrors.password =
          'La contraseña es requerida';
      } else if (
        formData.password
          .length < 8
      ) {
        newErrors.password =
          'La contraseña debe tener mínimo 8 caracteres';
      }

      if (
        !formData
          .confirmPassword
      ) {
        newErrors.confirmPassword =
          'Debes confirmar la contraseña';
      } else if (
        formData.password !==
        formData.confirmPassword
      ) {
        newErrors.confirmPassword =
          'Las contraseñas no coinciden';
      }
    }

    setErrors(
      newErrors
    );

    return (
      Object.keys(
        newErrors
      ).length === 0
    );
  };

  // ============================================================
  // ENVIAR
  // ============================================================

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      setServerError('');

      if (!validate()) {
        return;
      }

      setLoading(true);

      try {
        const submitData = {
          nombre1:
            formData.nombre1.trim(),

          nombre2:
            formData.nombre2
              .trim() ||
            null,

          apellidos:
            formData.apellidos.trim(),

          usuario:
            formData.usuario
              .trim()
              .toLowerCase(),

          cedula:
            formData.cedula.trim(),

          email:
            formData.email
              .trim()
              .toLowerCase(),

          celular:
            formData.celular
              .trim() ||
            null,

          role_id:
            Number(
              formData.role_id
            ),
        };

        /*
         * La contraseña solamente
         * se envía en creación.
         */

        if (!initialData) {
          submitData.password =
            formData.password;
        }

        await onSubmit(
          submitData
        );

        onClose();
      } catch (error) {
        const backendMessage =
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.error ||
          error?.message ||
          'No fue posible guardar el usuario';

        console.error(
          'Error submitting usuario:',
          error?.response
            ?.data ||
            error
        );

        setServerError(
          backendMessage
        );
      } finally {
        setLoading(false);
      }
    };

  // ============================================================
  // CERRAR
  // ============================================================

  const handleClose = () => {
    if (loading) {
      return;
    }

    setErrors({});
    setServerError('');
    setRolesError('');

    onClose();
  };

  // ============================================================
  // NO MOSTRAR
  // ============================================================

  if (!isOpen) {
    return null;
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 z-10 bg-white dark:bg-gray-900">

          <div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">

              {initialData
                ? 'Editar Usuario'
                : 'Nuevo Usuario'}

            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">

              {initialData
                ? 'Actualiza la información y el rol de la cuenta.'
                : 'Crea una nueva cuenta de acceso al sistema.'}

            </p>
          </div>

          <button
            type="button"
            onClick={
              handleClose
            }
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ====================================================
            FORMULARIO
        ==================================================== */}

        <form
          onSubmit={
            handleSubmit
          }
        >

          <div className="p-4 sm:p-6 space-y-6">

            {/* =================================================
                ERROR SERVIDOR
            ================================================= */}

            {serverError && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">

                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />

                <div>

                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    No fue posible guardar el usuario
                  </p>

                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {serverError}
                  </p>

                </div>
              </div>
            )}

            {/* =================================================
                ERROR ROLES
            ================================================= */}

            {rolesError && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">

                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />

                <div>

                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    No fue posible cargar los roles
                  </p>

                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    {rolesError}
                  </p>

                </div>
              </div>
            )}

            {/* =================================================
                INFORMACIÓN PERSONAL
            ================================================= */}

            <div>

              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Información personal
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Primer nombre */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Primer Nombre *
                  </label>

                  <input
                    type="text"
                    name="nombre1"
                    value={
                      formData.nombre1
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="given-name"
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.nombre1
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />

                  {errors.nombre1 && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.nombre1}
                    </p>
                  )}

                </div>

                {/* Segundo nombre */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Segundo Nombre
                  </label>

                  <input
                    type="text"
                    name="nombre2"
                    value={
                      formData.nombre2
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="additional-name"
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                </div>

                {/* Apellidos */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Apellidos *
                  </label>

                  <input
                    type="text"
                    name="apellidos"
                    value={
                      formData.apellidos
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="family-name"
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.apellidos
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />

                  {errors.apellidos && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.apellidos}
                    </p>
                  )}

                </div>

                {/* Cédula */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cédula *
                  </label>

                  <input
                    type="text"
                    name="cedula"
                    value={
                      formData.cedula
                    }
                    onChange={
                      handleChange
                    }
                    inputMode="numeric"
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.cedula
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />

                  {errors.cedula && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.cedula}
                    </p>
                  )}

                </div>

                {/* Celular */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Celular
                  </label>

                  <input
                    type="tel"
                    name="celular"
                    value={
                      formData.celular
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="tel"
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                </div>

                {/* Email */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Correo Electrónico *
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={
                      formData.email
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="email"
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.email
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />

                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.email}
                    </p>
                  )}

                </div>
              </div>
            </div>

            {/* =================================================
                CUENTA Y PERMISOS
            ================================================= */}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">

              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Cuenta y permisos
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Usuario */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de Usuario *
                  </label>

                  <input
                    type="text"
                    name="usuario"
                    value={
                      formData.usuario
                    }
                    onChange={
                      handleChange
                    }
                    autoComplete="username"
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.usuario
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />

                  {errors.usuario && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.usuario}
                    </p>
                  )}

                </div>

                {/* Rol */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rol *
                  </label>

                  <select
                    name="role_id"
                    value={
                      formData.role_id
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      loading ||
                      rolesLoading
                    }
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${
                      errors.role_id
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >

                    <option value="">

                      {rolesLoading
                        ? 'Cargando roles...'
                        : 'Selecciona un rol'}

                    </option>

                    {roleOptions.map(
                      (role) => (
                        <option
                          key={
                            role.value
                          }
                          value={
                            role.value
                          }
                        >
                          {role.name}

                          {role.description
                            ? ` — ${role.description}`
                            : ''}

                          {!role.active
                            ? ' (inactivo)'
                            : ''}
                        </option>
                      )
                    )}

                  </select>

                  {errors.role_id && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.role_id}
                    </p>
                  )}

                  {!rolesLoading &&
                    !rolesError &&
                    roleOptions.length ===
                      0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        No hay roles disponibles.
                      </p>
                    )}

                </div>
              </div>
            </div>

            {/* =================================================
                CONTRASEÑA - SOLO CREACIÓN
            ================================================= */}

            {!initialData && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">

                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Credenciales de acceso
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Password */}

                  <div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contraseña *
                    </label>

                    <input
                      type="password"
                      name="password"
                      value={
                        formData.password
                      }
                      onChange={
                        handleChange
                      }
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder="Mínimo 8 caracteres"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        errors.password
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />

                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.password}
                      </p>
                    )}

                  </div>

                  {/* Confirmar */}

                  <div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Contraseña *
                    </label>

                    <input
                      type="password"
                      name="confirmPassword"
                      value={
                        formData.confirmPassword
                      }
                      onChange={
                        handleChange
                      }
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder="Repite la contraseña"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        errors.confirmPassword
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />

                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.confirmPassword}
                      </p>
                    )}

                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                EDICIÓN
            ================================================= */}

            {initialData && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  La contraseña no se modifica desde esta pantalla.
                  Los cambios de contraseña se gestionan mediante
                  el endpoint específico de contraseña.
                </p>

              </div>
            )}
          </div>

          {/* ==================================================
              FOOTER
          ================================================== */}

          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-900">

            <button
              type="button"
              onClick={
                handleClose
              }
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                rolesLoading ||
                roleOptions.length ===
                  0
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >

              <Save className="w-4 h-4" />

              {loading
                ? 'Guardando...'
                : initialData
                  ? 'Actualizar Usuario'
                  : 'Crear Usuario'}

            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsuarioForm;