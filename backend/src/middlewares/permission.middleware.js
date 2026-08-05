const {
    QueryTypes,
} = require('sequelize');

const sequelize =
    require('../config/database');

const CACHE_TTL_MS = Number(
    process.env.PERMISSIONS_CACHE_TTL_MS || 60000
);

const permissionsCache = new Map();

const getUserId = (req) =>
    req.user?.id ||
    req.user?.userId ||
    req.user?.usuario_id ||
    null;

const loadUserPermissions = async (usuarioId) => {
    const cached =
        permissionsCache.get(usuarioId);

    if (
        cached &&
        cached.expiresAt > Date.now()
    ) {
        return cached.permissions;
    }

    const rows = await sequelize.query(
        `
            SELECT DISTINCT
                p.nombre
            FROM usuarios_roles ur
            INNER JOIN roles r
                ON r.id = ur.rol_id
                AND r.activo = true
            INNER JOIN roles_permisos rp
                ON rp.rol_id = r.id
            INNER JOIN permisos p
                ON p.id = rp.permiso_id
                AND p.activo = true
            WHERE ur.usuario_id = :usuarioId
        `,
        {
            replacements: {
                usuarioId,
            },
            type: QueryTypes.SELECT,
        }
    );

    const permissions = new Set(
        rows.map((row) => row.nombre)
    );

    permissionsCache.set(usuarioId, {
        permissions,
        expiresAt:
            Date.now() + CACHE_TTL_MS,
    });

    return permissions;
};

const requirePermission = (...requiredPermissions) => {
    return async (req, res, next) => {
        try {
            const usuarioId =
                getUserId(req);

            if (!usuarioId) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Usuario no autenticado.',
                });
            }

            const userPermissions =
                await loadUserPermissions(
                    usuarioId
                );

            const missingPermissions =
                requiredPermissions.filter(
                    (permission) =>
                        !userPermissions.has(permission)
                );

            if (missingPermissions.length > 0) {
                return res.status(403).json({
                    success: false,
                    message:
                        'No tienes permiso para realizar esta acción.',
                    required:
                        requiredPermissions,
                    missing:
                        missingPermissions,
                });
            }

            req.permissions =
                Array.from(userPermissions);

            return next();
        } catch (error) {
            console.error(
                'Error verificando permisos:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Error al verificar permisos.',
            });
        }
    };
};

const requireAnyPermission = (...permissions) => {
    return async (req, res, next) => {
        try {
            const usuarioId =
                getUserId(req);

            if (!usuarioId) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Usuario no autenticado.',
                });
            }

            const userPermissions =
                await loadUserPermissions(
                    usuarioId
                );

            const allowed =
                permissions.some(
                    (permission) =>
                        userPermissions.has(permission)
                );

            if (!allowed) {
                return res.status(403).json({
                    success: false,
                    message:
                        'No tienes ninguno de los permisos requeridos.',
                    requiredAny: permissions,
                });
            }

            req.permissions =
                Array.from(userPermissions);

            return next();
        } catch (error) {
            console.error(
                'Error verificando permisos:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Error al verificar permisos.',
            });
        }
    };
};

const invalidateUserPermissions = (
    usuarioId
) => {
    permissionsCache.delete(usuarioId);
};

const clearPermissionsCache = () => {
    permissionsCache.clear();
};

module.exports = {
    requirePermission,
    requireAnyPermission,
    loadUserPermissions,
    invalidateUserPermissions,
    clearPermissionsCache,
};