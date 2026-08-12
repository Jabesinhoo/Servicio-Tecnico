// frontend/src/hooks/useAuth.js
// Este archivo es un wrapper para usar el contexto desde hooks
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};