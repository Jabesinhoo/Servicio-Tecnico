const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener estadísticas del dashboard
router.get('/stats', dashboardController.getDashboardStats);

// Obtener actividades recientes
router.get('/recent-activities', dashboardController.getRecentActivities);

module.exports = router;