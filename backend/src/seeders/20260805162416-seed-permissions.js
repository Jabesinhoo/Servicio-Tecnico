'use strict';

const crypto = require('crypto');

const roles = [
    {
        nombre: 'admin',
        descripcion: 'Administrador general del sistema',
        es_sistema: true,
    },
    {
        nombre: 'tecnico',
        descripcion: 'Personal técnico',
        es_sistema: true,
    },
    {
        nombre: 'ventas',
        descripcion: 'Personal comercial y de ventas',
        es_sistema: true,
    },
    {
        nombre: 'inventario',
        descripcion: 'Personal de inventario y bodega',
        es_sistema: true,
    },
    {
        nombre: 'facturacion',
        descripcion: 'Personal de facturación',
        es_sistema: true,
    },
    {
        nombre: 'cartera',
        descripcion: 'Personal de cartera',
        es_sistema: true,
    },
    {
        nombre: 'garantias',
        descripcion: 'Personal de garantías',
        es_sistema: true,
    },
    {
        nombre: 'usuario',
        descripcion: 'Usuario sin permisos iniciales',
        es_sistema: true,
    },
];

const permisos = [
    // Clientes
    ['clientes:view', 'clientes', 'view', 'Ver clientes'],
    ['clientes:create', 'clientes', 'create', 'Crear clientes'],
    ['clientes:edit', 'clientes', 'edit', 'Editar clientes'],
    ['clientes:delete', 'clientes', 'delete', 'Eliminar clientes'],

    // Servicios
    ['servicios:view', 'servicios', 'view', 'Ver servicios'],
    ['servicios:create', 'servicios', 'create', 'Crear servicios'],
    ['servicios:edit', 'servicios', 'edit', 'Editar servicios'],
    ['servicios:delete', 'servicios', 'delete', 'Eliminar servicios'],
    ['servicios:assign', 'servicios', 'assign', 'Asignar técnicos'],

    // Inventario
    ['inventario:view', 'inventario', 'view', 'Ver inventario'],
    ['inventario:create', 'inventario', 'create', 'Crear productos'],
    ['inventario:edit', 'inventario', 'edit', 'Editar inventario'],
    ['inventario:delete', 'inventario', 'delete', 'Eliminar productos'],

    // Alquileres
    ['alquileres:view', 'alquileres', 'view', 'Ver alquileres'],
    ['alquileres:create', 'alquileres', 'create', 'Crear alquileres'],
    ['alquileres:edit', 'alquileres', 'edit', 'Editar alquileres'],
    ['alquileres:delete', 'alquileres', 'delete', 'Eliminar alquileres'],
    ['alquileres:approve', 'alquileres', 'approve', 'Aprobar alquileres'],
    ['alquileres:dispatch', 'alquileres', 'dispatch', 'Despachar alquileres'],
    ['alquileres:review', 'alquileres', 'review', 'Revisar alquileres'],
    ['alquileres:return', 'alquileres', 'return', 'Recibir devoluciones'],

    // Facturación
    ['facturas:view', 'facturas', 'view', 'Ver facturas'],
    ['facturas:create', 'facturas', 'create', 'Crear facturas'],
    ['facturas:edit', 'facturas', 'edit', 'Editar facturas'],
    ['facturas:delete', 'facturas', 'delete', 'Eliminar facturas'],
    ['facturas:void', 'facturas', 'void', 'Anular facturas'],

    // Usuarios
    ['usuarios:view', 'usuarios', 'view', 'Ver usuarios'],
    ['usuarios:create', 'usuarios', 'create', 'Crear usuarios'],
    ['usuarios:edit', 'usuarios', 'edit', 'Editar usuarios'],
    ['usuarios:delete', 'usuarios', 'delete', 'Eliminar usuarios'],

    // Roles
    ['roles:view', 'roles', 'view', 'Ver roles y permisos'],
    ['roles:create', 'roles', 'create', 'Crear roles'],
    ['roles:edit', 'roles', 'edit', 'Editar roles'],
    ['roles:delete', 'roles', 'delete', 'Eliminar roles'],
    ['roles:assign', 'roles', 'assign', 'Asignar roles a usuarios'],

    // Reportes
    ['reportes:view', 'reportes', 'view', 'Ver reportes'],
    ['reportes:export', 'reportes', 'export', 'Exportar reportes'],

    // Técnicos
    ['tecnicos:view', 'tecnicos', 'view', 'Ver técnicos'],
    ['tecnicos:edit', 'tecnicos', 'edit', 'Editar técnicos'],
    ['tecnicos:assign', 'tecnicos', 'assign', 'Asignar técnicos'],

    // Agenda
    ['agenda:view', 'agenda', 'view', 'Ver agenda'],
    ['agenda:edit', 'agenda', 'edit', 'Editar agenda'],

    // Garantías
    ['garantias:view', 'garantias', 'view', 'Ver garantías'],
    ['garantias:manage', 'garantias', 'manage', 'Gestionar garantías'],

    // Cartera
    ['cartera:view', 'cartera', 'view', 'Ver cartera'],
    ['cartera:manage', 'cartera', 'manage', 'Gestionar cartera'],

    // Sincronización
    ['sincronizacion:view', 'sincronizacion', 'view', 'Ver sincronización'],
    ['sincronizacion:execute', 'sincronizacion', 'execute', 'Ejecutar sincronización'],

    // IA
    ['ia:use', 'ia', 'use', 'Utilizar el asistente de IA'],

    // Auditoría
    ['auditoria:view', 'auditoria', 'view', 'Ver auditoría del sistema'],
];

