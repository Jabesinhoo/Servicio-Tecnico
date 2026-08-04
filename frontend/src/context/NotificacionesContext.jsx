// frontend/src/context/NotificacionesContext.jsx
import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    useCallback,
    useRef,
} from 'react';

import api from '../services/api';

const NotificacionesContext = createContext(null);

export const NotificacionesProvider = ({ children }) => {
    const [notificaciones, setNotificaciones] = useState([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [initialized, setInitialized] = useState(false);

    // Evita solicitudes simultáneas sin convertir la función
    // en una nueva referencia cada vez que cambia loading.
    const loadingRef = useRef(false);
    const mountedRef = useRef(true);

    const cargarNotificaciones = useCallback(async (soloNoLeidas = false) => {
        if (loadingRef.current) {
            return;
        }

        loadingRef.current = true;

        if (mountedRef.current) {
            setLoading(true);
            setError(null);
        }

        try {
            const response = await api.get('/api/notificaciones', {
                params: {
                    solo_no_leidas: soloNoLeidas,
                },
            });

            if (!mountedRef.current) {
                return;
            }

            const resultado = response.data || {};

            setNotificaciones(
                Array.isArray(resultado.data)
                    ? resultado.data
                    : []
            );

            setNoLeidas(
                Number(resultado.no_leidas || 0)
            );

            setInitialized(true);
        } catch (err) {
            if (!mountedRef.current) {
                return;
            }

            const esErrorDeConexion =
                err.code === 'ECONNABORTED' ||
                err.code === 'ERR_NETWORK' ||
                err.message === 'Network Error';

            if (esErrorDeConexion) {
                console.warn(
                    'No se pudieron cargar notificaciones: servidor no disponible'
                );

                return;
            }

            const mensaje =
                err.response?.data?.message ||
                err.response?.data?.error ||
                'Error al cargar notificaciones';

            setError(mensaje);

            console.error('Error cargando notificaciones:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
        } finally {
            loadingRef.current = false;

            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const marcarComoLeida = useCallback(async (id) => {
        try {
            await api.patch(`/api/notificaciones/${id}/leida`);

            setNotificaciones((prev) =>
                prev.map((notificacion) =>
                    notificacion.id === id
                        ? {
                            ...notificacion,
                            leido: true,
                        }
                        : notificacion
                )
            );

            setNoLeidas((prev) =>
                Math.max(0, prev - 1)
            );
        } catch (err) {
            console.error(
                'Error marcando notificación:',
                err.response?.data || err.message
            );
        }
    }, []);

    const marcarTodasLeidas = useCallback(async () => {
        try {
            await api.patch('/api/notificaciones/leer-todas');

            setNotificaciones((prev) =>
                prev.map((notificacion) => ({
                    ...notificacion,
                    leido: true,
                }))
            );

            setNoLeidas(0);
        } catch (err) {
            console.error(
                'Error marcando todas las notificaciones:',
                err.response?.data || err.message
            );
        }
    }, []);

    const eliminarNotificacion = useCallback(async (id) => {
        try {
            await api.delete(`/api/notificaciones/${id}`);

            setNotificaciones((prev) => {
                const eliminada = prev.find(
                    (notificacion) => notificacion.id === id
                );

                if (eliminada && !eliminada.leido) {
                    setNoLeidas((cantidad) =>
                        Math.max(0, cantidad - 1)
                    );
                }

                return prev.filter(
                    (notificacion) => notificacion.id !== id
                );
            });
        } catch (err) {
            console.error(
                'Error eliminando notificación:',
                err.response?.data || err.message
            );
        }
    }, []);

    // Se ejecuta una sola vez cuando se monta el proveedor.
    useEffect(() => {
        mountedRef.current = true;

        const token = localStorage.getItem('token');

        if (token) {
            cargarNotificaciones(false);
        }

        return () => {
            mountedRef.current = false;
        };
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
        refrescar: cargarNotificaciones,
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
        throw new Error(
            'useNotificacionesGlobal debe usarse dentro de NotificacionesProvider'
        );
    }

    return context;
};
