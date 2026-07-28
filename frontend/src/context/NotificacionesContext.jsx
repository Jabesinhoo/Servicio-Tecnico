// frontend/src/context/NotificacionesContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const NotificacionesContext = createContext(null);

export const NotificacionesProvider = ({ children }) => {
    const [notificaciones, setNotificaciones] = useState([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [initialized, setInitialized] = useState(false);

    const cargarNotificaciones = useCallback(async (soloNoLeidas = false) => {
        // Si ya hay una carga en curso, no hacer otra
        if (loading) return;
        
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/api/notificaciones?solo_no_leidas=${soloNoLeidas}`);
            setNotificaciones(response.data.data || []);
            setNoLeidas(response.data.no_leidas || 0);
            setInitialized(true);
        } catch (err) {
            // Si el error es de red, no mostrar error para no romper la UI
            if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
                console.warn('No se pudieron cargar notificaciones (servidor no disponible)');
                // Mantener estado anterior
            } else {
                setError(err.response?.data?.message || 'Error al cargar notificaciones');
                console.error('Error cargando notificaciones:', err);
            }
        } finally {
            setLoading(false);
        }
    }, [loading]);

    const marcarComoLeida = useCallback(async (id) => {
        try {
            await api.patch(`/api/notificaciones/${id}/leida`);
            setNotificaciones(prev => 
                prev.map(n => n.id === id ? { ...n, leido: true } : n)
            );
            setNoLeidas(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marcando notificacion:', err);
        }
    }, []);

    const marcarTodasLeidas = useCallback(async () => {
        try {
            await api.patch('/api/notificaciones/leer-todas');
            setNotificaciones(prev => prev.map(n => ({ ...n, leido: true })));
            setNoLeidas(0);
        } catch (err) {
            console.error('Error marcando todas:', err);
        }
    }, []);

    const eliminarNotificacion = useCallback(async (id) => {
        try {
            await api.delete(`/api/notificaciones/${id}`);
            setNotificaciones(prev => prev.filter(n => n.id !== id));
            const notif = notificaciones.find(n => n.id === id);
            if (notif && !notif.leido) {
                setNoLeidas(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('Error eliminando notificacion:', err);
        }
    }, [notificaciones]);

    // Cargar al inicio solo si el token existe
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            cargarNotificaciones();
        }
    }, [cargarNotificaciones]);

    const value = {
        notificaciones,
        noLeidas,
        loading,
        error,
        initialized,
        cargarNotificaciones,
        marcarComoLeida,
        marcarTodasLeidas,
        eliminarNotificacion,
        refrescar: () => cargarNotificaciones(),
    };

    return (
        <NotificacionesContext.Provider value={value}>
            {children}
        </NotificacionesContext.Provider>
    );
};

export const useNotificacionesGlobal = () => {
    const context = useContext(NotificacionesContext);
    if (!context) {
        throw new Error('useNotificacionesGlobal debe usarse dentro de NotificacionesProvider');
    }
    return context;
};