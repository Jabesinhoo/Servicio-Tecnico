import axios from 'axios';

// Elimina una posible terminación /api para evitar rutas /api/api.
// Si VITE_API_URL no existe, usa el mismo dominio del navegador.
const RAW_API_URL = import.meta.env.VITE_API_URL || '';

const API_URL = RAW_API_URL
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '');

const api = axios.create({
    baseURL: API_URL,
    timeout: 180000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Agregar token a todas las solicitudes
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Manejar respuestas no autorizadas
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error('PETICIÓN 401 DETECTADA:', {
                url: error.config?.url,
                baseURL: error.config?.baseURL,
                method: error.config?.method,
                respuesta: error.response?.data,
                tokenExiste: Boolean(localStorage.getItem('token')),
                authorization:
                    error.config?.headers?.Authorization ||
                    error.config?.headers?.authorization ||
                    'NO ENVIADO',
            });

            // Temporalmente NO borrar token ni redirigir.
            // localStorage.clear();
            // window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default api;
