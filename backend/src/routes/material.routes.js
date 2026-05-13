// backend/src/routes/material.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const materialController = require('../controllers/material.controller');

router.use(authRequired);

// Materiales por servicio
router.get('/materiales/servicio/:service_order_id', materialController.getMaterialesByServicio);
router.post('/materiales/servicio/:service_order_id/solicitar', allowRoles('tecnico', 'admin'), materialController.solicitarMateriales);
router.put('/materiales/:id/entregar', allowRoles('admin', 'inventario'), materialController.entregarMateriales);
router.put('/materiales/:id/usar', allowRoles('tecnico', 'admin'), materialController.reportarUso);

// Reportes de consumo
router.get('/materiales/consumo-tecnico', allowRoles('admin'), materialController.getConsumoTecnico);

module.exports = router;