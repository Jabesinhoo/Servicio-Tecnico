// frontend/src/components/PermissionGuard.jsx
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { Shield, Lock } from 'lucide-react';

const PermissionGuard = ({ 
  permission, 
  children, 
  fallback = null,
  showLocked = false 
}) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    if (showLocked) {
      return (
        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
          <Lock className="w-5 h-5 text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">No tienes permisos para ver este contenido</span>
        </div>
      );
    }
    return fallback;
  }
  
  return children;
};

export default PermissionGuard;