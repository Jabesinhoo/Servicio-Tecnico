const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboard.controller');
const { authRequired } = require('../middlewares/auth.middleware');

console.log('authRequired =>', authRequired);

router.use(authRequired);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/recent-activities', dashboardController.getRecentActivities);

module.exports = router;
