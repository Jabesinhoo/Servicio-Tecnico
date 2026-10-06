// frontend/src/components/ui/NotificacionesCampana.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
    Bell, 
    CheckCheck, 
    X, 
    Trash2, 
    Clock, 
    Circle,
    FileText,
    CheckCircle,
    Package,
    Wrench,
    Undo2,
    AlertTriangle,
    Settings
} from 'lucide-react';
import { useNotificacionesGlobal } from '../../context/NotificacionesContext';

const NotificacionesCampana = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [assignmentNotice, setAssignmentNotice] = useState(null);
    const seenRef = useRef(null);
    const sessionRef = useRef(null);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const { notificaciones, noLeidas, marcarComoLeida, marcarTodasLeidas, eliminarNotificacion, refrescar, initialized } = useNotificacionesGlobal();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            refrescar();
        }
    }, [isOpen]);

    const handleNotificacionClick = async (id, link, leido) => {
        if (!leido) {
            await marcarComoLeida(id);
        }
        if (link) {
            window.location.href = link;
        }
        setIsOpen(false);
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (sessionRef.current !== token) {
            sessionRef.current = token;
            seenRef.current = null;
            setAssignmentNotice(null);
        }
        if (!token || !initialized) return;
        const ids = new Set(notificaciones.map(item => item.id));
        const fresh = notificaciones.find(item => item.service_order_id && !item.leido && (!seenRef.current || !seenRef.current.has(item.id)));
        if (fresh) setAssignmentNotice(fresh);
        seenRef.current = ids;
    }, [notificaciones, initialized]);

    useEffect(() => {
        if (!assignmentNotice) return undefined;
        const timer = window.setTimeout(() => setAssignmentNotice(null), 10000);
        return () => window.clearTimeout(timer);
    }, [assignmentNotice]);

    const getIconByTipo = (tipo) => {
        const icons = {
            solicitud: FileText,
            aprobacion: CheckCircle,
            despacho: Package,
            revision: Wrench,
            devolucion: Undo2,
            estado: Settings,
            alerta: AlertTriangle,
        };
        const Icon = icons[tipo] || Bell;
        return Icon;
    };

    const getColorByTipo = (tipo) => {
        const colors = {
            solicitud: 'accent-soft accent-text dark:accent-soft dark:accent-text',
            aprobacion: 'accent-soft accent-text dark:accent-soft dark:accent-text',
            despacho: 'accent-soft accent-text dark:accent-soft dark:accent-text',
            revision: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            devolucion: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
            alerta: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        };
        return colors[tipo] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    };

    const formatFecha = (fecha) => {
        const diff = Date.now() - new Date(fecha).getTime();
        const minutos = Math.floor(diff / 60000);
        const horas = Math.floor(diff / 3600000);
        const dias = Math.floor(diff / 86400000);

        if (minutos < 1) return 'Ahora';
        if (minutos < 60) return `${minutos}m`;
        if (horas < 24) return `${horas}h`;
        if (dias < 7) return `${dias}d`;
        return new Date(fecha).toLocaleDateString('es-CO');
    };

    return (
        <div className="relative inline-block">
            {assignmentNotice && <div role="status" aria-live="polite" className="fixed top-20 right-3 sm:right-6 z-[200] w-[calc(100vw-24px)] sm:w-96 rounded-2xl border accent-border dark:accent-border bg-white dark:bg-gray-900 shadow-xl p-4">
                <div className="flex items-start gap-3">
                    <Wrench className="w-5 h-5 accent-text shrink-0" />
                    <button type="button" onClick={() => handleNotificacionClick(assignmentNotice.id, assignmentNotice.link, assignmentNotice.leido)} className="flex-1 text-left">
                        <p className="font-bold text-sm">{assignmentNotice.titulo}</p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{assignmentNotice.mensaje}</p>
                        <p className="mt-2 text-xs font-semibold accent-text">Abrir Mis servicios</p>
                    </button>
                    <button type="button" aria-label="Cerrar aviso" onClick={() => setAssignmentNotice(null)}><X className="w-4 h-4" /></button>
                </div>
            </div>}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:accent-ring"
                aria-label="Notificaciones"
            >
                <Bell className={`w-5 h-5 transition-colors ${noLeidas > 0 ? 'accent-text dark:accent-text' : 'text-gray-600 dark:text-gray-400'}`} />
                {noLeidas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-red-500/25">
                        {noLeidas > 99 ? '99+' : noLeidas}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div 
                        className="workflow-theme fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    <div 
                        ref={dropdownRef}
                        className="notifications-dropdown fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-[65px] md:top-auto md:mt-2 w-[calc(100%-2rem)] md:w-[420px] max-w-[420px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-50 max-h-[80vh] overflow-hidden backdrop-blur-sm"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-xl ${noLeidas > 0 ? 'accent-soft dark:accent-soft' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                    <Bell className={`w-4 h-4 ${noLeidas > 0 ? 'accent-text dark:accent-text' : 'text-gray-500'}`} />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Notificaciones
                                </h3>
                                {noLeidas > 0 && (
                                    <span className="text-[10px] font-medium bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-0.5 rounded-full">
                                        {noLeidas} nuevas
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {noLeidas > 0 && (
                                    <button
                                        onClick={marcarTodasLeidas}
                                        className="text-xs accent-text hover:accent-text dark:accent-text dark:hover:accent-text px-2.5 py-1 rounded-lg hover:accent-soft dark:hover:accent-soft transition-colors flex items-center gap-1"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                        <span className="hidden xs:inline">Marcar todas</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="overflow-y-auto max-h-[calc(80vh-130px)] divide-y divide-gray-100/50 dark:divide-gray-800/50">
                            {notificaciones.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                        <Bell className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium">No hay notificaciones</p>
                                    <p className="text-xs opacity-60 mt-1">Todas las notificaciones apareceran aqui</p>
                                </div>
                            ) : (
                                notificaciones.map((notif) => {
                                    const Icon = getIconByTipo(notif.tipo);
                                    return (
                                        <div
                                            key={notif.id}
                                            className={`group relative px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 cursor-pointer transition-all duration-150 ${
                                                !notif.leido ? 'accent-soft dark:accent-soft border-l-4 accent-border' : ''
                                            }`}
                                            onClick={() => handleNotificacionClick(notif.id, notif.link, notif.leido)}
                                        >
                                            <div className="flex items-start gap-3.5">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getColorByTipo(notif.tipo)}`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm ${!notif.leido ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                                                            {notif.titulo}
                                                        </p>
                                                        {!notif.leido && (
                                                            <Circle className="w-2 h-2 fill-blue-500 accent-text flex-shrink-0 mt-1.5" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                                                        {notif.mensaje}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <Clock className="w-3 h-3 text-gray-400" />
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            {formatFecha(notif.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        eliminarNotificacion(notif.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-2.5 border-t border-gray-200/50 dark:border-gray-700/50 text-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky bottom-0">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium transition-colors"
                            >
                                Ver todas las notificaciones →
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificacionesCampana;