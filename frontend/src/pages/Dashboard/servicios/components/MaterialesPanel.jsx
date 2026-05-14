// src/pages/Dashboard/servicios/components/MaterialesPanel.jsx
import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../../../../services/api';

const MaterialesPanel = ({ servicioId, tecnicoId, isAdmin = false, onRefresh }) => {
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [productos, setProductos] = useState([]);
  const [newMaterial, setNewMaterial] = useState({
    product_id: '',
    cantidad_solicitada: 1,
    observaciones: ''
  });

  useEffect(() => {
    if (servicioId) {
      fetchMateriales();
      fetchProductos();
    }
  }, [servicioId]);

  const fetchMateriales = async () => {
    try {
      const res = await api.get(`/api/materiales/servicio/${servicioId}`);
      setMateriales(res.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductos = async () => {
    try {
      const res = await api.get('/api/products?tipo=repuesto,herramienta');
      setProductos(res.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const solicitarMaterial = async () => {
    if (!newMaterial.product_id) {
      alert('Seleccione un producto');
      return;
    }
    try {
      await api.post(`/api/materiales/servicio/${servicioId}/solicitar`, {
        materiales: [newMaterial]
      });
      setShowForm(false);
      setNewMaterial({ product_id: '', cantidad_solicitada: 1, observaciones: '' });
      fetchMateriales();
    } catch (error) {
      console.error('Error:', error);
      alert(error.response?.data?.message || 'Error al solicitar material');
    }
  };

  const entregarMaterial = async (materialId, cantidad) => {
    const producto = productos.find(p => p.id === materiales.find(m => m.id === materialId)?.product_id);
    if (cantidad > (producto?.stock_actual || 0)) {
      alert(`Solo hay ${producto?.stock_actual || 0} unidades disponibles`);
      return;
    }
    try {
      await api.put(`/api/materiales/${materialId}/entregar`, { cantidad_entregada: cantidad });
      fetchMateriales();
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert(error.response?.data?.message || 'Error al entregar material');
    }
  };

  const reportarUso = async (materialId, data) => {
    try {
      await api.put(`/api/materiales/${materialId}/usar`, data);
      fetchMateriales();
      setSelectedMaterial(null);
      onRefresh();
    } catch (error) {
      console.error('Error:', error);
      alert(error.response?.data?.message || 'Error al reportar uso');
    }
  };

  const getEstadoMaterial = (material) => {
    if (material.cantidad_devuelta > 0) return 'devuelto';
    if (material.cantidad_usada > 0) return 'usado';
    if (material.cantidad_entregada > 0) return 'entregado';
    return 'solicitado';
  };

  const estadoColors = {
    solicitado: 'bg-yellow-100 text-yellow-800',
    entregado: 'bg-blue-100 text-blue-800',
    usado: 'bg-purple-100 text-purple-800',
    devuelto: 'bg-green-100 text-green-800'
  };

  const estadoLabels = {
    solicitado: 'Solicitado',
    entregado: 'Entregado',
    usado: 'Usado',
    devuelto: 'Devuelto'
  };

  if (loading) return <div className="text-center py-4">Cargando materiales...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-4 h-4" />
          Materiales y Repuestos
        </h4>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Solicitar Material
        </button>
      </div>

      {materiales.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No hay materiales solicitados</p>
      ) : (
        <div className="space-y-3">
          {materiales.map((material) => {
            const estado = getEstadoMaterial(material);
            const producto = productos.find(p => p.id === material.product_id);
            
            return (
              <div key={material.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {material.producto_nombre || producto?.nombre || 'Producto'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColors[estado]}`}>
                        {estadoLabels[estado]}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-gray-500">Solicitado:</span>
                        <span className="ml-1 font-medium">{material.cantidad_solicitada}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Entregado:</span>
                        <span className="ml-1 font-medium">{material.cantidad_entregada || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Usado:</span>
                        <span className="ml-1 font-medium">{material.cantidad_usada || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Devuelto:</span>
                        <span className="ml-1 font-medium">{material.cantidad_devuelta || 0}</span>
                      </div>
                    </div>
                    
                    {material.observaciones && (
                      <p className="text-xs text-gray-500 mt-2">{material.observaciones}</p>
                    )}

                    {producto && (
                      <p className="text-xs text-gray-400 mt-1">
                        Stock disponible: {producto.stock_actual} unidades
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    {estado === 'solicitado' && isAdmin && (
                      <button
                        onClick={() => {
                          const cantidad = prompt('Cantidad a entregar:', material.cantidad_solicitada);
                          if (cantidad) entregarMaterial(material.id, parseInt(cantidad));
                        }}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Entregar material"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    
                    {estado === 'entregado' && (
                      <button
                        onClick={() => setSelectedMaterial(material)}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Reportar uso"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para solicitar material */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex justify-between">
              <h3 className="text-lg font-semibold">Solicitar Material</h3>
              <button onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Producto</label>
                <select
                  value={newMaterial.product_id}
                  onChange={(e) => setNewMaterial({ ...newMaterial, product_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Seleccionar...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock: {p.stock_actual})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={newMaterial.cantidad_solicitada}
                  onChange={(e) => setNewMaterial({ ...newMaterial, cantidad_solicitada: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea
                  value={newMaterial.observaciones}
                  onChange={(e) => setNewMaterial({ ...newMaterial, observaciones: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
              <button onClick={solicitarMaterial} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Solicitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reportar uso */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b flex justify-between">
              <h3 className="text-lg font-semibold">Reportar Uso - {selectedMaterial.producto_nombre}</h3>
              <button onClick={() => setSelectedMaterial(null)}>✕</button>
            </div>
            <ReporteUsoForm
              material={selectedMaterial}
              onSubmit={reportarUso}
              onCancel={() => setSelectedMaterial(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Formulario para reportar uso
const ReporteUsoForm = ({ material, onSubmit, onCancel }) => {
  const [data, setData] = useState({
    cantidad_usada: 0,
    cantidad_devuelta: 0,
    cantidad_desperdiciada: 0,
    observaciones: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(material.id, data);
  };

  const totalEntregado = material.cantidad_entregada;
  const suma = data.cantidad_usada + data.cantidad_devuelta + data.cantidad_desperdiciada;
  const isValid = suma === totalEntregado;

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          Cantidad entregada: <strong>{totalEntregado}</strong>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad Usada</label>
          <input
            type="number"
            min="0"
            max={totalEntregado}
            value={data.cantidad_usada}
            onChange={(e) => setData({ ...data, cantidad_usada: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad Devuelta</label>
          <input
            type="number"
            min="0"
            max={totalEntregado}
            value={data.cantidad_devuelta}
            onChange={(e) => setData({ ...data, cantidad_devuelta: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad Desperdiciada</label>
          <input
            type="number"
            min="0"
            max={totalEntregado}
            value={data.cantidad_desperdiciada}
            onChange={(e) => setData({ ...data, cantidad_desperdiciada: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div className={`text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          Total: {suma} / {totalEntregado}
          {!isValid && ' - La suma debe igualar la cantidad entregada'}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Observaciones</label>
          <textarea
            value={data.observaciones}
            onChange={(e) => setData({ ...data, observaciones: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
      
      <div className="px-6 py-4 border-t flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600">Cancelar</button>
        <button type="submit" disabled={!isValid} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
          Guardar Reporte
        </button>
      </div>
    </form>
  );
};

export default MaterialesPanel;