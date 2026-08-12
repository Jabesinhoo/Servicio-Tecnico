// frontend/src/components/PermissionButton.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

const PermissionButton = ({ 
  permission, 
  children, 
  onClick, 
  className = '',
  showLocked = false,
  ...props 
}) => {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(permission)) {
    if (showLocked) {
      return (
        <button
          className={`opacity-50 cursor-not-allowed ${className}`}
          disabled
          {...props}
        >
          <Lock className="w-4 h-4 inline mr-1" />
          {children}
        </button>
      );
    }
    return null;
  }
  
  return (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  );
};

export default PermissionButton;