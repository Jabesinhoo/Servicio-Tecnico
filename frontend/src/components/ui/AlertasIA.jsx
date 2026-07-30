// frontend/src/components/ui/AlertasIA.jsx
import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Calendar, ClipboardList, X, Loader2 } from 'lucide-react';
import api from '../../services/api';

const AlertasIA = () => {
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPanel, setShowPanel] = useState(false);

    useEffect(() => {
        if (showPanel) {
            cargarAlertas();
        }
    }, [showPanel]);

    const cargarAlertas = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/ia/alertas');
            setAlertas(res.data.data || []);
        } catch (error) {
            console.error('Error cargando alertas:', error);
        } finally {
            setLoading(false);
        }
    };

    const getIcono = (tipo) => {
        const icons = {
            pendientes: <ClipboardList className="w-5 h-5" />,
            hoy: <Calendar className="w-5 h-5" />,
            vencimiento: <AlertTriangle className="w-5 h-5" />,
            resumen: <Bell className="w-5 h-5" />,
        };
        return icons[tipo] || <Bell className="w-5 h-5" />;
    };

    const getColor = (prioridad) => {
        const colors = {
            alta: 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10',
            media: 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10',
            baja: 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10',
        };
        return colors[prioridad] || colors.baja;
    };

    const totalAlertas = alertas.filter(a => a.prioridad === 'alta' || a.prioridad === 'media').length;

    return (
        <>
            {/* Botón de alertas */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                title="Alertas del sistema"
                style={{ color: 'var(--text-muted)' }}
            >
                <Bell className="w-5 h-5" />
                {totalAlertas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                        {totalAlertas > 9 ? '9+' : totalAlertas}
                    </span>
                )}
            </button>

            {/* Panel de alertas */}
            {showPanel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Bell className="w-5 h-5 text-blue-600" />
                                Alertas del Sistema
                                {totalAlertas > 0 && (
                                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                        {totalAlertas} nuevas
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={() => setShowPanel(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loading ? (
                                <div className="text-center py-8 text-gray-500 flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Cargando alertas...
                                </div>
                            ) : alertas.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium">Todo en orden</p>
                                    <p className="text-sm opacity-60">No hay alertas pendientes</p>
                                </div>
                            ) : (
                                alertas.map((alerta, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-xl ${getColor(alerta.prioridad)} border border-gray-200 dark:border-gray-700`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 text-gray-600 dark:text-gray-400">
                                                {getIcono(alerta.tipo)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {alerta.titulo}
                                                </h4>
                                                <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                                                    {alerta.mensaje}
                                                </pre>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                alerta.prioridad === 'alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                alerta.prioridad === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                                {alerta.prioridad}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-center flex-shrink-0">
                            <button
                                onClick={() => setShowPanel(false)}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AlertasIA;