// backend/src/routes/service-orders.routes.js
'use strict';

const express = require('express');

const router = express.Router();

const {
  authRequired,
} = require('../middlewares/auth.middleware');

const {
  allowRoles,
} = require('../middlewares/role.middleware');

const serviceOrderController =
  require('../controllers/service-order.controller');

const serviceAuthorizationController =
  require('../controllers/service-authorization.controller');

const serviceIntakeController =
  require('../controllers/service-intake.controller');

const serviceTeamController =
  require('../controllers/service-team.controller');

const serviceScheduleController =
  require('../controllers/service-schedule.controller');

const technicalStatsController =
  require('../controllers/technical-stats.controller');

const {
  blockResumeWhileClientAuthorization,
} = require('../middlewares/service-authorization-guard.middleware');

router.use(authRequired);

// ============================================================
// V9 · SOLICITUD / CLASIFICACIÓN / ACTIVACIÓN DE SERVICIO
// Deben ir antes de /service-orders/:id
// ============================================================

router.get(
  '/service-orders/intakes',
  allowRoles('admin', 'tecnico'),
  serviceIntakeController.list
);

router.get(
  '/service-orders/intakes/:intakeId',
  allowRoles('admin', 'tecnico'),
  serviceIntakeController.getById
);

router.post(
  '/service-orders/intakes',
  allowRoles('admin', 'tecnico'),
  serviceIntakeController.create
);

router.put(
  '/service-orders/intakes/:intakeId',
  allowRoles('admin', 'tecnico'),
  serviceIntakeController.update
);

router.put(
  '/service-orders/intakes/:intakeId/team',
  allowRoles('admin'),
  serviceIntakeController.updateTeam
);

router.post(
  '/service-orders/intakes/:intakeId/verify-payment',
  allowRoles('admin'),
  serviceIntakeController.verifyPayment
);

router.post(
  '/service-orders/intakes/:intakeId/activate',
  allowRoles('admin'),
  serviceIntakeController.activate
);

router.post(
  '/service-orders/intakes/:intakeId/cancel',
  allowRoles('admin', 'tecnico'),
  serviceIntakeController.cancel
);

// ============================================================
// V11 · AGENDA AUTOMÁTICA / ESTADÍSTICAS
// ============================================================

router.get(
  '/service-orders/stats/technical',
  allowRoles('admin'),
  technicalStatsController.getTechnicalStatistics
);

router.post(
  '/service-orders/:id/auto-schedule',
  allowRoles('admin'),
  serviceScheduleController.autoSchedule
);

// ============================================================
// V10 · EQUIPO TÉCNICO / BITÁCORA DE INTERVENCIÓN
// ============================================================

router.get(
  '/service-orders/:id/team',
  allowRoles('admin', 'tecnico'),
  serviceTeamController.getTeam
);

router.put(
  '/service-orders/:id/team',
  allowRoles('admin'),
  serviceTeamController.updateTeam
);

router.get(
  '/service-orders/:id/work-logs',
  allowRoles('admin', 'tecnico'),
  serviceTeamController.getWorkLogs
);

router.post(
  '/service-orders/:id/work-logs',
  allowRoles('tecnico'),
  serviceTeamController.addWorkLog
);

// ============================================================
// P2 · FLUJO DEL TÉCNICO
// IMPORTANTE: estas rutas deben ir antes de "/:id"
// ============================================================

router.get(
  '/service-orders/my-work',
  allowRoles('tecnico'),
  serviceOrderController.myWork
);

router.get(
  '/service-orders/work-board',
  allowRoles('admin'),
  serviceOrderController.adminWorkBoard
);

router.get(
  '/service-orders/work-board/technicians',
  allowRoles('admin'),
  serviceOrderController.workBoardTechnicians
);

router.get(
  '/service-orders/work-board/technicians/:technicianId/devices',
  allowRoles('admin'),
  serviceOrderController.getTechnicianLocationDevices
);

router.post(
  '/service-orders/work-board/technicians/:technicianId/devices/:deviceId/approve',
  allowRoles('admin'),
  serviceOrderController.approveTechnicianLocationDevice
);

router.post(
  '/service-orders/work-board/technicians/:technicianId/devices/:deviceId/revoke',
  allowRoles('admin'),
  serviceOrderController.revokeTechnicianLocationDevice
);

router.get(
  '/service-orders/:id/geofence',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getServiceGeofence
);

router.put(
  '/service-orders/:id/geofence',
  allowRoles('admin'),
  serviceOrderController.setServiceGeofence
);

router.post(
  '/service-orders/:id/visit/en-route',
  allowRoles('tecnico'),
  serviceOrderController.markEnRoute
);

