// frontend/src/components/PermissionGuard.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

const PermissionGuard = ({ 
  permission, 
  children, 
  fallback = null,
  showLocked = false 
}) => {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(permission)) {
    if (showLocked) {
      return (
        <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Lock className="w-6 h-6 text-gray-400 mr-3" />
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Acceso Restringido</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">No tienes permisos para ver este contenido</p>
          </div>
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

export default PermissionGuard;