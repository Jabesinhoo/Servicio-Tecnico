'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            CREATE EXTENSION IF NOT EXISTS pg_trgm;
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS
                idx_sync_clientes_documento_trgm
            ON sync_clientes
            USING gin (
                LOWER(
                    COALESCE(documento, '')
                ) gin_trgm_ops
            );
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS
                idx_sync_clientes_razon_social_trgm
            ON sync_clientes
            USING gin (
                LOWER(
                    COALESCE(razon_social, '')
                ) gin_trgm_ops
            );
        `);

        await queryInterface.sequelize.query(`
            CREATE INDEX IF NOT EXISTS
                idx_sync_clientes_nombre_trgm
            ON sync_clientes
            USING gin (
                (
                    LOWER(
                        COALESCE(primer_nombre, '')
                        || ' '
                        || COALESCE(segundo_nombre, '')
                        || ' '
                        || COALESCE(primer_apellido, '')
                        || ' '
                        || COALESCE(segundo_apellido, '')
                    )
                ) gin_trgm_ops
            );
        `);

        await queryInterface.addIndex(
            'sync_clientes',
            ['activo'],
            {
                name:
                    'idx_sync_clientes_activo',
            }
        );

        await queryInterface.addIndex(
            'sync_clientes',
            ['fecha_sincronizacion'],
            {
                name:
                    'idx_sync_clientes_fecha_sync',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'sync_clientes',
            'idx_sync_clientes_fecha_sync'
        );

        await queryInterface.removeIndex(
            'sync_clientes',
            'idx_sync_clientes_activo'
        );

        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS
                idx_sync_clientes_nombre_trgm;
        `);

        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS
                idx_sync_clientes_razon_social_trgm;
        `);

        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS
                idx_sync_clientes_documento_trgm;
        `);
    },
};