router.post(
  '/service-orders/:id/visit/arrived',
  allowRoles('tecnico'),
  serviceOrderController.markArrived
);

router.post(
  '/service-orders/:id/assignment/accept',
  allowRoles('tecnico'),
  serviceOrderController.acceptAssignment
);

router.post(
  '/service-orders/:id/assignment/impediment',
  allowRoles('tecnico'),
  serviceOrderController.reportAssignmentImpediment
);

router.post(
  '/service-orders/:id/custody/take',
  allowRoles('tecnico'),
  serviceOrderController.takeCustody
);

router.get(
  '/service-orders/:id/reception-checklist',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getReceptionChecklist
);

router.put(
  '/service-orders/:id/reception-checklist',
  allowRoles('tecnico'),
  serviceOrderController.saveReceptionChecklist
);

router.post(
  '/service-orders/:id/reception-checklist/confirm',
  allowRoles('tecnico'),
  serviceOrderController.confirmReceptionChecklist
);


// ============================================================
// V7 · EVIDENCIAS / ACTA DE RECIBO / DIAGNÓSTICO
// ============================================================

router.get(
  '/service-orders/:id/evidences',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getServiceEvidences
);

router.post(
  '/service-orders/:id/evidences',
  allowRoles('tecnico'),
  serviceOrderController.uploadServiceEvidence
);

router.get(
  '/service-orders/:id/evidences/:evidenceId/file',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getServiceEvidenceFile
);

router.delete(
  '/service-orders/:id/evidences/:evidenceId',
  allowRoles('tecnico'),
  serviceOrderController.deleteServiceEvidence
);

router.get(
  '/service-orders/:id/reception-act',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getReceptionAct
);

router.post(
  '/service-orders/:id/reception-act/sign',
  allowRoles('tecnico'),
  serviceOrderController.signReceptionAct
);

router.get(
  '/service-orders/:id/reception-act/signature',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getReceptionActSignature
);

router.get(
  '/service-orders/:id/diagnosis',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.getServiceDiagnosis
);

router.put(
  '/service-orders/:id/diagnosis',
  allowRoles('tecnico'),
  serviceOrderController.saveServiceDiagnosis
);

router.post(
  '/service-orders/:id/diagnosis/confirm',
  allowRoles('tecnico'),
  serviceOrderController.confirmServiceDiagnosis
);

// ============================================================
// V8 · AUTORIZACIONES DEL CLIENTE
// ============================================================

router.get(
  '/service-orders/authorizations/overview',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.overview
);

router.get(
  '/service-orders/:id/authorizations',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.list
);

router.post(
  '/service-orders/:id/authorizations',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.create
);

router.post(
  '/service-orders/:id/authorizations/:authorizationId/evidences',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.uploadEvidence
);

router.get(
  '/service-orders/:id/authorizations/:authorizationId/evidences/:evidenceId/file',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.getEvidenceFile
);

router.post(
  '/service-orders/:id/authorizations/:authorizationId/decision',
  allowRoles('admin'),
  serviceAuthorizationController.decide
);

router.post(
  '/service-orders/:id/authorizations/:authorizationId/cancel',
  allowRoles('admin', 'tecnico'),
  serviceAuthorizationController.cancel
);

// ============================================================
// CONSULTA / CREACIÓN
// ============================================================

router.get(
  '/service-orders',
  serviceOrderController.list
);

router.get(
  '/service-orders/:id',
  serviceOrderController.getById
);

router.post(
  '/service-orders',
  serviceOrderController.create
);

// ============================================================
// LIFECYCLE
// ============================================================

router.patch(
  '/service-orders/:id/status',
  allowRoles('admin', 'tecnico'),
  blockResumeWhileClientAuthorization,
  serviceOrderController.changeStatus
);

router.patch(
  '/service-orders/:id/assign',
  allowRoles('admin'),
  serviceTeamController.assignPrimary
);

router.patch(
  '/service-orders/:id/approve',
  allowRoles('admin'),
  serviceTeamController.approveAndAssign
);

router.patch(
  '/service-orders/:id/reject',
  allowRoles('admin'),
  serviceOrderController.reject
);

// ============================================================
// DIAGNÓSTICO / REPUESTOS / CANCELACIÓN
// ============================================================

router.put(
  '/service-orders/:id',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.update
);

router.post(
  '/service-orders/:id/parts',
  allowRoles('admin', 'tecnico'),
  serviceOrderController.addPart
);

router.delete(
  '/service-orders/:id',
  allowRoles('admin'),
  serviceOrderController.delete
);

module.exports = router;
