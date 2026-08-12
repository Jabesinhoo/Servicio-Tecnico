const { Usuario, Role } = require('../models');
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const userController = require('../controllers/user.controller');

router.use(authenticate);

// ============================================================
// RUTAS PÚBLICAS (para técnicos y usuarios logueados)
// ============================================================

// Obtener usuarios por rol (para selección en formularios)
router.get('/usuarios/role/:roleName', userController.getUsersByRole);

// Obtener usuario actual
router.get('/usuarios/me', async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.user.id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password'] },
    });

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      },
    });
  } catch (error) {
    console.error('Error en GET /usuarios/me:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario actual',
      error: error.message,
    });
  }
});

// Cambiar propia contraseña
router.put('/usuarios/me/password', userController.changePassword);

// ============================================================
// RUTAS CON PERMISOS (requieren permisos específicos)
// ============================================================

// Ver usuarios
router.get('/usuarios', authorize('usuarios_view'), userController.getUsers);

// Ver usuario específico
router.get('/usuarios/:id', authorize('usuarios_view'), userController.getUserById);

// Crear usuario
router.post('/usuarios', authorize('usuarios_create'), userController.createUser);

// Actualizar usuario
router.put('/usuarios/:id', authorize('usuarios_edit'), userController.updateUser);

// Eliminar usuario (soft delete)
router.delete('/usuarios/:id', authorize('usuarios_delete'), userController.deleteUser);

// Asignar rol a usuario
router.put('/usuarios/:id/role', authorize('usuarios_edit'), userController.assignRole);

// Cambiar contraseña de otro usuario (solo admin)
router.put('/usuarios/:id/password', authorize('usuarios_edit'), userController.changePassword);

module.exports = router;