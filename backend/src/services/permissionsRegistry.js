'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// UTILIDADES
// ============================================================

const normalize = (value = '') =>
  String(value)
    .trim()
    .replace(/-/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();

const humanize = (value = '') => {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const ACTION_LABELS = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  assign: 'Asignar',
  approve: 'Aprobar',
  reject: 'Rechazar',
  export: 'Exportar',
  exportar: 'Exportar',
  completar: 'Completar',
  entregar: 'Entregar',
  usar: 'Usar',
  solicitar: 'Solicitar',
  revision: 'Revisar',
  revisar: 'Revisar',
  estado: 'Cambiar estado',
  aprobar: 'Aprobar',
  asignar: 'Asignar',
  despacho: 'Despachar',
  devolucion: 'Gestionar devolución',
};

const SPECIAL_ACTIONS = new Set([
  'assign',
  'approve',
  'reject',
  'export',
  'exportar',
  'completar',
  'entregar',
  'usar',
  'solicitar',
  'revision',
  'revisar',
  'estado',
  'aprobar',
  'asignar',
  'despacho',
  'devolucion',
]);

// ============================================================
// CREAR DEFINICIÓN DESDE NOMBRE EXPLÍCITO
// Ejemplo: usuarios_edit
// ============================================================

const fromExplicitPermission = (permissionName) => {
  const name = normalize(permissionName);

  const parts = name.split('_').filter(Boolean);

  if (parts.length < 2) {
    return {
      name,
      module: name,
      action: 'access',
      description: `Acceso a ${humanize(name)}`,
    };
  }

  const action = parts.pop();
  const module = parts.join('_');

  const actionLabel =
    ACTION_LABELS[action] || humanize(action);

  return {
    name,
    module,
    action: action.substring(0, 20),
    description: `${actionLabel} ${humanize(module)}`,
  };
};

// ============================================================
// GENERAR PERMISO DESDE UNA RUTA
// ============================================================

const derivePermissionFromRoute = (method, routePath) => {
  const httpMethod = String(method || '').toUpperCase();

  const segments = String(routePath || '')
    .split('/')
    .filter(Boolean)
    .filter((segment) => !segment.startsWith(':'))
    .map(normalize)
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const module = segments[0];
  const rest = segments.slice(1);

  let action;
  let name;

  // ==========================================================
  // GET
  // ==========================================================

  if (httpMethod === 'GET') {
    action = 'view';

    if (rest.length === 0) {
      name = `${module}_view`;
    } else {
      name = `${module}_${rest.join('_')}_view`;
    }
  }

  // ==========================================================
  // POST
  // ==========================================================

  else if (httpMethod === 'POST') {
    const last = rest[rest.length - 1];

    if (last && SPECIAL_ACTIONS.has(last)) {
      action = last;
      name = `${module}_${rest.join('_')}`;
    } else {
      action = 'create';

      name =
        rest.length > 0
          ? `${module}_${rest.join('_')}_create`
          : `${module}_create`;
    }
  }

  // ==========================================================
  // PUT / PATCH
  // ==========================================================

  else if (
    httpMethod === 'PUT' ||
    httpMethod === 'PATCH'
  ) {
    const last = rest[rest.length - 1];

    if (last && SPECIAL_ACTIONS.has(last)) {
      action = last;
      name = `${module}_${rest.join('_')}`;
    } else {
      action = 'edit';

      name =
        rest.length > 0
          ? `${module}_${rest.join('_')}_edit`
          : `${module}_edit`;
    }
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  else if (httpMethod === 'DELETE') {
    action = 'delete';

    name =
      rest.length > 0
        ? `${module}_${rest.join('_')}_delete`
        : `${module}_delete`;
  } else {
    return null;
  }

  name = normalize(name);

  const actionLabel =
    ACTION_LABELS[action] || humanize(action);

  let description;

  if (rest.length > 0) {
    const resource = humanize(
      [module, ...rest].join('_')
    );

    description = `${actionLabel}: ${resource}`;
  } else {
    description =
      `${actionLabel} ${humanize(module)}`;
  }

  return {
    name,
    module,
    action: normalize(action).substring(0, 20),
    description,
  };
};

// ============================================================
// DERIVAR PERMISO DESDE REQUEST DE EXPRESS
// Usado por allowRoles para migración automática.
// ============================================================

const derivePermissionFromRequest = (req) => {
  if (!req || !req.route) {
    return null;
  }

  const routePath = req.route.path;

  if (typeof routePath !== 'string') {
    return null;
  }

  const permission = derivePermissionFromRoute(
    req.method,
    routePath
  );

  return permission?.name || null;
};

// ============================================================
// DESCUBRIR PERMISOS EN src/routes
// ============================================================

const discoverPermissionsFromRoutes = () => {
  const routesDir = path.join(
    __dirname,
    '..',
    'routes'
  );

  const permissions = new Map();

  if (!fs.existsSync(routesDir)) {
    console.warn(
      '⚠️ No existe directorio de rutas:',
      routesDir
    );

    return [];
  }

  const files = fs
    .readdirSync(routesDir)
    .filter((file) => file.endsWith('.js'));

  for (const file of files) {
    // auth.routes.js no forma parte de permisos administrativos.
    if (file === 'auth.routes.js') {
      continue;
    }

    const fullPath = path.join(routesDir, file);

    const content = fs.readFileSync(
      fullPath,
      'utf8'
    );

    // ========================================================
    // 1. PERMISOS EXPLÍCITOS authorize(...)
    // ========================================================

    const authorizeRegex =
      /authorize\s*\(([\s\S]*?)\)/g;

    let authorizeMatch;

    while (
      (authorizeMatch =
        authorizeRegex.exec(content)) !== null
    ) {
      const args = authorizeMatch[1];

      const stringRegex =
        /['"`]([^'"`]+)['"`]/g;

      let stringMatch;

      while (
        (stringMatch =
          stringRegex.exec(args)) !== null
      ) {
        const permission =
          fromExplicitPermission(
            stringMatch[1]
          );

        if (permission.name) {
          permissions.set(
            permission.name,
            permission
          );
        }
      }
    }

    // ========================================================
    // 2. RUTAS allowRoles(...)
    // ========================================================

    const hasGlobalAllowRoles =
      /router\.use\s*\(\s*allowRoles\s*\(/.test(
        content
      );

    const routeRegex =
      /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

    const routeMatches = [
      ...content.matchAll(routeRegex),
    ];

    for (
      let i = 0;
      i < routeMatches.length;
      i += 1
    ) {
      const current = routeMatches[i];

      const next = routeMatches[i + 1];

      const start = current.index;

      const end = next
        ? next.index
        : content.length;

      const routeBlock =
        content.substring(start, end);

      const usesAllowRoles =
        hasGlobalAllowRoles ||
        routeBlock.includes('allowRoles(');

      if (!usesAllowRoles) {
        continue;
      }

      const method = current[1];
      const routePath = current[2];

      const permission =
        derivePermissionFromRoute(
          method,
          routePath
        );

      if (
        permission &&
        permission.name
      ) {
        permissions.set(
          permission.name,
          permission
        );
      }
    }
  }

  return Array.from(
    permissions.values()
  ).sort((a, b) => {
    if (a.module !== b.module) {
      return a.module.localeCompare(
        b.module
      );
    }

    return a.name.localeCompare(b.name);
  });
};

// ============================================================
// SINCRONIZAR CON POSTGRESQL
// ============================================================

const syncPermissionsToDatabase = async () => {
  const { Permission } =
    require('../models');

  if (!Permission) {
    throw new Error(
      'El modelo Permission no está cargado'
    );
  }

  const discovered =
    discoverPermissionsFromRoutes();

  let created = 0;
  let updated = 0;

  for (const permission of discovered) {
    const existing =
      await Permission.findOne({
        where: {
          name: permission.name,
        },
      });

    if (!existing) {
      await Permission.create({
        name: permission.name,
        description:
          permission.description,
        module: permission.module,
        action: permission.action,
        active: true,
      });

      created += 1;
      continue;
    }

    const needsUpdate =
      existing.description !==
        permission.description ||
      existing.module !==
        permission.module ||
      existing.action !==
        permission.action ||
      existing.active !== true;

    if (needsUpdate) {
      await existing.update({
        description:
          permission.description,
        module: permission.module,
        action: permission.action,
        active: true,
      });

      updated += 1;
    }
  }

  console.log(
    `🔐 Permisos sincronizados: ${discovered.length} encontrados | ${created} creados | ${updated} actualizados`
  );

  return discovered;
};

module.exports = {
  discoverPermissionsFromRoutes,
  syncPermissionsToDatabase,
  derivePermissionFromRoute,
  derivePermissionFromRequest,
};