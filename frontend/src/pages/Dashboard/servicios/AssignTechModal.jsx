// src/pages/Dashboard/servicios/AssignTechModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';  // ← Ruta corregida
import { X } from 'lucide-react';

const AssignTechModal = ({ isOpen, onClose, onSubmit }) => {
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
      setTecnicos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedTech) {
      onSubmit(selectedTech);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asignar Técnico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Técnico
            </label>
            {loading ? (
              <div className="text-center py-4">Cargando técnicos...</div>
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
          
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedTech || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Asignar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTechModal;