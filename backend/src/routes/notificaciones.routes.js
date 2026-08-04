// backend/src/routes/notificaciones.routes.js
const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const {
    authRequired,
} = require('../middlewares/auth.middleware');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos',
});

router.use(authRequired);

// ============================================================
// OBTENER NOTIFICACIONES
// ============================================================

router.get('/notificaciones', async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const soloNoLeidas =
            req.query.solo_no_leidas === 'true';

        let query = `
            SELECT
                id,
                usuario_id,
                tipo,
                titulo,
                mensaje,
                leido,
                link,
                solicitud_id,
                "createdAt" AS created_at
            FROM notificaciones
            WHERE (
                usuario_id = $1
                OR usuario_id IS NULL
            )
        `;

        if (soloNoLeidas) {
            query += `
                AND leido = false
            `;
        }

        query += `
            ORDER BY "createdAt" DESC
            LIMIT 50
        `;

        const result = await pgPool.query(
            query,
            [usuarioId]
        );

        const countResult = await pgPool.query(
            `
                SELECT COUNT(*) AS cantidad
                FROM notificaciones
                WHERE (
                    usuario_id = $1
                    OR usuario_id IS NULL
                )
                AND leido = false
            `,
            [usuarioId]
        );

        return res.status(200).json({
            success: true,
            data: result.rows,
            no_leidas: Number(
                countResult.rows[0]?.cantidad || 0
            ),
        });
    } catch (error) {
        console.error(
            'Error al obtener notificaciones:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Error al obtener notificaciones',
            error: error.message,
        });
    }
});

// ============================================================
// MARCAR UNA NOTIFICACIÓN COMO LEÍDA
// ============================================================

router.patch(
    '/notificaciones/:id/leida',
    async (req, res) => {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;

            const result = await pgPool.query(
                `
                    UPDATE notificaciones
                    SET leido = true
                    WHERE id = $1
                    AND (
                        usuario_id = $2
                        OR usuario_id IS NULL
                    )
                    RETURNING id
                `,
                [id, usuarioId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Notificación no encontrada',
                });
            }

            return res.status(200).json({
                success: true,
                message:
                    'Notificación marcada como leída',
            });
        } catch (error) {
            console.error(
                'Error al marcar notificación:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Error al marcar notificación',
                error: error.message,
            });
        }
    }
);

// ============================================================
// MARCAR TODAS COMO LEÍDAS
// ============================================================

router.patch(
    '/notificaciones/leer-todas',
    async (req, res) => {
        try {
            const usuarioId = req.user.id;

            const result = await pgPool.query(
                `
                    UPDATE notificaciones
                    SET leido = true
                    WHERE (
                        usuario_id = $1
                        OR usuario_id IS NULL
                    )
                    AND leido = false
                `,
                [usuarioId]
            );

            return res.status(200).json({
                success: true,
                message:
                    'Todas las notificaciones fueron marcadas como leídas',
                actualizadas: result.rowCount,
            });
        } catch (error) {
            console.error(
                'Error al marcar todas:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Error al marcar todas las notificaciones',
                error: error.message,
            });
        }
    }
);

// ============================================================
// ELIMINAR NOTIFICACIÓN
// ============================================================

router.delete(
    '/notificaciones/:id',
    async (req, res) => {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;

            const result = await pgPool.query(
                `
                    DELETE FROM notificaciones
                    WHERE id = $1
                    AND (
                        usuario_id = $2
                        OR usuario_id IS NULL
                    )
                    RETURNING id
                `,
                [id, usuarioId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Notificación no encontrada',
                });
            }

            return res.status(200).json({
                success: true,
                message:
                    'Notificación eliminada',
            });
        } catch (error) {
            console.error(
                'Error al eliminar notificación:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Error al eliminar notificación',
                error: error.message,
            });
        }
    }
);

module.exports = router;
