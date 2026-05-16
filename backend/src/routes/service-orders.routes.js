// backend/src/routes/service-orders.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const serviceOrderController = require('../controllers/service-order.controller');

router.use(authRequired);

router.get('/service-orders', serviceOrderController.list);

router.get('/service-orders/:id', serviceOrderController.getById);

router.post('/service-orders', serviceOrderController.create);

router.put('/service-orders/:id', serviceOrderController.update);

router.patch('/service-orders/:id/status', serviceOrderController.changeStatus);

router.patch('/service-orders/:id/assign', allowRoles('admin'), serviceOrderController.assignTech);

router.post('/service-orders/:id/parts', serviceOrderController.addPart);

router.delete('/service-orders/:id', allowRoles('admin'), serviceOrderController.delete);

router.patch('/service-orders/:id/approve', allowRoles('admin'), serviceOrderController.approve);
router.patch('/service-orders/:id/reject', allowRoles('admin'), serviceOrderController.reject);
router.put('/service-orders/:id', allowRoles('admin', 'tecnico'), serviceOrderController.update);
module.exports = router;