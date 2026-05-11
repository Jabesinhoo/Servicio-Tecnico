// backend/src/routes/client.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const clientController = require('../controllers/client.controller');

// Todas las rutas requieren autenticación
router.use(authRequired);

// Rutas GET
router.get('/clients', clientController.getAll);
router.get('/clients/:id', clientController.getById);
router.get('/clients/:id/stats', clientController.getClientStats);
router.get('/clients/:id/service-orders', clientController.getClientServiceOrders);

// Rutas POST, PUT, DELETE
router.post('/clients', clientController.create);
router.put('/clients/:id', clientController.update);
router.delete('/clients/:id', clientController.delete);

module.exports = router;