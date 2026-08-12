// backend/src/routes/roles.js
'use strict';

const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middlewares/auth');
const rolesController = require('../controllers/roles');

// Todas las rutas requieren autenticación
router.use(authenticate);

// ============================================================
// PERMISOS
// IMPORTANTE: esta ruta debe ir antes de "/:id"
// ============================================================

router.get(
  '/permissions/all',
  authorize('roles_view'),
  rolesController.getAllPermissionsGrouped
);

// ============================================================
// ROLES
// ============================================================

router.get(
  '/',
  authorize('roles_view', 'roles_create', 'roles_edit'),
  rolesController.getAllRoles
);

router.get(
  '/:id',
  authorize('roles_view'),
  rolesController.getRoleById
);

router.post(
  '/',
  authorize('roles_create'),
  rolesController.createRole
);

router.put(
  '/:id',
  authorize('roles_edit'),
  rolesController.updateRole
);

router.delete(
  '/:id',
  authorize('roles_delete'),
  rolesController.deleteRole
);

module.exports = router;