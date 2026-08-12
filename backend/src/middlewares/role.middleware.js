'use strict';

const {
  derivePermissionFromRequest,
} = require('../services/permissionsRegistry');

const isAdmin = (user) => {
  if (!user) {
    return false;
  }

  if (
    typeof user.rol === 'string' &&
    user.rol.toLowerCase() === 'admin'
  ) {
    return true;
  }

  if (
    user.role?.name &&
    String(user.role.name)
      .toLowerCase() === 'admin'
  ) {
    return true;
  }

  return false;
};

function allowRoles(...legacyRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado',
      });
    }

    // ========================================================
    // ADMIN SIEMPRE TIENE ACCESO TOTAL
    // ========================================================

    if (isAdmin(req.user)) {
      return next();
    }

    // ========================================================
    // NUEVO SISTEMA DE PERMISOS
    // ========================================================

    const permissionName =
      derivePermissionFromRequest(req);

    const rolePermissions =
      req.user.role?.permissions || [];

    // Si el usuario ya está asociado al nuevo sistema de roles,
    // usamos exclusivamente sus permisos.
    if (
      req.user.role &&
      permissionName
    ) {
      const hasPermission =
        rolePermissions.some(
          (permission) =>
            permission.active !== false &&
            permission.name ===
              permissionName
        );

      if (hasPermission) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message:
          'No tienes permisos suficientes para realizar esta acción',
        requiredPermission:
          permissionName,
      });
    }

    // ========================================================
    // COMPATIBILIDAD CON ROLES ANTIGUOS
    // ========================================================

    const currentLegacyRole =
      req.user.rol ||
      req.user.role?.name;

    if (
      !currentLegacyRole ||
      !legacyRoles.includes(
        currentLegacyRole
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'Prohibido',
        requiredPermission:
          permissionName,
      });
    }

    return next();
  };
}

module.exports = {
  allowRoles,
};