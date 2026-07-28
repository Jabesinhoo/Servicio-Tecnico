// frontend/src/pages/Dashboard/Alquileres/SolicitudDetail.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Calendar, FileText, Package, Wrench, CheckCircle, XCircle, Clock, Truck, Undo2, Printer, Download, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import AlquilerStatusBadge from './components/AlquilerStatusBadge';
import ItemCard from './components/ItemCard';
import ChecklistTecnico from './components/ChecklistTecnico';

const SolicitudDetail = ({ solicitudId, onClose, onRefresh, onEdit }) => {
    const [solicitud, setSolicitud] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('items');
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItem, setNewItem] = useState({ producto_id: '', serial_id: '', cantidad: 1 });
    const [productos, setProductos] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showChecklist, setShowChecklist] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.rol === 'admin';
    const isTecnico = user.rol === 'tecnico';
    const isVentas = user.rol === 'ventas';

    useEffect(() => {
        if (solicitudId) {
            fetchData();
            fetchProductos();
            fetchTecnicos();
        }
    }, [solicitudId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/api/alquiler/solicitudes/${solicitudId}`);
            setSolicitud(res.data.data);
            setItems(res.data.data.items || []);
        } catch (error) {
            console.error('Error fetching solicitud:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProductos = async () => {
        try {
            const res = await api.get('/api/productos-sync');
            setProductos(res.data.data || []);
        } catch (error) {
            console.error('Error fetching productos:', error);
        }
    };

    const fetchTecnicos = async () => {
        try {
            const res = await api.get('/api/users?rol=tecnico');
            setTecnicos(res.data || []);
        } catch (error) {
            console.error('Error fetching tecnicos:', error);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.producto_id) {
            alert('Seleccione un producto');
            return;
        }
        try {
            await api.post(`/api/alquiler/solicitudes/${solicitudId}/items`, newItem);
            setShowAddItem(false);
            setNewItem({ producto_id: '', serial_id: '', cantidad: 1 });
            fetchData();
        } catch (error) {
            console.error('Error adding item:', error);
            alert(error.response?.data?.message || 'Error al agregar item');
        }
    };

    const handleAssignTecnico = async (itemId, tecnicoId) => {
        try {
            await api.patch(`/api/alquiler/items/${itemId}/asignar`, { tecnico_id: tecnicoId });
            fetchData();
        } catch (error) {
            console.error('Error assigning tecnico:', error);
            alert(error.response?.data?.message || 'Error al asignar tecnico');
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('¿Eliminar este item de la solicitud?')) return;
        try {
            await api.delete(`/api/alquiler/items/${itemId}`);
            fetchData();
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(error.response?.data?.message || 'Error al eliminar item');
        }
    };

    const handleExportar = async () => {
        try {
            const response = await api.get(`/api/alquiler/solicitudes/${solicitudId}/exportar`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `inventario_solicitud_${solicitudId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting:', error);
            alert('Error al exportar');
        }
    };

    const getEstadoColor = (estado) => {
        const colors = {
            pendiente: 'bg-yellow-100 text-yellow-800',
            en_revision: 'bg-blue-100 text-blue-800',
            aprobado: 'bg-green-100 text-green-800',
            rechazado: 'bg-red-100 text-red-800'
        };
        return colors[estado] || 'bg-gray-100 text-gray-800';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!solicitud) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Solicitud no encontrada</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Cerrar</button>
            </div>
        );
    }

    const itemsPendientes = items.filter(i => i.estado_revision === 'pendiente' || i.estado_revision === 'en_revision');
    const itemsCompletados = items.filter(i => i.estado_revision === 'aprobado');
    const todosCompletados = items.length > 0 && itemsCompletados.length === items.length;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {solicitud.numero_solicitud}
                    </h3>
                    <AlquilerStatusBadge status={solicitud.estado} />
                    {todosCompletados && items.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Listo para entregar
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportar}
                        className="px-3 py-1.5 text-sm text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-1"
                    >
                        <Download className="w-3 h-3" />
                        Exportar
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Datos generales */}
            <div className="px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/50">
                <div>
                    <p className="text-xs text-gray-500">Cliente</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{solicitud.cliente_nombre || '—'}</p>
                    <p className="text-xs text-gray-500">{solicitud.cliente_documento || '—'}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Fechas</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                        Inicio: {new Date(solicitud.fecha_inicio).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                        Fin: {new Date(solicitud.fecha_fin).toLocaleDateString()}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Vendedor</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{solicitud.vendedor_nombre || '—'}</p>
                    <p className="text-xs text-gray-500">
                        Documentacion: {solicitud.documentacion_aprobada ? '✅ Aprobada' : '⏳ Pendiente'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4 sm:px-6 pt-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex gap-4 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                            activeTab === 'items' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        Items ({items.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                            activeTab === 'checklist' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Revisiones
                    </button>
                </div>
            </div>

            {/* Contenido */}
            <div className="p-4 sm:p-6">
                {activeTab === 'items' && (
                    <div className="space-y-4">
                        {/* Boton agregar item */}
                        {(isAdmin || isVentas) && solicitud.estado === 'pendiente' && (
                            <button
                                onClick={() => setShowAddItem(!showAddItem)}
                                className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar producto a la solicitud
                            </button>
                        )}

                        {/* Formulario agregar item */}
                        {showAddItem && (
                            <div className="border rounded-lg p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Producto</label>
                                        <select
                                            value={newItem.producto_id}
                                            onChange={(e) => setNewItem({ ...newItem, producto_id: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {productos.filter(p => p.activo).map(p => (
                                                <option key={p.id_externo} value={p.id_externo}>
                                                    {p.codigo} - {p.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Cantidad</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={newItem.cantidad}
                                            onChange={(e) => setNewItem({ ...newItem, cantidad: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowAddItem(false)}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddItem}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Lista de items */}
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No hay productos en esta solicitud
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map((item) => (
                                    <ItemCard
                                        key={item.id}
                                        item={item}
                                        tecnicos={tecnicos}
                                        onAssignTecnico={handleAssignTecnico}
                                        onDelete={handleDeleteItem}
                                        onOpenChecklist={() => {
                                            setSelectedItem(item);
                                            setShowChecklist(true);
                                        }}
                                        canEdit={isAdmin || isVentas}
                                        isAdmin={isAdmin}
                                        isTecnico={isTecnico}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Resumen */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
                                <p className="text-xs text-gray-500">Total Items</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-yellow-600">{itemsPendientes.length}</p>
                                <p className="text-xs text-gray-500">Pendientes</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{itemsCompletados.length}</p>
                                <p className="text-xs text-gray-500">Completados</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'checklist' && (
                    <ChecklistTecnico 
                        items={items}
                        tecnicoId={user?.id}
                        onRefresh={fetchData}
                    />
                )}
            </div>

            {/* Modal de checklist */}
            {showChecklist && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-4 sm:px-6 py-4 border-b flex justify-between">
                            <h3 className="text-lg font-semibold">Checklist de Revision</h3>
                            <button onClick={() => setShowChecklist(false)}>✕</button>
                        </div>
                        <div className="p-4 sm:p-6">
                            <ChecklistTecnico 
                                item={selectedItem}
                                tecnicoId={user?.id}
                                onComplete={() => {
                                    setShowChecklist(false);
                                    fetchData();
                                }}
                                onCancel={() => setShowChecklist(false)}
                                isModal
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SolicitudDetail;