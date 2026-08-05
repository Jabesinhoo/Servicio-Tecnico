// frontend/src/pages/Dashboard/Clientes.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import ConfirmModal from '../../components/ui/ConfirmModal';
import ClienteDetailModal from './clientes/ClienteDetailModal';
import ClienteForm from './ClienteForm';
import ClientCard from './clientes/components/ClientCard';

import {
  Plus,
  RefreshCw,
  Search,
  X,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  LayoutGrid,
  Table,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const Clientes = () => {
  const { user } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [origin, setOrigin] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [pagination, setPagination] = useState(
    DEFAULT_PAGINATION
  );

  const [viewMode, setViewMode] = useState('table');

  const [showFormModal, setShowFormModal] =
    useState(false);

  const [showDetailModal, setShowDetailModal] =
    useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [showErrorModal, setShowErrorModal] =
    useState(false);

  const [selectedClienteId, setSelectedClienteId] =
    useState(null);

  const [clienteToDelete, setClienteToDelete] =
    useState(null);

  const [errorModalMessage, setErrorModalMessage] =
    useState('');

  const [editingCliente, setEditingCliente] =
    useState(null);

  /*
   * Evita que una petición anterior sobrescriba
   * los resultados de una búsqueda más reciente.
   */
  const requestIdRef = useRef(0);

  const fetchClientes = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setFetchError('');

      const response = await api.get('/api/clients', {
        params: {
          page,
          limit,
          search: debouncedSearchTerm,
          origin,
          paginated: true,
        },
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      const responseData = response.data || {};

      const nextClientes = Array.isArray(
        responseData.data
      )
        ? responseData.data
        : [];

      const nextPagination = {
        ...DEFAULT_PAGINATION,
        ...(responseData.pagination || {}),
      };

      /*
       * Si se elimina el último registro de la última
       * página, volvemos automáticamente a una página
       * válida.
       */
      if (
        nextPagination.totalPages > 0 &&
        page > nextPagination.totalPages
      ) {
        setPage(nextPagination.totalPages);
        return;
      }

      setClientes(nextClientes);
      setPagination(nextPagination);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      console.error(
        'Error cargando clientes:',
        error
      );

      const message =
        error.response?.data?.message ||
        'No se pudieron cargar los clientes';

      setFetchError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    page,
    limit,
    debouncedSearchTerm,
    origin,
  ]);

  /*
   * Espera 350 ms después de que el usuario deje
   * de escribir antes de consultar PostgreSQL.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(
        searchTerm.trim()
      );

      setPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setPage(1);
  };

  const handleOriginChange = (event) => {
    setOrigin(event.target.value);
    setPage(1);
  };

  const handleLimitChange = (event) => {
    const newLimit = Number(event.target.value);

    setLimit(newLimit);
    setPage(1);
  };

  const handleCreate = async (data) => {
    try {
      await api.post('/api/clients', data);

      setShowFormModal(false);
      setEditingCliente(null);

      if (page !== 1) {
        setPage(1);
      } else {
        await fetchClientes();
      }
    } catch (error) {
      console.error(
        'Error creando cliente:',
        error
      );

      setErrorModalMessage(
        error.response?.data?.message ||
          'Error al crear el cliente'
      );

      setShowErrorModal(true);
    }
  };

  const handleUpdate = async (data) => {
    try {
      if (!editingCliente?.id) {
        return;
      }

      await api.put(
        `/api/clients/${editingCliente.id}`,
        data
      );

      await fetchClientes();

      setShowFormModal(false);
      setEditingCliente(null);
    } catch (error) {
      console.error(
        'Error actualizando cliente:',
        error
      );

      setErrorModalMessage(
        error.response?.data?.message ||
          'Error al actualizar el cliente'
      );

      setShowErrorModal(true);
    }
  };

  const handleDeleteClick = (cliente) => {
    if (
      cliente.origen !== 'local' ||
      cliente.editable === false
    ) {
      setErrorModalMessage(
        'Los clientes sincronizados desde World Office son de solo lectura.'
      );

      setShowErrorModal(true);
      return;
    }

    setClienteToDelete(cliente);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!clienteToDelete?.id) {
      return;
    }

    try {
      await api.delete(
        `/api/clients/${clienteToDelete.id}`
      );

      setShowConfirmModal(false);
      setClienteToDelete(null);

      /*
       * Si era el único cliente de la página,
       * retrocedemos una página.
       */
      if (
        clientes.length === 1 &&
        page > 1
      ) {
        setPage((currentPage) =>
          Math.max(1, currentPage - 1)
        );
      } else {
        await fetchClientes();
      }
    } catch (error) {
      console.error(
        'Error desactivando cliente:',
        error
      );

      setErrorModalMessage(
        error.response?.data?.message ||
          'Error al desactivar el cliente'
      );

      setShowErrorModal(true);
    }
  };

  const handleViewDetail = (cliente) => {
    /*
     * El modal actual consulta las estadísticas
     * de la tabla clients. Todavía no admite
     * directamente registros de sync_clientes.
     */
    if (cliente.origen === 'melissa') {
      setErrorModalMessage(
        'Este cliente proviene de World Office. Actualmente se muestra en la lista y puede buscarse, pero el detalle ampliado todavía debe adaptarse para clientes sincronizados.'
      );

      setShowErrorModal(true);
      return;
    }

    setSelectedClienteId(cliente.id);
    setShowDetailModal(true);
  };

  const handleEdit = (cliente) => {
    if (
      cliente.origen !== 'local' ||
      cliente.editable === false
    ) {
      setErrorModalMessage(
        'Los clientes sincronizados desde World Office no pueden editarse desde este sistema.'
      );

      setShowErrorModal(true);
      return;
    }

    setEditingCliente(cliente);
    setShowFormModal(true);
  };

  const getNombreMostrar = (cliente) => {
    if (cliente.nombre_mostrar) {
      return cliente.nombre_mostrar;
    }

    if (cliente.tipo_persona === 'juridica') {
      return cliente.razon_social || '—';
    }

    return [
      cliente.primer_nombre,
      cliente.segundo_nombre,
      cliente.primer_apellido,
      cliente.segundo_apellido,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || '—';
  };

  const getClienteKey = (cliente) => {
    return (
      cliente.cliente_key ||
      `${cliente.origen || 'local'}:${cliente.id}`
    );
  };

  const isLocalEditable = (cliente) => {
    return (
      cliente.origen === 'local' &&
      cliente.editable !== false
    );
  };

  const userRole = user?.rol || 'usuario';

  /*
   * Esto se reemplazará posteriormente por:
   * can('clientes:edit')
   */
  const canEdit = userRole === 'admin';

  const totalPages =
    Number(pagination.totalPages) || 0;

  const totalClientes =
    Number(pagination.total) || 0;

  const currentPage =
    Number(pagination.page) || page;

  const currentLimit =
    Number(pagination.limit) || limit;

  const firstVisibleClient =
    totalClientes === 0
      ? 0
      : (currentPage - 1) *
          currentLimit +
        1;

  const lastVisibleClient =
    totalClientes === 0
      ? 0
      : Math.min(
          currentPage * currentLimit,
          totalClientes
        );

  const visiblePages = useMemo(() => {
    if (totalPages <= 0) {
      return [];
    }

    const maxVisiblePages = 5;

    let start = Math.max(
      1,
      currentPage - 2
    );

    let end = Math.min(
      totalPages,
      start + maxVisiblePages - 1
    );

    start = Math.max(
      1,
      end - maxVisiblePages + 1
    );

    const pages = [];

    for (
      let pageNumber = start;
      pageNumber <= end;
      pageNumber += 1
    ) {
      pages.push(pageNumber);
    }

    return pages;
  }, [currentPage, totalPages]);

  const goToPage = (newPage) => {
    const safePage = Math.min(
      Math.max(1, newPage),
      Math.max(1, totalPages)
    );

    setPage(safePage);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const renderOriginBadge = (cliente) => {
    if (cliente.origen === 'melissa') {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          World Office
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
        Local
      </span>
    );
  };

  /*
   * Spinner solamente durante la primera carga.
   * En cambios de página conservamos la estructura.
   */
  if (
    loading &&
    clientes.length === 0 &&
    !fetchError
  ) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Clientes
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Clientes locales y sincronizados desde World Office
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              type="button"
              onClick={() =>
                setViewMode('table')
              }
              className={`rounded-md p-2 transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tabla"
            >
              <Table className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode('cards')
              }
              className={`rounded-md p-2 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchClientes()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? 'animate-spin' : ''
              }`}
            />

            Actualizar
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditingCliente(null);
                setShowFormModal(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_150px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Buscar por nombre, razón social, documento, teléfono o correo..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={origin}
            onChange={handleOriginChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="all">
              Todos los orígenes
            </option>

            <option value="local">
              Solo locales
            </option>

            <option value="melissa">
              World Office
            </option>
          </select>

          <select
            value={limit}
            onChange={handleLimitChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value={25}>
              25 por página
            </option>

            <option value={50}>
              50 por página
            </option>

            <option value={100}>
              100 por página
            </option>
          </select>
        </div>

        <div className="mt-3 flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {loading
              ? 'Consultando clientes...'
              : `Mostrando ${firstVisibleClient}-${lastVisibleClient} de ${totalClientes.toLocaleString(
                  'es-CO'
                )} clientes`}
          </span>

          {debouncedSearchTerm && (
            <span>
              Resultados para:{' '}
              <strong className="text-gray-700 dark:text-gray-200">
                {debouncedSearchTerm}
              </strong>
            </span>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {fetchError}
        </div>
      )}

      {/* Vista de tabla */}
      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="responsive-table-wrap overflow-x-auto">
            <table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 sm:px-6">
                    Nombre / razón social
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 sm:px-6">
                    Documento
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 sm:px-6">
                    Contacto
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 sm:px-6">
                    Tipo
                  </th>

                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 sm:px-6">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {clientes.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      {debouncedSearchTerm
                        ? 'No se encontraron clientes con esa búsqueda'
                        : 'No hay clientes disponibles'}
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => {
                    const editable =
                      canEdit &&
                      isLocalEditable(cliente);

                    return (
                      <tr
                        key={getClienteKey(cliente)}
                        className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white sm:px-6">
                          <div className="space-y-1">
                            <div>
                              {getNombreMostrar(
                                cliente
                              )}
                            </div>

                            {renderOriginBadge(
                              cliente
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                          {cliente.documento ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 sm:px-6">
                          <div className="space-y-1">
                            {cliente.telefono && (
                              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="h-3 w-3" />
                                <span>
                                  {
                                    cliente.telefono
                                  }
                                </span>
                              </div>
                            )}

                            {cliente.email && (
                              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                <Mail className="h-3 w-3" />

                                <span className="max-w-[180px] truncate">
                                  {cliente.email}
                                </span>
                              </div>
                            )}

                            {!cliente.telefono &&
                              !cliente.email && (
                                <span className="text-sm text-gray-400">
                                  —
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="px-4 py-4 sm:px-6">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${
                              cliente.tipo_persona ===
                              'juridica'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}
                          >
                            {cliente.tipo_persona ===
                            'juridica'
                              ? 'Empresa'
                              : 'Persona natural'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleViewDetail(
                                  cliente
                                )
                              }
                              className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {editable && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEdit(
                                      cliente
                                    )
                                  }
                                  className="p-1 text-green-600 hover:text-green-800 dark:text-green-400"
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteClick(
                                      cliente
                                    )
                                  }
                                  className="p-1 text-red-600 hover:text-red-800 dark:text-red-400"
                                  title="Desactivar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
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
        </div>
      )}

      {/* Vista de tarjetas */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clientes.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
              {debouncedSearchTerm
                ? 'No se encontraron clientes con esa búsqueda'
                : 'No hay clientes disponibles'}
            </div>
          ) : (
            clientes.map((cliente) => (
              <ClientCard
                key={getClienteKey(cliente)}
                cliente={cliente}
                onViewDetail={() =>
                  handleViewDetail(cliente)
                }
                onEdit={() =>
                  handleEdit(cliente)
                }
                onDelete={() =>
                  handleDeleteClick(cliente)
                }
                canEdit={
                  canEdit &&
                  isLocalEditable(cliente)
                }
              />
            ))
          )}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 0 && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Página{' '}
            <strong className="text-gray-900 dark:text-white">
              {currentPage}
            </strong>{' '}
            de{' '}
            <strong className="text-gray-900 dark:text-white">
              {totalPages.toLocaleString(
                'es-CO'
              )}
            </strong>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={
                currentPage <= 1 || loading
              }
              className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Primera página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                goToPage(currentPage - 1)
              }
              disabled={
                currentPage <= 1 || loading
              }
              className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {visiblePages.map(
              (pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  onClick={() =>
                    goToPage(pageNumber)
                  }
                  disabled={loading}
                  className={`min-w-9 rounded-md border px-3 py-2 text-sm font-medium ${
                    pageNumber ===
                    currentPage
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() =>
                goToPage(currentPage + 1)
              }
              disabled={
                currentPage >= totalPages ||
                loading
              }
              className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                goToPage(totalPages)
              }
              disabled={
                currentPage >= totalPages ||
                loading
              }
              className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmación de desactivación */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setClienteToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Desactivar cliente"
        message={`¿Estás seguro de desactivar a "${getNombreMostrar(
          clienteToDelete || {}
        )}"? Sus órdenes de servicio conservarán el historial.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Mensaje de error o advertencia */}
      <ConfirmModal
        isOpen={showErrorModal}
        onClose={() =>
          setShowErrorModal(false)
        }
        onConfirm={() =>
          setShowErrorModal(false)
        }
        title="Aviso"
        message={errorModalMessage}
        confirmText="Aceptar"
        cancelText={null}
        variant="warning"
      />

      {/* Detalle */}
      <ClienteDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedClienteId(null);
        }}
        clienteId={selectedClienteId}
        onRefresh={fetchClientes}
      />

      {/* Crear o editar */}
      <ClienteForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingCliente(null);
        }}
        onSubmit={
          editingCliente
            ? handleUpdate
            : handleCreate
        }
        initialData={editingCliente}
      />
    </div>
  );
};

export default Clientes;