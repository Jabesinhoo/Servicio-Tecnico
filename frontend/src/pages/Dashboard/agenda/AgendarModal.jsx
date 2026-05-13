// src/pages/Dashboard/agenda/AgendarModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
import api from '../../../services/api';

const AgendarModal = ({ isOpen, onClose, servicioId, servicioCodigo, onSave }) => {
  const [formData, setFormData] = useState({
    fecha_agendada: '',
    hora_inicio: '09:00',
    duracion_estimada: 60
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && servicioId) {
      // Resetear formulario
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormData({
        fecha_agendada: tomorrow.toISOString().split('T')[0],
        hora_inicio: '09:00',
        duracion_estimada: 60
      });
    }
  }, [isOpen, servicioId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/api/agenda/servicio/${servicioId}`, formData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error agendando servicio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Agendar Servicio - {servicioCodigo}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
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
                  min={new Date().toISOString().split('T')[0]}
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
              <select
                value={formData.duracion_estimada}
                onChange={(e) => setFormData({ ...formData, duracion_estimada: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1.5 horas</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
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
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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