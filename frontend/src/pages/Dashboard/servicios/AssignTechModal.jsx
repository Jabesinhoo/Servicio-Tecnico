// src/pages/Dashboard/servicios/AssignTechModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';  // ← Ruta corregida
import { X, UserCheck } from 'lucide-react';

const AssignTechModal = ({ isOpen, onClose, onSubmit, servicioId }) => {
  const [tecnicos, setTecnicos] = useState([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTecnicos();
    }
  }, [isOpen]);

  const fetchTecnicos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users?rol=tecnico');
      setTecnicos(res.data || []);
    } catch (error) {
      console.error('Error fetching tecnicos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTech) return;
    
    setLoading(true);
    try {
      await onSubmit(servicioId, selectedTech);
      onClose();
      setSelectedTech('');
    } catch (error) {
      console.error('Error assigning tech:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asignar Técnico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Técnico
            </label>
            {loading && tecnicos.length === 0 ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Cargando técnicos...</p>
              </div>
            ) : (
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Seleccione un técnico...</option>
                {tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nombre1} {tecnico.apellidos || ''} - {tecnico.usuario}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedTech || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              Asignar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTechModal;