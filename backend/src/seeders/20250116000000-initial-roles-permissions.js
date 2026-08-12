// backend/src/database/seeders/XXXXXXXXXXXXXX-permissions.js
'use strict';

const permissions = [
  // Clientes
  { name: 'clientes_view', description: 'Ver clientes', module: 'clientes', action: 'view' },
  { name: 'clientes_create', description: 'Crear clientes', module: 'clientes', action: 'create' },
  { name: 'clientes_edit', description: 'Editar clientes', module: 'clientes', action: 'edit' },
  { name: 'clientes_delete', description: 'Eliminar clientes', module: 'clientes', action: 'delete' },
  
  // Servicios
  { name: 'servicios_view', description: 'Ver servicios', module: 'servicios', action: 'view' },
  { name: 'servicios_create', description: 'Crear servicios', module: 'servicios', action: 'create' },
  { name: 'servicios_edit', description: 'Editar servicios', module: 'servicios', action: 'edit' },
  { name: 'servicios_delete', description: 'Eliminar servicios', module: 'servicios', action: 'delete' },
  { name: 'servicios_assign', description: 'Asignar técnicos a servicios', module: 'servicios', action: 'assign' },
  
  // Inventario
  { name: 'inventario_view', description: 'Ver inventario', module: 'inventario', action: 'view' },
  { name: 'inventario_create', description: 'Crear inventario', module: 'inventario', action: 'create' },
  { name: 'inventario_edit', description: 'Editar inventario', module: 'inventario', action: 'edit' },
  { name: 'inventario_delete', description: 'Eliminar inventario', module: 'inventario', action: 'delete' },
  
  // Alquileres
  { name: 'alquileres_view', description: 'Ver alquileres', module: 'alquileres', action: 'view' },
  { name: 'alquileres_create', description: 'Crear alquileres', module: 'alquileres', action: 'create' },
  { name: 'alquileres_edit', description: 'Editar alquileres', module: 'alquileres', action: 'edit' },
  { name: 'alquileres_delete', description: 'Eliminar alquileres', module: 'alquileres', action: 'delete' },
  { name: 'alquileres_approve', description: 'Aprobar alquileres', module: 'alquileres', action: 'approve' },
  
  // Facturas
  { name: 'facturas_view', description: 'Ver facturas', module: 'facturas', action: 'view' },
  { name: 'facturas_create', description: 'Crear facturas', module: 'facturas', action: 'create' },
  { name: 'facturas_edit', description: 'Editar facturas', module: 'facturas', action: 'edit' },
  { name: 'facturas_delete', description: 'Eliminar facturas', module: 'facturas', action: 'delete' },
  
  // Usuarios
  { name: 'usuarios_view', description: 'Ver usuarios', module: 'usuarios', action: 'view' },
  { name: 'usuarios_create', description: 'Crear usuarios', module: 'usuarios', action: 'create' },
  { name: 'usuarios_edit', description: 'Editar usuarios', module: 'usuarios', action: 'edit' },
  { name: 'usuarios_delete', description: 'Eliminar usuarios', module: 'usuarios', action: 'delete' },
  
  // Reportes
  { name: 'reportes_view', description: 'Ver reportes', module: 'reportes', action: 'view' },
  { name: 'reportes_export', description: 'Exportar reportes', module: 'reportes', action: 'export' },
  
  // Técnicos
  { name: 'tecnicos_view', description: 'Ver técnicos', module: 'tecnicos', action: 'view' },
  { name: 'tecnicos_assign', description: 'Asignar técnicos', module: 'tecnicos', action: 'assign' },
  
  // Agenda
  { name: 'agenda_view', description: 'Ver agenda', module: 'agenda', action: 'view' },
  { name: 'agenda_edit', description: 'Editar agenda', module: 'agenda', action: 'edit' },
  
  // Roles y permisos
  { name: 'roles_view', description: 'Ver roles', module: 'roles', action: 'view' },
  { name: 'roles_create', description: 'Crear roles', module: 'roles', action: 'create' },
  { name: 'roles_edit', description: 'Editar roles', module: 'roles', action: 'edit' },
  { name: 'roles_delete', description: 'Eliminar roles', module: 'roles', action: 'delete' },
];

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('permissions', permissions.map(p => ({
      ...p,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })));
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', null, {});
  },
};