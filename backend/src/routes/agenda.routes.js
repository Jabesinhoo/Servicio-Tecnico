// backend/src/routes/agenda.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const agendaController = require('../controllers/agenda.controller');

router.use(authRequired);

// Horarios de técnicos
router.get('/agenda/horario/:tecnico_id', agendaController.getHorarioTecnico);
router.put('/agenda/horario/:tecnico_id', allowRoles('admin'), agendaController.setHorarioTecnico);

// Eventos y disponibilidad
router.get('/agenda/eventos', agendaController.getEventos);
router.get('/agenda/disponibilidad', agendaController.getDisponibilidad);
router.put('/agenda/servicio/:id', allowRoles('admin'), agendaController.agendarServicio);

module.exports = router;