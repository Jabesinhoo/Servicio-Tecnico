// frontend/src/services/alquiler.service.js
import api from './api';

// ============================================================
// SOLICITUDES
// ============================================================

// Crear solicitud de alquiler
export const crearSolicitud = async (data) => {
    const response = await api.post('/api/alquiler/solicitudes', data);
    return response.data;
};

// Obtener solicitudes con filtros
export const getSolicitudes = async (filtros = {}) => {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.cliente_id) params.append('cliente_id', filtros.cliente_id);
    
    const response = await api.get(`/api/alquiler/solicitudes?${params.toString()}`);
    return response.data;
};

// Obtener solicitud por ID
export const getSolicitudById = async (id) => {
    const response = await api.get(`/api/alquiler/solicitudes/${id}`);
    return response.data;
};

// Actualizar estado de solicitud
export const actualizarEstadoSolicitud = async (id, estado, observaciones = '') => {
    const response = await api.patch(`/api/alquiler/solicitudes/${id}/estado`, { estado, observaciones });
    return response.data;
};

// Aprobar documentacion (contabilidad)
export const aprobarDocumentacion = async (id, aprobado, observaciones = '') => {
    const response = await api.patch(`/api/alquiler/solicitudes/${id}/aprobar`, { aprobado, observaciones });
    return response.data;
};

// ============================================================
// ITEMS
// ============================================================

// Agregar item a solicitud
export const agregarItem = async (solicitudId, data) => {
    const response = await api.post(`/api/alquiler/solicitudes/${solicitudId}/items`, data);
    return response.data;
};

// Asignar tecnico a item
export const asignarTecnico = async (itemId, tecnicoId) => {
    const response = await api.patch(`/api/alquiler/items/${itemId}/asignar`, { tecnico_id: tecnicoId });
    return response.data;
};

// ============================================================
// REVISIONES TECNICAS
// ============================================================

// Crear revision tecnica
export const crearRevision = async (itemId, data) => {
    const response = await api.post(`/api/alquiler/items/${itemId}/revision`, data);
    return response.data;
};

// Obtener revisiones de un item
export const getRevisiones = async (itemId) => {
    const response = await api.get(`/api/alquiler/items/${itemId}/revisiones`);
    return response.data;
};

// ============================================================
// DESPACHOS
// ============================================================

// Crear despacho
export const crearDespacho = async (solicitudId, data) => {
    const response = await api.post(`/api/alquiler/solicitudes/${solicitudId}/despacho`, data);
    return response.data;
};

// Completar despacho
export const completarDespacho = async (despachoId, observaciones = '') => {
    const response = await api.patch(`/api/alquiler/despachos/${despachoId}/completar`, { observaciones });
    return response.data;
};

// ============================================================
// DEVOLUCIONES
// ============================================================

// Crear devolucion
export const crearDevolucion = async (solicitudId, data) => {
    const response = await api.post(`/api/alquiler/solicitudes/${solicitudId}/devolucion`, data);
    return response.data;
};

// Completar devolucion
export const completarDevolucion = async (devolucionId, observaciones = '') => {
    const response = await api.patch(`/api/alquiler/devoluciones/${devolucionId}/completar`, { observaciones });
    return response.data;
};

// ============================================================
// NOTIFICACIONES
// ============================================================

// Obtener notificaciones del usuario
export const getNotificaciones = async (soloNoLeidas = false) => {
    const response = await api.get(`/api/alquiler/notificaciones?solo_no_leidas=${soloNoLeidas}`);
    return response.data;
};

// Marcar notificacion como leida
export const marcarNotificacionLeida = async (id) => {
    const response = await api.patch(`/api/alquiler/notificaciones/${id}/leida`);
    return response.data;
};

// Marcar todas como leidas
export const marcarTodasLeidas = async () => {
    const response = await api.patch('/api/alquiler/notificaciones/leer-todas');
    return response.data;
};

// ============================================================
// EXPORTAR PARA INVENTARIO
// ============================================================

export const exportarInventario = async (solicitudId) => {
    const response = await api.get(`/api/alquiler/solicitudes/${solicitudId}/exportar`, {
        responseType: 'blob'
    });
    return response.data;
};