const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authRequired } = require('../middlewares/auth.middleware');

router.use(authRequired);

const operations=require('../controllers/operations-dashboard.controller');
router.get('/operations',operations.get);
router.get('/operations/excel',operations.export);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/recent-sales', dashboardController.getRecentSales);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/chart-data', dashboardController.getChartData);

module.exports = router;