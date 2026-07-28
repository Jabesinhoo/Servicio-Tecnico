// frontend/src/pages/Dashboard/Alquileres/components/ChecklistTecnico.jsx
import React, { useState } from 'react';
import { Camera, Save, X, CheckCircle, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import api from '../../../../services/api';

const ChecklistTecnico = ({ item, tecnicoId, onComplete, onCancel, isModal = false }) => {
    const [formData, setFormData] = useState({
        estado_producto: '',
        observaciones: '',
        imagenes: [],
        firma_tecnico: '',
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [previewImages, setPreviewImages] = useState([]);
    const [firma, setFirma] = useState('');

    const opcionesEstado = [
        { value: 'bueno', label: 'Bueno', color: 'text-green-600' },
        { value: 'regular', label: 'Regular', color: 'text-yellow-600' },
        { value: 'deteriorado', label: 'Deteriorado', color: 'text-orange-600' },
        { value: 'malo', label: 'Malo', color: 'text-red-600' },
    ];

    const validate = () => {
        const newErrors = {};
        if (!formData.estado_producto) newErrors.estado_producto = 'Seleccione el estado del producto';
        if (!formData.observaciones?.trim()) newErrors.observaciones = 'Ingrese observaciones';
        if (!firma) newErrors.firma = 'La firma es requerida';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            const data = {
                estado_producto: formData.estado_producto,
                observaciones: formData.observaciones,
                imagenes: formData.imagenes,
                firma_tecnico: firma,
            };

            await api.post(`/api/alquiler/items/${item.id}/revision`, data);
            
            if (onComplete) onComplete();
            if (onCancel) onCancel();
        } catch (error) {
            console.error('Error saving revision:', error);
            alert(error.response?.data?.message || 'Error al guardar la revision');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        const newImages = [...formData.imagenes];
        const newPreviews = [...previewImages];

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                newPreviews.push(event.target.result);
                newImages.push({
                    url: event.target.result,
                    name: file.name,
                });
                setPreviewImages(newPreviews);
                setFormData({ ...formData, imagenes: newImages });
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        const newImages = [...formData.imagenes];
        const newPreviews = [...previewImages];
        newImages.splice(index, 1);
        newPreviews.splice(index, 1);
        setPreviewImages(newPreviews);
        setFormData({ ...formData, imagenes: newImages });
    };

    const handleFirmaChange = (e) => {
        const value = e.target.value;
        setFirma(value);
        if (errors.firma) {
            setErrors(prev => ({ ...prev, firma: '' }));
        }
    };

    // Si es modal, mostramos el formulario completo
    if (isModal) {
        return (
            <div className="space-y-6">
                {/* Informacion del item */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.producto_codigo} - {item.producto_nombre}
                            </p>
                            <p className="text-xs text-gray-500">Serial: {item.serial || '—'}</p>
                        </div>
                    </div>
                </div>

                {/* Estado del producto */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Estado del Producto *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                        {opcionesEstado.map((opcion) => (
                            <button
                                key={opcion.value}
                                type="button"
                                onClick={() => {
                                    setFormData({ ...formData, estado_producto: opcion.value });
                                    if (errors.estado_producto) {
                                        setErrors(prev => ({ ...prev, estado_producto: '' }));
                                    }
                                }}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                    formData.estado_producto === opcion.value
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <p className={`text-sm font-medium ${opcion.color}`}>
                                    {opcion.label}
                                </p>
                            </button>
                        ))}
                    </div>
                    {errors.estado_producto && <p className="mt-1 text-xs text-red-500">{errors.estado_producto}</p>}
                </div>

                {/* Observaciones */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Observaciones *
                    </label>
                    <textarea
                        value={formData.observaciones}
                        onChange={(e) => {
                            setFormData({ ...formData, observaciones: e.target.value });
                            if (errors.observaciones) {
                                setErrors(prev => ({ ...prev, observaciones: '' }));
                            }
                        }}
                        rows={3}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors.observaciones ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="Describa el estado detallado del producto..."
                    />
                    {errors.observaciones && <p className="mt-1 text-xs text-red-500">{errors.observaciones}</p>}
                </div>

                {/* Fotos */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Evidencias Fotograficas
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                            <Camera className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-500 mt-1">Subir foto</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                        {previewImages.map((img, idx) => (
                            <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl-lg"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Firma */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Firma del Tecnico *
                    </label>
                    <input
                        type="text"
                        value={firma}
                        onChange={handleFirmaChange}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono ${
                            errors.firma ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        placeholder="Nombre completo del tecnico"
                    />
                    {errors.firma && <p className="mt-1 text-xs text-red-500">{errors.firma}</p>}
                    <p className="mt-1 text-xs text-gray-500">Digite su nombre completo como firma digital</p>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Guardando...' : 'Completar Revision'}
                    </button>
                </div>
            </div>
        );
    }

    // Vista compacta para mostrar revisiones existentes
    return (
        <div className="space-y-4">
            {item ? (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.producto_codigo} - {item.producto_nombre}
                            </p>
                            <p className="text-xs text-gray-500">Serial: {item.serial || '—'}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                            item.estado_revision === 'aprobado' ? 'bg-green-100 text-green-800' : 
                            item.estado_revision === 'rechazado' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {item.estado_revision === 'aprobado' ? 'Aprobado' : 
                             item.estado_revision === 'rechazado' ? 'Rechazado' : 
                             'Pendiente'}
                        </span>
                    </div>
                    {item.revisiones && item.revisiones.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                            <p>Estado: {item.revisiones[0].estado_producto}</p>
                            <p>Observaciones: {item.revisiones[0].observaciones}</p>
                            {item.revisiones[0].imagenes?.length > 0 && (
                                <p>Fotos: {item.revisiones[0].imagenes.length}</p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>Seleccione un item para revisar</p>
                </div>
            )}
        </div>
    );
};

export default ChecklistTecnico;