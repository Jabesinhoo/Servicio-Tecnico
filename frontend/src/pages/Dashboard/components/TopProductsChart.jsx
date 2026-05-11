// src/pages/Dashboard/components/TopProductsChart.jsx
import React from 'react';

const TopProductsChart = ({ products, loading }) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No hay datos de productos</p>
      </div>
    );
  }

  const maxQuantity = Math.max(...products.map(p => p.cantidad));

  return (
    <div className="space-y-4">
      {products.map((product, index) => (
        <div key={product.id} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">#{index + 1}</span>
              <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                {product.nombre}
              </span>
            </div>
            <span className="text-gray-600 dark:text-gray-400">{product.cantidad} unidades</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all duration-500"
              style={{ width: `${(product.cantidad / maxQuantity) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopProductsChart;