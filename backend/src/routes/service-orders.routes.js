// backend/src/routes/service-orders.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const serviceOrderController = require('../controllers/service-order.controller');

router.use(authRequired);

// Listar órdenes de servicio
router.get('/service-orders', serviceOrderController.list);

// Obtener una OS por ID
router.get('/service-orders/:id', serviceOrderController.getById);

// Crear nueva OS
router.post('/service-orders', serviceOrderController.create);

// Actualizar OS
router.put('/service-orders/:id', serviceOrderController.update);

// Cambiar estado de OS
router.patch('/service-orders/:id/status', serviceOrderController.changeStatus);

// Asignar técnico a OS
router.patch('/service-orders/:id/assign', allowRoles('admin'), serviceOrderController.assignTech);

// Agregar repuesto usado
router.post('/service-orders/:id/parts', serviceOrderController.addPart);

// Eliminar OS
router.delete('/service-orders/:id', allowRoles('admin'), serviceOrderController.delete);
// backend/src/routes/service-orders.routes.js
// Agregar estas rutas
router.patch('/service-orders/:id/approve', allowRoles('admin'), serviceOrderController.approve);
router.patch('/service-orders/:id/reject', allowRoles('admin'), serviceOrderController.reject);
router.put('/service-orders/:id', allowRoles('admin', 'tecnico'), serviceOrderController.update);
module.exports = router;