const permisosPorRol = {
    admin: permisos.map(([nombre]) => nombre),

    tecnico: [
        'servicios:view',
        'servicios:edit',
        'clientes:view',
        'inventario:view',
        'tecnicos:view',
        'agenda:view',
        'agenda:edit',
        'ia:use',
    ],

    ventas: [
        'servicios:view',
        'servicios:create',
        'servicios:edit',
        'clientes:view',
        'clientes:create',
        'clientes:edit',
        'alquileres:view',
        'alquileres:create',
        'reportes:view',
        'agenda:view',
        'ia:use',
    ],

    inventario: [
        'servicios:view',
        'clientes:view',
        'inventario:view',
        'inventario:create',
        'inventario:edit',
        'reportes:view',
        'agenda:view',
    ],

    facturacion: [
        'clientes:view',
        'facturas:view',
        'facturas:create',
        'facturas:edit',
        'facturas:void',
        'reportes:view',
        'reportes:export',
        'agenda:view',
    ],

    cartera: [
        'clientes:view',
        'cartera:view',
        'cartera:manage',
        'reportes:view',
        'reportes:export',
        'agenda:view',
    ],

    garantias: [
        'servicios:view',
        'clientes:view',
        'garantias:view',
        'garantias:manage',
        'reportes:view',
        'agenda:view',
    ],

    usuario: [],
};

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const transaction = await sequelize.transaction();

        try {
            for (const rol of roles) {
                await sequelize.query(
                    `
                        INSERT INTO roles (
                            id,
                            nombre,
                            descripcion,
                            activo,
                            es_sistema,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :id,
                            :nombre,
                            :descripcion,
                            true,
                            :esSistema,
                            NOW(),
                            NOW()
                        )
                        ON CONFLICT (nombre)
                        DO UPDATE SET
                            descripcion = EXCLUDED.descripcion,
                            activo = true,
                            es_sistema = EXCLUDED.es_sistema,
                            updated_at = NOW()
                    `,
                    {
                        replacements: {
                            id: crypto.randomUUID(),
                            nombre: rol.nombre,
                            descripcion: rol.descripcion,
                            esSistema: rol.es_sistema,
                        },
                        transaction,
                    }
                );
            }

            for (const [
                nombre,
                modulo,
                accion,
                descripcion,
            ] of permisos) {
                await sequelize.query(
                    `
                        INSERT INTO permisos (
                            id,
                            nombre,
                            modulo,
                            accion,
                            descripcion,
                            activo,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :id,
                            :nombre,
                            :modulo,
                            :accion,
                            :descripcion,
                            true,
                            NOW(),
                            NOW()
                        )
                        ON CONFLICT (nombre)
                        DO UPDATE SET
                            modulo = EXCLUDED.modulo,
                            accion = EXCLUDED.accion,
                            descripcion = EXCLUDED.descripcion,
                            activo = true,
                            updated_at = NOW()
                    `,
                    {
                        replacements: {
                            id: crypto.randomUUID(),
                            nombre,
                            modulo,
                            accion,
                            descripcion,
                        },
                        transaction,
                    }
                );
            }

            for (
                const [rolNombre, listaPermisos]
                of Object.entries(permisosPorRol)
            ) {
                for (const permisoNombre of listaPermisos) {
                    await sequelize.query(
                        `
                            INSERT INTO roles_permisos (
                                rol_id,
                                permiso_id,
                                created_at
                            )
                            SELECT
                                r.id,
                                p.id,
                                NOW()
                            FROM roles r
                            INNER JOIN permisos p
                                ON p.nombre = :permisoNombre
                            WHERE r.nombre = :rolNombre
                            ON CONFLICT (
                                rol_id,
                                permiso_id
                            )
                            DO NOTHING
                        `,
                        {
                            replacements: {
                                rolNombre,
                                permisoNombre,
                            },
                            transaction,
                        }
                    );
                }
            }

            /*
             * Migra los roles antiguos de usuarios existentes.
             * Los usuarios nuevos no recibirán rol automáticamente.
             */
            await sequelize.query(
                `
                    INSERT INTO usuarios_roles (
                        usuario_id,
                        rol_id,
                        created_at
                    )
                    SELECT
                        u.id,
                        r.id,
                        NOW()
                    FROM usuarios u
                    INNER JOIN roles r
                        ON r.nombre = LOWER(TRIM(u.rol))
                    WHERE u.rol IS NOT NULL
                    ON CONFLICT (
                        usuario_id,
                        rol_id
                    )
                    DO NOTHING
                `,
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const nombresPermisos =
            permisos.map(([nombre]) => nombre);

        const nombresRoles =
            roles.map((rol) => rol.nombre);

        await queryInterface.bulkDelete(
            'roles_permisos',
            null,
            {}
        );

        await queryInterface.bulkDelete(
            'usuarios_roles',
            null,
            {}
        );

        await queryInterface.bulkDelete(
            'permisos',
            {
                nombre: nombresPermisos,
            },
            {}
        );

        await queryInterface.bulkDelete(
            'roles',
            {
                nombre: nombresRoles,
            },
            {}
        );
    },
};