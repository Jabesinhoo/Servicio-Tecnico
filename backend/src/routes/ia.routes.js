// backend/src/routes/ia.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const iaController = require('../controllers/ia.controller');

router.use(authRequired);

router.get('/ia/estado', iaController.estado);
router.post('/ia/chat', iaController.chat);
router.get('/ia/alertas', iaController.getAlertas);

module.exports = router;