// src/pages/Dashboard/servicios/components/AddPartModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { X, Package, Search, Loader2 } from 'lucide-react';

const AddPartModal = ({ isOpen, onClose, onSubmit, servicioId }) => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = products.filter(p =>
        p.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term)
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    setSearching(true);
    try {
      // Traer productos de tipo repuesto y herramienta que tengan stock
      const res = await api.get('/api/products?tipo=repuesto,herramienta');
      const productosConStock = (res.data || []).filter(p => p.stock_actual > 0);
      setProducts(productosConStock);
      setFilteredProducts(productosConStock);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !cantidad) return;
    
    if (cantidad > selectedProduct.stock_actual) {
      alert(`Solo hay ${selectedProduct.stock_actual} unidades disponibles en stock`);
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(servicioId, {
        product_id: selectedProduct.id,
        cantidad,
        observaciones
      });
      onClose();
      setSelectedProduct(null);
      setCantidad(1);
      setObservaciones('');
    } catch (error) {
      console.error('Error adding part:', error);
      alert(error.response?.data?.message || 'Error al agregar el repuesto');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agregar Repuesto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Buscar Repuesto
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o código del repuesto..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {searching ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Cargando productos...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      selectedProduct?.id === product.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{product.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Código: {product.codigo} | Stock: {product.stock_actual} | Precio: ${product.precio_venta?.toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No hay productos con stock disponible
              </div>
            )}

            {selectedProduct && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{selectedProduct.nombre}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Stock disponible: {selectedProduct.stock_actual} unidades
                  </p>
                  {selectedProduct.precio_venta > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Precio unitario: ${selectedProduct.precio_venta.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock_actual}
                    value={cantidad}
                    onChange={(e) => setCantidad(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo disponible: {selectedProduct.stock_actual}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    placeholder="Motivo del uso, ubicación, etc."
                  />
                </div>
              </>
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
              disabled={!selectedProduct || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              {loading ? 'Agregando...' : 'Agregar Repuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPartModal;