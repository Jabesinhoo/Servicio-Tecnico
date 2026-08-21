// frontend/src/pages/Dashboard/tecnicos/TecnicoForm.jsx

import React, {
  useEffect,
  useState,
} from 'react';

import {
  X,
  Save,
  AlertCircle,
  ShieldCheck,
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

const TecnicoForm = ({
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
    loading,
    setLoading,
  ] = useState(false);

  const [
    serverError,
    setServerError,
  ] = useState('');

  const [
    roleError,
    setRoleError,
  ] = useState('');

  const [
    roleLoading,
    setRoleLoading,
  ] = useState(false);

  const [
    tecnicoRole,
    setTecnicoRole,
  ] = useState(null);

  // ============================================================
  // CARGAR DATOS
  // ============================================================

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErrors({});
    setServerError('');
    setRoleError('');

    if (initialData) {
      setFormData({
        nombre1:
          initialData.nombre1 || '',

        nombre2:
          initialData.nombre2 || '',

        apellidos:
          initialData.apellidos || '',

        usuario:
          initialData.usuario || '',

        cedula:
          initialData.cedula || '',

        email:
          initialData.email || '',

        celular:
          initialData.celular || '',

        /*
         * Lo resolveremos nuevamente desde
         * la tabla roles.
         */
        role_id: '',

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
  // BUSCAR ROL "tecnico" DINÁMICAMENTE
  // ============================================================

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let mounted = true;

    const loadTecnicoRole = async () => {
      try {
        setRoleLoading(true);
        setRoleError('');

        const response =
          await api.get(
            '/api/roles'
          );

        const roles =
          Array.isArray(
            response.data?.data
          )
            ? response.data.data
            : Array.isArray(
                  response.data
                )
              ? response.data
              : [];

        const role = roles.find(
          (item) =>
            String(item?.name || '')
              .trim()
              .toLowerCase() ===
              'tecnico' &&
            item?.active !== false
        );

        if (!mounted) {
          return;
        }

        if (!role) {
          setTecnicoRole(null);

          setFormData(
            (previous) => ({
              ...previous,
              role_id: '',
            })
          );

          setRoleError(
            'No existe un rol activo llamado "tecnico". Créalo o actívalo desde Administración de Roles.'
          );

          return;
        }

        setTecnicoRole(role);

        setFormData(
          (previous) => ({
            ...previous,
            role_id:
              String(role.id),
          })
        );
      } catch (error) {
        console.error(
          'Error obteniendo rol técnico:',
          error.response?.data ||
            error
        );

        if (!mounted) {
          return;
        }

        setTecnicoRole(null);

        setRoleError(
          error.response?.data?.message ||
            'No fue posible obtener el rol de técnico.'
        );
      } finally {
        if (mounted) {
          setRoleLoading(false);
        }
      }
    };

    loadTecnicoRole();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // ============================================================
  // CAMBIOS
  // ============================================================

  const handleChange = (event) => {
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
  // VALIDACIÓN
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
        !emailRegex.test(email)
      ) {
        newErrors.email =
          'El correo electrónico no es válido';
      }
    }

    // ==========================================================
    // ROL
    // ==========================================================

    if (
      !tecnicoRole ||
      !formData.role_id
    ) {
      newErrors.role_id =
        'No se pudo resolver el rol de técnico';
    }

    // ==========================================================
    // CONTRASEÑA
    // ==========================================================

    if (!initialData) {
      if (!formData.password) {
        newErrors.password =
          'La contraseña es requerida';
      } else if (
        formData.password.length < 8
      ) {
        newErrors.password =
          'La contraseña debe tener mínimo 8 caracteres';
      }

      if (
        !formData.confirmPassword
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

    setErrors(newErrors);

    return (
      Object.keys(newErrors)
        .length === 0
    );
  };

  // ============================================================
  // ENVIAR
  // ============================================================

  const handleSubmit = async (
    event
  ) => {
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
            .trim() || null,

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
            .trim() || null,

        /*
         * ID REAL obtenido de /api/roles.
         *
         * NO:
         *
         * role_id: 2
         *
         * NO:
         *
         * rol: 'tecnico'
         */
        role_id:
          Number(
            tecnicoRole.id
          ),
      };

      // ========================================================
      // CONTRASEÑA SOLO EN CREACIÓN
      // ========================================================

      if (!initialData) {
        /*
         * No hacemos trim a passwords.
         * La contraseña se respeta exactamente.
         */
        submitData.password =
          formData.password;
      }

      await onSubmit(
        submitData
      );

      onClose();
    } catch (error) {
      console.error(
        'Error guardando técnico:',
        error.response?.data ||
          error
      );

      const backendMessage =
        error?.response?.data
          ?.message ||
        error?.response?.data
          ?.error ||
        error?.message ||
        'No fue posible guardar el técnico';

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
    setRoleError('');

    onClose();
  };

  // ============================================================
  // OCULTO
  // ============================================================

  if (!isOpen) {
    return null;
  }

  // ============================================================
  // RENDER
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
                ? 'Editar Técnico'
                : 'Nuevo Técnico'}

            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              La cuenta podrá iniciar sesión
              en el sistema como técnico.
            </p>

          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ====================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
        >

          <div className="p-4 sm:p-6 space-y-6">

            {/* ==================================================
                ERROR BACKEND
            ================================================== */}

            {serverError && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">

                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />

                <div>

                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    No fue posible guardar el técnico
                  </p>

                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {serverError}
                  </p>

                </div>
              </div>
            )}

            {/* ==================================================
                ERROR ROL
            ================================================== */}

            {roleError && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">

                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />

                <div>

                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Rol técnico no disponible
                  </p>

                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    {roleError}
                  </p>

                </div>
              </div>
            )}

            {/* ==================================================
                INFORMACIÓN PERSONAL
            ================================================== */}

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
                    value={formData.nombre1}
                    onChange={handleChange}
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
                    value={formData.nombre2}
                    onChange={handleChange}
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
                    value={formData.apellidos}
                    onChange={handleChange}
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
                    value={formData.cedula}
                    onChange={handleChange}
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
                    value={formData.celular}
                    onChange={handleChange}
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
                    value={formData.email}
                    onChange={handleChange}
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

            {/* ==================================================
                CUENTA
            ================================================== */}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">

              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Cuenta del sistema
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
                    value={formData.usuario}
                    onChange={handleChange}
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
                    Rol
                  </label>

                  <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white flex items-center gap-2">

                    <ShieldCheck className="w-4 h-4 text-indigo-500" />

                    <span>
                      {roleLoading
                        ? 'Cargando rol...'
                        : tecnicoRole?.description
                          ? `Técnico — ${tecnicoRole.description}`
                          : tecnicoRole
                            ? 'Técnico'
                            : 'No disponible'}
                    </span>

                  </div>

                  {errors.role_id && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.role_id}
                    </p>
                  )}

                </div>
              </div>
            </div>

            {/* ==================================================
                CREDENCIALES
            ================================================== */}

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
                      value={formData.password}
                      onChange={handleChange}
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
                      value={formData.confirmPassword}
                      onChange={handleChange}
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

            {/* ==================================================
                EDICIÓN
            ================================================== */}

            {initialData && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  La contraseña no se modifica desde
                  esta pantalla. La cuenta conserva
                  sus credenciales actuales.
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
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                roleLoading ||
                !tecnicoRole
              }
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >

              <Save className="w-4 h-4" />

              {loading
                ? 'Guardando...'
                : initialData
                  ? 'Actualizar Técnico'
                  : 'Crear Técnico'}

            </button>

          </div>
        </form>

      </div>
    </div>
  );
};

export default TecnicoForm;