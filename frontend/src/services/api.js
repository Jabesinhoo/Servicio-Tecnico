// frontend/src/services/api.js
import axios from "axios";

const RAW_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

const API_URL = RAW_API_URL
  .replace(/\/api\/?$/i, "")
  .replace(/\/+$/, "");

// ============================================================
// API PÚBLICA
// Login, registro, etc.
// NO utiliza token ni interceptores de autenticación.
// ============================================================
export const publicApi = axios.create({
  baseURL: API_URL,
  timeout: 180000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
// API AUTENTICADA
// ============================================================
const api = axios.create({
  baseURL: API_URL,
  timeout: 180000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
// INTERCEPTOR REQUEST
// Añadir JWT únicamente a rutas protegidas
// ============================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// INTERCEPTOR RESPONSE
// Manejar sesiones expiradas
// ============================================================
api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      console.warn("⚠️ Sesión expirada o token inválido");

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;