// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para obtener el perfil del usuario
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get('/api/usuarios/me');
      setUser(response.data.data);
    } catch (err) {
      console.error('Error al obtener perfil:', err);
      // Si el token es inválido, lo eliminamos
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Login
  const login = async (identifier, password) => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.post('/api/auth/login', { identifier, password });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        // Esperar a que se cargue el perfil
        await fetchUserProfile();
        return { success: true, user: response.data.user };
      }
      
      return { success: false, message: 'Credenciales inválidas' };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al iniciar sesión';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
  }, []);

  // Registrar nuevo usuario (solo para admin)
  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.post('/api/usuarios', userData);
      return { success: true, data: response.data.data };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al registrar usuario';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = useCallback((permissionName) => {
    if (!user) return false;
    
    // Si es admin, tiene todos los permisos
    if (user.rol === 'admin' || user.role?.name === 'admin') return true;
    
    // Verificar si el rol del usuario tiene el permiso
    return user.role?.permissions?.some(p => p.name === permissionName) || false;
  }, [user]);

  // Verificar si el usuario tiene algún permiso de una lista
  const hasAnyPermission = useCallback((permissionNames) => {
    if (!Array.isArray(permissionNames)) {
      return hasPermission(permissionNames);
    }
    return permissionNames.some(name => hasPermission(name));
  }, [hasPermission]);

  // Verificar si el usuario puede ver un módulo
  const canViewModule = useCallback((module) => {
    if (!user) return false;
    if (user.rol === 'admin' || user.role?.name === 'admin') return true;
    
    const viewPermissions = [
      `${module}_view`,
      `${module}_create`,
      `${module}_edit`,
      `${module}_delete`
    ];
    return hasAnyPermission(viewPermissions);
  }, [user, hasAnyPermission]);

  const value = {
    user,
    setUser,
    loading,
    error,
    login,
    logout,
    register,
    hasPermission,
    hasAnyPermission,
    canViewModule,
    isAdmin: user?.rol === 'admin' || user?.role?.name === 'admin',
    isTecnico: user?.rol === 'tecnico' || user?.role?.name === 'tecnico',
    isCaja: user?.rol === 'caja' || user?.role?.name === 'caja',
    isDirector: user?.rol === 'director_tecnico' || user?.role?.name === 'director_tecnico',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;