// src/pages/Dashboard/inventarios/components/ProductDetailModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, AlertTriangle, Tag, Building, Image as ImageIcon, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import api from '../../../../services/api';

const ProductDetailModal = ({ isOpen, onClose, productId, onRefresh }) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (isOpen && productId) {
      fetchProduct();
    }
  }, [isOpen, productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/products/${productId}`);
      setProduct(res.data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo) => {
    const tipos = {
      producto_venta: 'Producto de Venta',
      repuesto: 'Repuesto',
      servicio: 'Servicio',
      herramienta: 'Herramienta'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoIcon = (tipo) => {
    if (tipo === 'herramienta') return <Wrench className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const getStockColor = () => {
    if (!product) return '';
    if (product.stock_actual <= 0) return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300';
    if (product.stock_actual <= product.stock_minimo) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300';
  };

  const nextImage = () => {
    if (product?.imagenes?.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.imagenes.length);
    }
  };

  const prevImage = () => {
    if (product?.imagenes?.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + product.imagenes.length) % product.imagenes.length);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const imagenes = product.imagenes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            {getTipoIcon(product.tipo)}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {product.nombre}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Imágenes del producto */}
          {imagenes.length > 0 && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <div className="relative">
                <img 
                  src={imagenes[currentImageIndex]?.url || imagenes[0]?.url} 
                  alt={product.nombre}
                  className="w-full h-64 object-contain bg-white dark:bg-gray-900"
                />
                {imagenes.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                      {imagenes.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="p-2 text-center text-xs text-gray-500">
                {currentImageIndex + 1} / {imagenes.length}
              </div>
            </div>
          )}

          {/* Información General */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Código</p>
              <p className="text-sm font-mono font-medium text-gray-900 dark:text-white">{product.codigo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="text-sm font-medium">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                  {getTipoIcon(product.tipo)}
                  {getTipoLabel(product.tipo)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Categoría</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {product.categoria_nombre || 'Sin categoría'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {product.proveedor || '—'}
              </p>
            </div>
          </div>

          {/* Precios */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Información de Precios
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Precio de Venta</p>
                <p className="text-xl font-bold text-green-600">
                  ${Number(product.precio_venta).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Costo</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  ${Number(product.costo).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margen de Ganancia</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {product.precio_venta > 0 
                    ? Math.round(((product.precio_venta - product.costo) / product.precio_venta) * 100) 
                    : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Control de Stock
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Stock Actual</p>
                <p className={`text-xl font-bold ${getStockColor()}`}>
                  {product.stock_actual} unidades
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Stock Mínimo</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {product.stock_minimo} unidades
                </p>
              </div>
            </div>
            {product.stock_actual <= product.stock_minimo && product.stock_actual > 0 && (
              <div className="mt-3 flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Stock bajo, necesita reabastecimiento</span>
              </div>
            )}
            {product.stock_actual <= 0 && (
              <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Producto sin stock disponible</span>
              </div>
            )}
          </div>

          {/* Descripción */}
          {product.descripcion && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Descripción</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {product.descripcion}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;