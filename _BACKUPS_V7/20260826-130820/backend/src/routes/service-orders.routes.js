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

router.use(authRequired);

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
  serviceOrderController.changeStatus
);

router.patch(
  '/service-orders/:id/assign',
  allowRoles('admin'),
  serviceOrderController.assignTech
);

router.patch(
  '/service-orders/:id/approve',
  allowRoles('admin'),
  serviceOrderController.approve
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
