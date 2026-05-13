// backend/src/routes/tipo-servicio.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const tipoServicioController = require('../controllers/tipo-servicio.controller');

router.use(authRequired);

// Rutas públicas (para todos los roles autenticados)
router.get('/tipos-servicio', tipoServicioController.getAll);
router.get('/tipos-servicio/activos', tipoServicioController.getActivos);
router.get('/tipos-servicio/:id', tipoServicioController.getById);

// Rutas solo para admin
router.post('/tipos-servicio', allowRoles('admin'), tipoServicioController.create);
router.put('/tipos-servicio/:id', allowRoles('admin'), tipoServicioController.update);
router.delete('/tipos-servicio/:id', allowRoles('admin'), tipoServicioController.delete);

module.exports = router;