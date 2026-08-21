// backend/src/routes/user.routes.js
const { Usuario, Role } = require('../models');
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const userController = require('../controllers/user.controller');
const userLocationController = require('../controllers/user-location.controller');

// Todas las rutas requieren autenticación.
router.use(authenticate);

// ============================================================
// RUTAS PARA USUARIOS AUTENTICADOS
// ============================================================

// Obtener usuarios por rol (para selección en formularios).
router.get(
  '/usuarios/role/:roleName',
  userController.getUsersByRole
);

// Obtener usuario actual.
router.get('/usuarios/me', async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: 'role',
          include: ['permissions'],
        },
      ],
      attributes: {
        exclude: ['password', 'two_factor_secret'],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    return res.json({
      success: true,
      data: {
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      },
    });
  } catch (error) {
    console.error('Error en GET /usuarios/me:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuario actual',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
});

// Cambiar la propia contraseña: exige contraseña actual.
router.put(
  '/usuarios/me/password',
  userController.changeOwnPassword
);

// Compartir la propia ubicación de alta precisión.
// El navegador siempre solicita permiso explícito al usuario.
router.post(
  '/usuarios/me/location',
  userLocationController.updateOwnLocation
);

// ============================================================
// RUTAS CON PERMISOS
// ============================================================

// Ver usuarios.
router.get(
  '/usuarios',
  authorize('usuarios_view'),
  userController.getUsers
);

// Ficha administrativa e historial de accesos (solo admin en controlador).
router.get(
  '/usuarios/:id/activity',
  authorize('usuarios_view'),
  userController.getUserActivity
);

// Ubicación actual e historial: permiso de lectura + validación admin en controlador.
router.get(
  '/usuarios/:id/location',
  authorize('usuarios_view'),
  userLocationController.getUserCurrentLocation
);

router.get(
  '/usuarios/:id/location/history',
  authorize('usuarios_view'),
  userLocationController.getUserLocationHistory
);

// Ver usuario específico.
router.get(
  '/usuarios/:id',
  authorize('usuarios_view'),
  userController.getUserById
);

// Crear usuario.
router.post(
  '/usuarios',
  authorize('usuarios_create'),
  userController.createUser
);

// Actualizar usuario.
router.put(
  '/usuarios/:id',
  authorize('usuarios_edit'),
  userController.updateUser
);

// Eliminar usuario (soft delete).
router.delete(
  '/usuarios/:id',
  authorize('usuarios_delete'),
  userController.deleteUser
);

// Asignar rol a usuario.
router.put(
  '/usuarios/:id/role',
  authorize('usuarios_edit'),
  userController.assignRole
);

// Restablecer contraseña de un usuario.
// El middleware exige permiso de edición y el controlador vuelve a
// validar que la cuenta autenticada tenga realmente el rol admin.
router.put(
  '/usuarios/:id/password',
  authorize('usuarios_edit'),
  userController.resetPasswordByAdmin
);

module.exports = router;
