// backend/src/middlewares/auth.js
'use strict';

const jwt = require('jsonwebtoken');
const { Usuario, Role } = require('../models');

// ============================================================
// UTILIDAD: DETECTAR ADMIN
// ============================================================

const isAdmin = (user) => {
  if (!user) return false;

  // Compatibilidad con el campo antiguo "rol"
  if (
    typeof user.rol === 'string' &&
    user.rol.toLowerCase() === 'admin'
  ) {
    return true;
  }

  // Compatibilidad con el nuevo sistema de roles
  if (
    user.role?.name &&
    String(user.role.name).toLowerCase() === 'admin'
  ) {
    return true;
  }

  return false;
};

// ============================================================
// AUTENTICACIÓN
// ============================================================

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó token de autenticación',
      });
    }

    const [scheme, token] = authHeader.split(' ');

    if (
      scheme !== 'Bearer' ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await Usuario.findByPk(decoded.id, {
      include: [
        {
          model: Role,
          as: 'role',
          include: ['permissions'],
          required: false,
        },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    if (!user.activo) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo',
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }

    console.error('Error en autenticación:', error);

    return res.status(500).json({
      success: false,
      message: 'Error en autenticación',
    });
  }
};

// ============================================================
// AUTORIZACIÓN POR PERMISOS
// ============================================================

const authorize = (...allowedPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      // ========================================================
      // ADMIN TIENE ACCESO TOTAL
      // ========================================================

      if (isAdmin(req.user)) {
        return next();
      }

      // Si la ruta no exige permisos específicos
      if (allowedPermissions.length === 0) {
        return next();
      }

      const userPermissions =
        req.user.role?.permissions || [];

      const hasRequiredPermission =
        allowedPermissions.some(
          (permission) =>
            userPermissions.some(
              (userPermission) =>
                userPermission.name === permission
            )
        );

      if (!hasRequiredPermission) {
        return res.status(403).json({
          success: false,
          message:
            'No tienes permisos suficientes para realizar esta acción',
        });
      }

      return next();
    } catch (error) {
      console.error(
        'Error en autorización:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Error en autorización',
      });
    }
  };
};

// ============================================================
// VERIFICAR UN PERMISO ESPECÍFICO
// ============================================================

const hasPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
        });
      }

      // ========================================================
      // ADMIN TIENE ACCESO TOTAL
      // ========================================================

      if (isAdmin(req.user)) {
        return next();
      }

      // Primero intentar usando los permisos ya cargados
      const userPermissions =
        req.user.role?.permissions || [];

      const permissionFound =
        userPermissions.some(
          (permission) =>
            permission.name === permissionName
        );

      if (permissionFound) {
        return next();
      }

      // Compatibilidad con método definido en Usuario
      if (
        typeof req.user.hasPermission === 'function'
      ) {
        const hasPerm =
          await req.user.hasPermission(
            permissionName
          );

        if (hasPerm) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        message:
          `No tienes permiso para: ${permissionName}`,
      });
    } catch (error) {
      console.error(
        'Error al verificar permiso:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Error al verificar permisos',
      });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  hasPermission,
};