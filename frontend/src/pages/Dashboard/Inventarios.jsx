import "../responsive.css";
// src/pages/Dashboard/Inventarios.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ProductCard from './inventarios/components/ProductCard';
import ProductForm from './inventarios/ProductForm';
import ProductDetailModal from './inventarios/components/ProductDetailModal';
import {
  Plus,
  RefreshCw,
  Search,
  X,
  LayoutGrid,
  Table,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react';

const Inventarios = () => {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showLowStock, setShowLowStock] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      const url = showLowStock ? '/api/products/low-stock' : '/api/products';
      const res = await api.get(url);

      setProducts(res.data || []);
      setFilteredProducts(res.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [showLowStock]);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await api.get('/api/categorias-productos');
      setCategorias(res.data || []);
    } catch (error) {
      console.error('Error fetching categorias:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategorias();
  }, [fetchProducts, fetchCategorias]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
      return;
    }

    const term = searchTerm.toLowerCase();

    const filtered = products.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term) ||
        p.proveedor?.toLowerCase().includes(term)
    );

    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const handleCreate = async (data) => {
    await api.post('/api/products', data);
    await fetchProducts();
  };

  const handleUpdate = async (data) => {
    await api.put(`/api/products/${editingProduct.id}`, data);
    setEditingProduct(null);
    await fetchProducts();
  };

  const handleDeleteClick = (product) => {
    setSelectedProduct(product);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedProduct) return;

    try {
      await api.delete(`/api/products/${selectedProduct.id}`);
      await fetchProducts();
      setShowConfirmModal(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowFormModal(true);
  };

  const handleViewDetail = (product) => {
    setSelectedProductId(product.id);
    setShowDetailModal(true);
  };

  const userRole = user?.rol || 'usuario';
  const canEdit = userRole === 'admin' || userRole === 'inventario';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventarios
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona productos, repuestos y control de stock
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowLowStock(!showLowStock);
              setSearchTerm('');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showLowStock
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                : 'bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Stock Bajo
          </button>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tabla"
            >
              <Table className="w-4 h-4" />
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchProducts}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>

          {canEdit && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowFormModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, código o proveedor..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Vista de Tabla */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="responsive-table-wrap overflow-x-auto">
            <table className="responsive-table min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Código
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Nombre
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Precio
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Stock
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Stock Mínimo
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      No hay productos registrados
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                        {product.codigo}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {product.nombre}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {product.tipo === 'producto_venta'
                          ? 'Venta'
                          : product.tipo === 'repuesto'
                            ? 'Repuesto'
                            : 'Servicio'}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                        ${Number(product.precio_venta).toLocaleString()}
                      </td>

                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            product.stock_actual <= 0
                              ? 'bg-red-100 text-red-800'
                              : product.stock_actual <= product.stock_minimo
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {product.stock_actual}
                        </span>
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {product.stock_minimo}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetail(product)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Ver detalle"
                          >
                            <Package className="w-4 h-4" />
                          </button>

                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleEdit(product)}
                                className="text-green-600 hover:text-green-800 p-1"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteClick(product)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista de Tarjetas */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No hay productos registrados
            </div>
          ) : (
            filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onViewDetail={handleViewDetail}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar Producto"
        message={`¿Estás seguro de eliminar el producto "${selectedProduct?.nombre}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      <ProductForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingProduct(null);
        }}
        onSubmit={editingProduct ? handleUpdate : handleCreate}
        initialData={editingProduct}
        categorias={categorias}
      />

      <ProductDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedProductId(null);
        }}
        productId={selectedProductId}
        onRefresh={fetchProducts}
      />
    </div>
  );
};

export default Inventarios;