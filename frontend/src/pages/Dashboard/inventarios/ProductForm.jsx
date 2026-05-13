// src/pages/Dashboard/inventarios/ProductForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Package, DollarSign, AlertCircle, Tag } from 'lucide-react';
import ProductImageUpload from './components/ProductImageUpload';

const ProductForm = ({ isOpen, onClose, onSubmit, initialData, categorias = [] }) => {
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: '',
        descripcion: '',
        tipo: 'producto_venta',
        precio_venta: 0,
        costo: 0,
        stock_actual: 0,
        stock_minimo: 0,
        proveedor: '',
        categoria_id: '',
        imagenes: [],
        estado: true,
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                codigo: initialData.codigo || '',
                nombre: initialData.nombre || '',
                descripcion: initialData.descripcion || '',
                tipo: initialData.tipo || 'producto_venta',
                precio_venta: initialData.precio_venta || 0,
                costo: initialData.costo || 0,
                stock_actual: initialData.stock_actual || 0,
                stock_minimo: initialData.stock_minimo || 0,
                proveedor: initialData.proveedor || '',
                categoria_id: initialData.categoria_id || '',
                imagenes: initialData.imagenes || [],
                estado: initialData.estado !== false,
            });
        } else {
            resetForm();
        }
        setErrors({});
    }, [initialData, isOpen]);

    const resetForm = () => {
        setFormData({
            codigo: '',
            nombre: '',
            descripcion: '',
            tipo: 'producto_venta',
            precio_venta: 0,
            costo: 0,
            stock_actual: 0,
            stock_minimo: 0,
            proveedor: '',
            categoria_id: '',
            imagenes: [],
            estado: true,
        });
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.codigo.trim()) newErrors.codigo = 'El código es requerido';
        if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
        if (formData.precio_venta < 0) newErrors.precio_venta = 'El precio no puede ser negativo';
        if (formData.stock_actual < 0) newErrors.stock_actual = 'El stock no puede ser negativo';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const dataToSubmit = {
                ...formData,
                categoria_id: formData.categoria_id === '' ? null : formData.categoria_id
            };
            await onSubmit(dataToSubmit);
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

    const tipos = [
        { value: 'producto_venta', label: 'Producto de Venta' },
        { value: 'repuesto', label: 'Repuesto' },
        { value: 'servicio', label: 'Servicio' },
        { value: 'herramienta', label: 'Herramienta' }, 

    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Código *
                                </label>
                                <input
                                    type="text"
                                    name="codigo"
                                    value={formData.codigo}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${errors.codigo ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                        }`}
                                    placeholder="SKU-001"
                                />
                                {errors.codigo && <p className="mt-1 text-xs text-red-500">{errors.codigo}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Tipo *
                                </label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                >
                                    {tipos.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={formData.nombre}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${errors.nombre ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                        }`}
                                />
                                {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripción
                                </label>
                                <textarea
                                    name="descripcion"
                                    value={formData.descripcion}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Precio de Venta
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        name="precio_venta"
                                        value={formData.precio_venta}
                                        onChange={handleChange}
                                        step="0.01"
                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${errors.precio_venta ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                            }`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Costo
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        name="costo"
                                        value={formData.costo}
                                        onChange={handleChange}
                                        step="0.01"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Stock Actual
                                </label>
                                <input
                                    type="number"
                                    name="stock_actual"
                                    value={formData.stock_actual}
                                    onChange={handleChange}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${errors.stock_actual ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                                        }`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Stock Mínimo (Alerta)
                                </label>
                                <input
                                    type="number"
                                    name="stock_minimo"
                                    value={formData.stock_minimo}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Categoría
                                </label>
                                <select
                                    name="categoria_id"
                                    value={formData.categoria_id}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                >
                                    <option value="">Sin categoría</option>
                                    {categorias.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Proveedor
                                </label>
                                <input
                                    type="text"
                                    name="proveedor"
                                    value={formData.proveedor}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Imágenes del Producto
                                </label>
                                <ProductImageUpload
                                    images={formData.imagenes}
                                    onChange={(imagenes) => setFormData(prev => ({ ...prev, imagenes }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
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

export default ProductForm;