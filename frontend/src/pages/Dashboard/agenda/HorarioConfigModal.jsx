// src/pages/Dashboard/agenda/HorarioConfigModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';

const diasSemana = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

const HorarioConfigModal = ({ isOpen, onClose, tecnicoId, tecnicoNombre, onSave }) => {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && tecnicoId) {
      fetchHorarios();
    }
  }, [isOpen, tecnicoId]);

  const fetchHorarios = async () => {
    try {
      const res = await api.get(`/api/agenda/horario/${tecnicoId}`);
      setHorarios(res.data || []);
    } catch (error) {
      console.error('Error fetching horarios:', error);
    }
  };

  const agregarHorario = () => {
    setHorarios([...horarios, {
      dia_semana: 1,
      hora_inicio: '08:00',
      hora_fin: '17:00',
      activo: true
    }]);
  };

  const eliminarHorario = (index) => {
    const nuevos = [...horarios];
    nuevos.splice(index, 1);
    setHorarios(nuevos);
  };

  const actualizarHorario = (index, field, value) => {
    const nuevos = [...horarios];
    nuevos[index][field] = value;
    setHorarios(nuevos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/api/agenda/horario/${tecnicoId}`, { horarios });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving horarios:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configurar Horario - {tecnicoNombre}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-4">
            {horarios.map((horario, idx) => (
              <div key={idx} className="flex gap-3 items-end p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Día</label>
                  <select
                    value={horario.dia_semana}
                    onChange={(e) => actualizarHorario(idx, 'dia_semana', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                  >
                    {diasSemana.map(dia => (
                      <option key={dia.value} value={dia.value}>{dia.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={horario.hora_inicio}
                    onChange={(e) => actualizarHorario(idx, 'hora_inicio', e.target.value)}
                    className="w-full sm:w-32 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={horario.hora_fin}
                    onChange={(e) => actualizarHorario(idx, 'hora_fin', e.target.value)}
                    className="w-full sm:w-32 px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => eliminarHorario(idx)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            <button
              type="button"
              onClick={agregarHorario}
              className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar Horario
            </button>
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
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Horarios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HorarioConfigModal;