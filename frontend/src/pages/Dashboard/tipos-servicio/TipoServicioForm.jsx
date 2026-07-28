// src/pages/Dashboard/tipos-servicio/TipoServicioForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, DollarSign, AlertCircle } from 'lucide-react';

const TipoServicioForm = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    valor_base: 0,
    duracion_estimada: 60,
    requiere_diagnostico: false,
    requiere_repuestos: false,
    requiere_aprobacion: false,
    categoria: '',
    activo: true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nombre: initialData.nombre || '',
        descripcion: initialData.descripcion || '',
        valor_base: initialData.valor_base || 0,
        duracion_estimada: initialData.duracion_estimada || 60,
        requiere_diagnostico: initialData.requiere_diagnostico || false,
        requiere_repuestos: initialData.requiere_repuestos || false,
        requiere_aprobacion: initialData.requiere_aprobacion || false,
        categoria: initialData.categoria || '',
        activo: initialData.activo !== false,
      });
    } else {
      resetForm();
    }
    setErrors({});
  }, [initialData, isOpen]);

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      valor_base: 0,
      duracion_estimada: 60,
      requiere_diagnostico: false,
      requiere_repuestos: false,
      requiere_aprobacion: false,
      categoria: '',
      activo: true,
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
    if (formData.valor_base < 0) newErrors.valor_base = 'El valor no puede ser negativo';
    if (formData.duracion_estimada < 1) newErrors.duracion_estimada = 'La duración debe ser mayor a 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const categorias = [
    'Mantenimiento',
    'Reparación',
    'Instalación',
    'Configuración',
    'Diagnóstico',
    'Capacitación',
    'Soporte',
    'Garantía',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? 'Editar Tipo de Servicio' : 'Nuevo Tipo de Servicio'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Servicio *
              </label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                  errors.nombre ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="Ej: Mantenimiento de "
              />
              {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría
              </label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">Seleccionar categoría...</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción Detallada
              </label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Describa en detalle qué incluye este servicio..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor Base
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    name="valor_base"
                    value={formData.valor_base}
                    onChange={handleChange}
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                      errors.valor_base ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                </div>
                {errors.valor_base && <p className="mt-1 text-xs text-red-500">{errors.valor_base}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duración Estimada (minutos)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    name="duracion_estimada"
                    value={formData.duracion_estimada}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                      errors.duracion_estimada ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                </div>
                {errors.duracion_estimada && <p className="mt-1 text-xs text-red-500">{errors.duracion_estimada}</p>}
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requiere_diagnostico"
                  checked={formData.requiere_diagnostico}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Requiere diagnóstico previo</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requiere_repuestos"
                  checked={formData.requiere_repuestos}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Requiere repuestos adicionales</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requiere_aprobacion"
                  checked={formData.requiere_aprobacion}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Requiere aprobación de presupuesto</span>
              </label>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TipoServicioForm;