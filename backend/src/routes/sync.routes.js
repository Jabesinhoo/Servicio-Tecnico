// backend/src/routes/sync.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const syncController = require('../controllers/sync.controller');

// Todas las rutas requieren autenticación y rol admin
router.use(authRequired);
router.use(allowRoles('admin'));

// Ejecutar sincronización manual
router.post('/run', syncController.runSync);

// Obtener estado de la última sincronización
router.get('/status', syncController.getStatus);

// Obtener logs de sincronización
router.get('/logs', syncController.getLogs);

// Obtener estadísticas de datos sincronizados
router.get('/stats', syncController.getStats);

// Buscar en datos sincronizados
router.get('/search', syncController.search);

// Exportar datos sincronizados
router.get('/export/:tabla', syncController.exportData);
router.get('/clientes/buscar', syncController.buscarClientes);

module.exports = router;