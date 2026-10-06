// src/pages/Dashboard/agenda/AgendarModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
import api from '../../../services/api';

const colombiaDate = (offsetDays = 0) => new Date(Date.now() - 5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);

const AgendarModal = ({ isOpen, onClose, servicioId, servicioCodigo, onSave }) => {
  const [formData, setFormData] = useState({
    fecha_agendada: '',
    hora_inicio: '09:00',
    duracion_estimada: 60
  });
  const [error,setError]=useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && servicioId) {
      // Resetear formulario
      setError('');
      setFormData({
        fecha_agendada: colombiaDate(1),
        hora_inicio: '09:00',
        duracion_estimada: 60
      });
    }
  }, [isOpen, servicioId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);setError('');
    try {
      await api.put(`/api/agenda/servicio/${servicioId}`, formData);
      onSave();
      onClose();
    } catch (error) {
      setError(error.response?.data?.message||'No fue posible programar el servicio.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="workflow-theme fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Agendar Servicio - {servicioCodigo}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-4">{error&&<p role="alert" className="text-red-600">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.fecha_agendada}
                  onChange={(e) => setFormData({ ...formData, fecha_agendada: e.target.value })}
                  min={colombiaDate()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora de Inicio
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duración Estimada (minutos)
              </label>
              <p className="text-sm">La agenda utiliza la duración configurada en el tipo de servicio y valida los horarios laborales de todo el equipo, en hora de Colombia.</p>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white accent-fill rounded-lg hover:accent-fill disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgendarModal;