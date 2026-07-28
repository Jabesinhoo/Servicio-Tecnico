// frontend/src/hooks/useNotificaciones.js
// Version local usando el servicio directamente
import { useState, useEffect, useCallback } from 'react';
import * as alquilerService from '../services/alquiler.service';

export const useNotificaciones = () => {
    const [notificaciones, setNotificaciones] = useState([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [loading, setLoading] = useState(false);

    const cargarNotificaciones = useCallback(async (soloNoLeidas = false) => {
        try {
            setLoading(true);
            const response = await alquilerService.getNotificaciones(soloNoLeidas);
            setNotificaciones(response.data || []);
            setNoLeidas(response.no_leidas || 0);
        } catch (err) {
            console.error('Error cargando notificaciones:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarNotificaciones();
    }, [cargarNotificaciones]);

    const marcarComoLeida = async (id) => {
        try {
            await alquilerService.marcarNotificacionLeida(id);
            await cargarNotificaciones();
        } catch (err) {
            console.error('Error marcando notificacion:', err);
        }
    };

    const marcarTodasLeidas = async () => {
        try {
            await alquilerService.marcarTodasLeidas();
            await cargarNotificaciones();
        } catch (err) {
            console.error('Error marcando todas:', err);
        }
    };

    return {
        notificaciones,
        noLeidas,
        loading,
        cargarNotificaciones,
        marcarComoLeida,
        marcarTodasLeidas
    };
};