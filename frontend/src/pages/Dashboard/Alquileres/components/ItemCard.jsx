// frontend/src/pages/Dashboard/Alquileres/components/ItemCard.jsx
import React, { useState } from 'react';
import { User, CheckCircle, XCircle, Clock, Edit, Trash2, UserCheck } from 'lucide-react';

const ItemCard = ({ item, tecnicos, onAssignTecnico, onDelete, onOpenChecklist, canEdit, isAdmin, isTecnico }) => {
    const [showAssign, setShowAssign] = useState(false);
    const [selectedTecnico, setSelectedTecnico] = useState('');

    const estadoColors = {
        pendiente: 'bg-yellow-100 text-yellow-800',
        en_revision: 'bg-blue-100 text-blue-800',
        aprobado: 'bg-green-100 text-green-800',
        rechazado: 'bg-red-100 text-red-800'
    };

    const estadoIcons = {
        pendiente: <Clock className="w-4 h-4" />,
        en_revision: <Clock className="w-4 h-4" />,
        aprobado: <CheckCircle className="w-4 h-4" />,
        rechazado: <XCircle className="w-4 h-4" />
    };

    const handleAssign = () => {
        if (!selectedTecnico) return;
        onAssignTecnico(item.id, selectedTecnico);
        setShowAssign(false);
        setSelectedTecnico('');
    };

    const isComplete = item.estado_revision === 'aprobado' || item.estado_revision === 'rechazado';
    const canReview = isTecnico && !isComplete && item.tecnico_id === localStorage.getItem('userId');

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.producto_codigo} - {item.producto_nombre}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${estadoColors[item.estado_revision]}`}>
                            {estadoIcons[item.estado_revision]}
                            {item.estado_revision === 'en_revision' ? 'En Revision' : 
                             item.estado_revision.charAt(0).toUpperCase() + item.estado_revision.slice(1)}
                        </span>
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-3">
                        <span>Serial: {item.serial || '—'}</span>
                        <span>Cantidad: {item.cantidad}</span>
                        {item.tecnico_nombre && (
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {item.tecnico_nombre}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Asignar tecnico */}
                    {isAdmin && !item.tecnico_id && item.estado_revision === 'pendiente' && (
                        <button
                            onClick={() => setShowAssign(true)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Asignar tecnico"
                        >
                            <UserCheck className="w-4 h-4" />
                        </button>
                    )}

                    {/* Revisar (tecnico) */}
                    {canReview && (
                        <button
                            onClick={onOpenChecklist}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            Revisar
                        </button>
                    )}

                    {/* Ver revision (si ya esta completado) */}
                    {isComplete && (
                        <button
                            onClick={onOpenChecklist}
                            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
                            title="Ver revision"
                        >
                            <CheckCircle className="w-4 h-4" />
                        </button>
                    )}

                    {/* Eliminar */}
                    {canEdit && item.estado_revision === 'pendiente' && (
                        <button
                            onClick={() => onDelete(item.id)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Modal asignar tecnico */}
            {showAssign && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
                        <div className="px-4 sm:px-6 py-4 border-b flex justify-between">
                            <h3 className="text-lg font-semibold">Asignar Tecnico</h3>
                            <button onClick={() => setShowAssign(false)}>✕</button>
                        </div>
                        <div className="p-4 sm:p-6">
                            <select
                                value={selectedTecnico}
                                onChange={(e) => setSelectedTecnico(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                            >
                                <option value="">Seleccionar tecnico...</option>
                                {tecnicos.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.nombre1} {t.apellidos || ''} - {t.usuario}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="px-4 sm:px-6 py-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button onClick={() => setShowAssign(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                            <button onClick={handleAssign} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Asignar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemCard;