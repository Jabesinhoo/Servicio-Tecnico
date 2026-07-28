// backend/src/routes/producto-serial.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const productoSerialController = require('../controllers/producto-serial.controller');

router.use(authRequired);

// Obtener todos los productos sincronizados
router.get('/productos-sync', productoSerialController.getProductos);

// Buscar productos
router.get('/productos-sync/search', productoSerialController.searchProductos);

// Obtener producto por codigo
router.get('/productos-sync/:codigo', productoSerialController.getProductoByCodigo);

// Seriales
router.get('/productos-sync/:productoId/seriales', productoSerialController.getSeriales);

// Crear serial
router.post('/productos-sync/seriales', allowRoles('admin', 'inventario'), productoSerialController.crearSerial);

// Buscar serial
router.get('/seriales/:serial', productoSerialController.buscarSerial);

// Cambiar estado de serial
router.patch('/seriales/:serialId/estado', allowRoles('admin', 'inventario', 'tecnico'), productoSerialController.cambiarEstado);

// Obtener historial de serial
router.get('/seriales/:serialId/historial', productoSerialController.getHistorial);

module.exports = router;