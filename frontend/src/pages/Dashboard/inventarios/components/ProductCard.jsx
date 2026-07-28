// src/pages/Dashboard/inventarios/components/ProductCard.jsx
import React, { useState } from 'react';
import { Edit, Trash2, Package, AlertTriangle, Eye, X } from 'lucide-react';

const ProductCard = ({ product, onEdit, onDelete, onViewDetail, canEdit }) => {
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const getTipoLabel = (tipo) => {
        const tipos = {
            producto_venta: 'Producto Venta',
            repuesto: 'Repuesto',
            servicio: 'Servicio'
        };
        return tipos[tipo] || tipo;
    };

    const getStockColor = () => {
        if (product.stock_actual <= 0) return 'text-red-600 bg-red-100';
        if (product.stock_actual <= product.stock_minimo) return 'text-yellow-600 bg-yellow-100';
        return 'text-green-600 bg-green-100';
    };

    const openImageModal = (img) => {
        setSelectedImage(img);
        setShowImageModal(true);
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
                {/* Imagen principal */}
                <div
                    className="h-40 bg-gray-100 dark:bg-gray-800 relative cursor-pointer group"
                    onClick={() => product.imagenes?.[0] && openImageModal(product.imagenes[0])}
                >
                    {product.imagenes && product.imagenes.length > 0 ? (
                        <>
                            <img
                                src={product.imagenes[0].url}
                                alt={product.nombre}
                                className="w-full h-full object-cover"
                            />
                            {product.imagenes.length > 1 && (
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                                    +{product.imagenes.length - 1}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-6 h-6 text-white" />
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-gray-400" />
                        </div>
                    )}
                </div>

                {/* Contenido */}
                <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {product.nombre}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">{product.codigo}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {getTipoLabel(product.tipo)}
                        </span>
                    </div>

                    <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Precio:</span>
                            <span className="font-semibold text-gray-900">${Number(product.precio_venta).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Stock:</span>
                            <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${getStockColor()}`}>
                                {product.stock_actual} / {product.stock_minimo}
                            </span>
                        </div>
                        {product.stock_actual <= product.stock_minimo && product.stock_actual > 0 && (
                            <div className="flex items-center gap-1 text-yellow-600 text-xs mt-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Stock bajo</span>
                            </div>
                        )}
                        {product.stock_actual <= 0 && (
                            <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Sin stock</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => onViewDetail(product)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                            <>
                                <button
                                    onClick={() => onEdit(product)}
                                    className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(product)}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de imágenes */}
            {showImageModal && selectedImage && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/80" onClick={() => setShowImageModal(false)}>
                    <div className="relative max-w-4xl w-full max-h-[90vh]">
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img
                            src={selectedImage.url}
                            alt="Producto"
                            className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductCard;