// frontend/src/hooks/useAlquileres.js
import { useState, useEffect, useCallback } from 'react';
import * as alquilerService from '../services/alquiler.service';

export const useAlquileres = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filtros, setFiltros] = useState({ estado: '' });

    const cargarSolicitudes = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await alquilerService.getSolicitudes(filtros);
            setSolicitudes(response.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cargar solicitudes');
            console.error('Error cargando solicitudes:', err);
        } finally {
            setLoading(false);
        }
    }, [filtros]);

    useEffect(() => {
        cargarSolicitudes();
    }, [cargarSolicitudes]);

    const crearSolicitud = async (data) => {
        try {
            setLoading(true);
            const response = await alquilerService.crearSolicitud(data);
            await cargarSolicitudes();
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Error al crear solicitud');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const actualizarEstado = async (id, estado, observaciones) => {
        try {
            const response = await alquilerService.actualizarEstadoSolicitud(id, estado, observaciones);
            await cargarSolicitudes();
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Error al actualizar estado');
            throw err;
        }
    };

    const aprobarDocumentacion = async (id, aprobado, observaciones) => {
        try {
            const response = await alquilerService.aprobarDocumentacion(id, aprobado, observaciones);
            await cargarSolicitudes();
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Error al aprobar documentacion');
            throw err;
        }
    };

    return {
        solicitudes,
        loading,
        error,
        filtros,
        setFiltros,
        cargarSolicitudes,
        crearSolicitud,
        actualizarEstado,
        aprobarDocumentacion
    };
};