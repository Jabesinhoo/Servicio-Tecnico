// src/pages/Dashboard/servicios/AssignTechModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';  // ← Ruta corregida
import { X, UserCheck } from 'lucide-react';

const AssignTechModal = ({ isOpen, onClose, onSubmit, servicioId, servicio }) => {
  const [tecnicos, setTecnicos] = useState([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const reactivate = servicio?.estado === 'cancelado';
  const label = reactivate ? 'Reactivar y asignar' : servicio?.tecnico_id ? 'Reasignar técnico' : 'Asignar técnico';

  useEffect(() => {
    if (isOpen) {
      setSelectedTech(servicio?.tecnico_id || '');
      setReason(''); setErrorMessage('');
      fetchTecnicos();
    }
  }, [isOpen]);

  const fetchTecnicos = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/usuarios/role/tecnico');
      } catch (_) {
        res = await api.get('/api/users?rol=tecnico');
      }
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setTecnicos(rows.filter((item) => item.activo !== false));
    } catch (error) {
      setErrorMessage('No se pudo cargar la lista de técnicos. Vuelve a abrir esta ventana.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTech) return;
    
    setLoading(true);
    try {
      setErrorMessage('');
      await onSubmit(servicioId, selectedTech, {reactivate, reason});
      onClose();
      setSelectedTech('');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'No se pudo asignar el técnico.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="workflow-theme fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6">
            {errorMessage && <p role="alert" className="mb-3 text-sm text-red-600">{errorMessage}</p>}
            {reactivate && <label className="block mb-4 text-sm">Motivo de reactivación
              <textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-lg border p-2 bg-transparent" />
              <span className="block mt-1 text-xs text-gray-500">Se conservará el historial y se buscará una nueva agenda para el equipo.</span>
            </label>}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Técnico
            </label>
            {loading && tecnicos.length === 0 ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 accent-border mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Cargando técnicos...</p>
              </div>
            ) : (
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:accent-ring"
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
              className="px-4 py-2 text-sm font-medium text-white accent-fill rounded-lg hover:accent-fill disabled:opacity-50 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              {label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTechModal;