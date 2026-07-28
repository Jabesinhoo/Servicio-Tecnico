// backend/src/routes/alquiler.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const alquilerController = require('../controllers/alquiler.controller');

router.use(authRequired);

// ============================================================
// SOLICITUDES
// ============================================================

// Crear solicitud (vendedor)
router.post('/alquiler/solicitudes', allowRoles('admin', 'ventas'), alquilerController.crearSolicitud);

// Listar solicitudes (todos)
router.get('/alquiler/solicitudes', alquilerController.getSolicitudes);

// Obtener solicitud por ID
router.get('/alquiler/solicitudes/:id', alquilerController.getSolicitudById);

// Actualizar estado de solicitud (admin)
router.patch('/alquiler/solicitudes/:id/estado', allowRoles('admin'), alquilerController.actualizarEstado);

// Aprobar documentacion (contabilidad)
router.patch('/alquiler/solicitudes/:id/aprobar', allowRoles('admin', 'facturacion'), alquilerController.aprobarDocumentacion);

// ============================================================
// ITEMS
// ============================================================

// Agregar item a solicitud (vendedor)
router.post('/alquiler/solicitudes/:solicitud_id/items', allowRoles('admin', 'ventas'), alquilerController.agregarItem);

// Asignar tecnico a item (admin, coordinador ST)
router.patch('/alquiler/items/:item_id/asignar', allowRoles('admin', 'tecnico'), alquilerController.asignarTecnico);

// ============================================================
// REVISIONES TECNICAS
// ============================================================

// Crear revision tecnica (tecnico)
router.post('/alquiler/items/:item_id/revision', allowRoles('admin', 'tecnico'), alquilerController.crearRevision);

// Obtener revisiones de un item
router.get('/alquiler/items/:item_id/revisiones', alquilerController.getRevisiones);

// ============================================================
// DESPACHOS DE BODEGA
// ============================================================

// Crear despacho (bodega)
router.post('/alquiler/solicitudes/:solicitud_id/despacho', allowRoles('admin', 'inventario'), alquilerController.crearDespacho);

// Completar despacho (bodega)
router.patch('/alquiler/despachos/:id/completar', allowRoles('admin', 'inventario'), alquilerController.completarDespacho);

// ============================================================
// DEVOLUCIONES
// ============================================================

// Crear devolucion (vendedor)
router.post('/alquiler/solicitudes/:solicitud_id/devolucion', allowRoles('admin', 'ventas'), alquilerController.crearDevolucion);

// Completar devolucion (tecnico)
router.patch('/alquiler/devoluciones/:id/completar', allowRoles('admin', 'tecnico'), alquilerController.completarDevolucion);

// ============================================================
// NOTIFICACIONES
// ============================================================

// Obtener notificaciones del usuario
router.get('/alquiler/notificaciones', alquilerController.getNotificaciones);

// Marcar notificacion como leida
router.patch('/alquiler/notificaciones/:id/leida', alquilerController.marcarNotificacionLeida);

// Marcar todas como leidas
router.patch('/alquiler/notificaciones/leer-todas', alquilerController.marcarTodasLeidas);

// ============================================================
// EXPORTAR PARA INVENTARIO
// ============================================================

router.get('/alquiler/solicitudes/:solicitud_id/exportar', allowRoles('admin', 'inventario'), alquilerController.exportarInventario);

module.exports = router;