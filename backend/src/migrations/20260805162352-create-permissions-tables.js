'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction =
            await queryInterface.sequelize.transaction();

        try {
            // ==================================================
            // ROLES
            // ==================================================

            await queryInterface.createTable(
                'roles',
                {
                    id: {
                        type: Sequelize.UUID,
                        defaultValue: Sequelize.literal(
                            'gen_random_uuid()'
                        ),
                        primaryKey: true,
                        allowNull: false,
                    },

                    nombre: {
                        type: Sequelize.STRING(80),
                        allowNull: false,
                        unique: true,
                    },

                    descripcion: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },

                    activo: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },

                    es_sistema: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    },

                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },

                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },
                },
                { transaction }
            );

            // ==================================================
            // PERMISOS
            // ==================================================

            await queryInterface.createTable(
                'permisos',
                {
                    id: {
                        type: Sequelize.UUID,
                        defaultValue: Sequelize.literal(
                            'gen_random_uuid()'
                        ),
                        primaryKey: true,
                        allowNull: false,
                    },

                    nombre: {
                        type: Sequelize.STRING(120),
                        allowNull: false,
                        unique: true,
                    },

                    descripcion: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },

                    modulo: {
                        type: Sequelize.STRING(60),
                        allowNull: false,
                    },

                    accion: {
                        type: Sequelize.STRING(60),
                        allowNull: false,
                    },

                    activo: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },

                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },

                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },
                },
                { transaction }
            );

            // ==================================================
            // ROLES <-> PERMISOS
            // ==================================================

            await queryInterface.createTable(
                'roles_permisos',
                {
                    rol_id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,

                        references: {
                            model: 'roles',
                            key: 'id',
                        },

                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },

                    permiso_id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,

                        references: {
                            model: 'permisos',
                            key: 'id',
                        },

                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },

                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },
                },
                { transaction }
            );

            // ==================================================
            // USUARIOS <-> ROLES
            // ==================================================

            await queryInterface.createTable(
                'usuarios_roles',
                {
                    usuario_id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,

                        references: {
                            model: 'usuarios',
                            key: 'id',
                        },

                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },

                    rol_id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,

                        references: {
                            model: 'roles',
                            key: 'id',
                        },

                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },

                    asignado_por: {
                        type: Sequelize.UUID,
                        allowNull: true,

                        references: {
                            model: 'usuarios',
                            key: 'id',
                        },

                        onUpdate: 'CASCADE',
                        onDelete: 'SET NULL',
                    },

                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.fn('NOW'),
                    },
                },
                { transaction }
            );

            // ==================================================
            // ÍNDICES
            // ==================================================

            await queryInterface.addIndex(
                'roles',
                ['activo'],
                {
                    name: 'idx_roles_activo',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'permisos',
                ['modulo', 'accion'],
                {
                    name: 'idx_permisos_modulo_accion',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'permisos',
                ['activo'],
                {
                    name: 'idx_permisos_activo',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'roles_permisos',
                ['permiso_id'],
                {
                    name: 'idx_roles_permisos_permiso',
                    transaction,
                }
            );

            await queryInterface.addIndex(
                'usuarios_roles',
                ['rol_id'],
                {
                    name: 'idx_usuarios_roles_rol',
                    transaction,
                }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const transaction =
            await queryInterface.sequelize.transaction();

        try {
            await queryInterface.dropTable(
                'usuarios_roles',
                { transaction }
            );

            await queryInterface.dropTable(
                'roles_permisos',
                { transaction }
            );

            await queryInterface.dropTable(
                'permisos',
                { transaction }
            );

            await queryInterface.dropTable(
                'roles',
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};