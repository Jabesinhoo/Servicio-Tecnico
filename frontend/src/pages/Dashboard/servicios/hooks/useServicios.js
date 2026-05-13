// src/pages/Dashboard/servicios/hooks/useServicios.js
import { useState, useEffect, useCallback } from 'react';
import api from '../../../../services/api';

export const useServicios = () => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    estado: '',
    tecnico_id: '',
    fecha: '',
    page: 1,
    limit: 20
  });

  const fetchServicios = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (filters.estado) params.append('estado', filters.estado);
      if (filters.tecnico_id) params.append('tecnico_id', filters.tecnico_id);
      if (filters.fecha) params.append('fecha', filters.fecha);

      params.append('page', filters.page);
      params.append('limit', filters.limit);

      const res = await api.get(`/api/service-orders?${params.toString()}`);

      setServicios(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching servicios:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchServicios();
  }, [fetchServicios]);

  const createServicio = async (data) => {
    const res = await api.post('/api/service-orders', data);
    await fetchServicios();
    return res.data;
  };

  const updateServicio = async (id, data) => {
    const res = await api.put(`/api/service-orders/${id}`, data);
    await fetchServicios();
    return res.data;
  };

  const changeStatus = async (id, estado) => {
    const res = await api.patch(`/api/service-orders/${id}/status`, { estado });
    await fetchServicios();
    return res.data;
  };

  const assignTech = async (id, tecnico_id) => {
    const res = await api.patch(`/api/service-orders/${id}/assign`, { tecnico_id });
    await fetchServicios();
    return res.data;
  };

  const deleteServicio = async (id) => {
    await api.delete(`/api/service-orders/${id}`);
    await fetchServicios();
  };

  return {
    servicios,
    loading,
    total,
    filters,
    setFilters,
    fetchServicios,
    createServicio,
    updateServicio,
    changeStatus,
    assignTech,
    deleteServicio
  };
};