// frontend/src/hooks/usePermissions.js
import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { user, hasPermission, hasAnyPermission, canViewModule } = useAuth();

  const getUserPermissions = () => {
    if (!user) return [];
    if (user.rol === 'admin' || user.role?.name === 'admin') {
      return ['*'];
    }
    return user.role?.permissions?.map(p => p.name) || [];
  };

  const getModulePermissions = (module) => {
    const allPermissions = getUserPermissions();
    return allPermissions.filter(p => p.startsWith(`${module}:`));
  };

  return {
    hasPermission,
    hasAnyPermission,
    canViewModule,
    getUserPermissions,
    getModulePermissions,
    isAdmin: user?.rol === 'admin' || user?.role?.name === 'admin',
    isTecnico: user?.rol === 'tecnico' || user?.role?.name === 'tecnico',
  };
};