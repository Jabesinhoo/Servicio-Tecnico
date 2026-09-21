import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';

const DEFAULT_FILTERS = {
  estado: '',
  tecnico_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  fecha_tipo: 'agenda',
  search: '',
  page: 1,
  limit: 20,
};

export const useServicios = () => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [filters, setFiltersState] = useState(DEFAULT_FILTERS);
  const requestId = useRef(0);

  const setFilters = useCallback((next) => {
    setFiltersState((previous) => {
      const value = typeof next === 'function' ? next(previous) : next;
      return {
        ...DEFAULT_FILTERS,
        ...previous,
        ...value,
        page:
          value && Object.prototype.hasOwnProperty.call(value, 'page')
            ? value.page
            : 1,
      };
    });
  }, []);

  const fetchServicios = useCallback(async (override = null) => {
    const currentRequest = ++requestId.current;
    const params = {
      ...filters,
      ...(override || {}),
    };

    Object.keys(params).forEach((key) => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/service-orders', { params });
      if (currentRequest !== requestId.current) return;
      setServicios(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination({
        page: Number(response.data?.pagination?.page || params.page || 1),
        limit: Number(response.data?.pagination?.limit || params.limit || 20),
        total: Number(response.data?.pagination?.total || 0),
        pages: Number(response.data?.pagination?.pages || 0),
      });
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setServicios([]);
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar las órdenes de servicio'
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchServicios();
    }, filters.search ? 300 : 80);
    return () => window.clearTimeout(timer);
  }, [fetchServicios, filters.search]);

  const changeStatus = useCallback(async (id, estado) => {
    const response = await api.patch(`/api/service-orders/${id}/status`, { estado });
    await fetchServicios();
    return response.data;
  }, [fetchServicios]);

  const assignTech = useCallback(async (id, tecnicoId) => {
    const response = await api.patch(`/api/service-orders/${id}/assign`, {
      tecnico_id: tecnicoId,
    });
    await fetchServicios();
    return response.data;
  }, [fetchServicios]);

  const deleteServicio = useCallback(async (id, reason) => {
    const response = await api.delete(`/api/service-orders/${id}`, {
      data: { reason },
    });
    await fetchServicios();
    return response.data;
  }, [fetchServicios]);

  const updateServicio = useCallback(async (id, data) => {
    const response = await api.put(`/api/service-orders/${id}`, data);
    await fetchServicios();
    return response.data;
  }, [fetchServicios]);

  return {
    servicios,
    loading,
    error,
    total: pagination.total,
    pagination,
    filters,
    setFilters,
    fetchServicios,
    changeStatus,
    assignTech,
    deleteServicio,
    updateServicio,
  };
};

export { DEFAULT_FILTERS };
