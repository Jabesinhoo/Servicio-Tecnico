// frontend/src/pages/Dashboard/Alquileres/SolicitudForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, Search, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const SolicitudForm = ({ isOpen, onClose, onSubmit, onSuccess, initialData = null }) => {
    const [formData, setFormData] = useState({
        cliente_id: '',
        cliente_nombre: '',
        cliente_documento: '',
        fecha_inicio: '',
        fecha_fin: '',
        observaciones: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [clientes, setClientes] = useState([]);
    const [showClientes, setShowClientes] = useState(false);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            resetForm();
            if (initialData) {
                setFormData(initialData);
            }
        }
    }, [isOpen, initialData]);

    const resetForm = () => {
        setFormData({
            cliente_id: '',
            cliente_nombre: '',
            cliente_documento: '',
            fecha_inicio: '',
            fecha_fin: '',
            observaciones: '',
        });
        setErrors({});
        setSearchTerm('');
        setClientes([]);
        setShowClientes(false);
    };

    // frontend/src/pages/Dashboard/Alquileres/SolicitudForm.jsx
    // Modificar la funcion buscarClientes

    const buscarClientes = async () => {
        if (searchTerm.length < 2) {
            return;
        }
        setSearching(true);
        try {
            // Cambiar el endpoint para buscar en sync_clientes
            const res = await api.get(`/api/sync/clientes/buscar?q=${encodeURIComponent(searchTerm)}`);
            setClientes(res.data.data || []);
            setShowClientes(true);
        } catch (error) {
            console.error('Error buscando clientes:', error);
        } finally {
            setSearching(false);
        }
    };

    // La funcion seleccionarCliente se mantiene igual
    const seleccionarCliente = (cliente) => {
        const nombre = cliente.tipo_persona === 'juridica'
            ? cliente.razon_social
            : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim();

        setFormData({
            ...formData,
            cliente_id: cliente.id,
            cliente_nombre: nombre,
            cliente_documento: cliente.documento || '',
        });
        setShowClientes(false);
        setSearchTerm('');
        setErrors(prev => ({ ...prev, cliente: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.cliente_id) newErrors.cliente = 'Seleccione un cliente';
        if (!formData.fecha_inicio) newErrors.fecha_inicio = 'Fecha de inicio es requerida';
        if (!formData.fecha_fin) newErrors.fecha_fin = 'Fecha de fin es requerida';
        if (formData.fecha_inicio && formData.fecha_fin && formData.fecha_inicio > formData.fecha_fin) {
            newErrors.fecha_fin = 'La fecha de fin debe ser posterior a la de inicio';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await onSubmit({
                cliente_id: formData.cliente_id,
                fecha_inicio: formData.fecha_inicio,
                fecha_fin: formData.fecha_fin,
                observaciones: formData.observaciones,
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error submitting:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {initialData ? 'Editar Solicitud' : 'Nueva Solicitud de Alquiler'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-4 sm:p-6 space-y-5">
                        {/* Buscador de Cliente */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cliente *
                            </label>
                            {formData.cliente_id ? (
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                                            {formData.cliente_nombre}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            Documento: {formData.cliente_documento || '—'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, cliente_id: '', cliente_nombre: '', cliente_documento: '' });
                                            setSearchTerm('');
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Buscar cliente por nombre o documento..."
                                                className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.cliente ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                                    }`}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={buscarClientes}
                                            disabled={searching || searchTerm.length < 2}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Buscar
                                        </button>
                                    </div>
                                    {errors.cliente && <p className="mt-1 text-xs text-red-500">{errors.cliente}</p>}

                                    {showClientes && (
                                        <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                                            {clientes.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500">No se encontraron clientes</div>
                                            ) : (
                                                clientes.map((cliente) => {
                                                    const nombre = cliente.tipo_persona === 'juridica'
                                                        ? cliente.razon_social
                                                        : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim();
                                                    return (
                                                        <button
                                                            key={cliente.id}
                                                            type="button"
                                                            onClick={() => seleccionarCliente(cliente)}
                                                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b last:border-0 transition-colors"
                                                        >
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{nombre}</p>
                                                            <p className="text-xs text-gray-500">Documento: {cliente.documento || '—'} | Telefono: {cliente.telefono || '—'}</p>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fecha de Inicio *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        name="fecha_inicio"
                                        value={formData.fecha_inicio}
                                        onChange={handleChange}
                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.fecha_inicio ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                            }`}
                                    />
                                </div>
                                {errors.fecha_inicio && <p className="mt-1 text-xs text-red-500">{errors.fecha_inicio}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fecha de Fin *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        name="fecha_fin"
                                        value={formData.fecha_fin}
                                        onChange={handleChange}
                                        min={formData.fecha_inicio}
                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.fecha_fin ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                            }`}
                                    />
                                </div>
                                {errors.fecha_fin && <p className="mt-1 text-xs text-red-500">{errors.fecha_fin}</p>}
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Observaciones
                            </label>
                            <textarea
                                name="observaciones"
                                value={formData.observaciones}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Informacion adicional sobre la solicitud..."
                            />
                        </div>
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
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear Solicitud')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SolicitudForm;