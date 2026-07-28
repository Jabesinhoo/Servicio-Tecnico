// backend/src/routes/notificaciones.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { Pool } = require('pg');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

router.use(authRequired);

// Obtener notificaciones del usuario
router.get('/notificaciones', async (req, res) => {
    try {
        const usuario_id = req.user.id;
        const { solo_no_leidas } = req.query;
        
        let query = `
            SELECT * FROM notificaciones
            WHERE usuario_id = $1 OR usuario_id IS NULL
        `;
        const params = [usuario_id];
        
        if (solo_no_leidas === 'true') {
            query += ` AND leido = false`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT 50`;
        
        const result = await pgPool.query(query, params);
        
        // Contar no leidas
        const countResult = await pgPool.query(`
            SELECT COUNT(*) as cantidad
            FROM notificaciones
            WHERE (usuario_id = $1 OR usuario_id IS NULL) AND leido = false
        `, [usuario_id]);
        
        res.json({
            success: true,
            data: result.rows,
            no_leidas: parseInt(countResult.rows[0].cantidad)
        });
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener notificaciones',
            error: error.message
        });
    }
});

// Marcar notificacion como leida
router.patch('/notificaciones/:id/leida', async (req, res) => {
    try {
        const { id } = req.params;
        await pgPool.query(`
            UPDATE notificaciones 
            SET leido = true
            WHERE id = $1
        `, [id]);
        res.json({ success: true, message: 'Notificacion marcada como leida' });
    } catch (error) {
        console.error('Error al marcar notificacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al marcar notificacion',
            error: error.message
        });
    }
});

// Marcar todas como leidas
router.patch('/notificaciones/leer-todas', async (req, res) => {
    try {
        const usuario_id = req.user.id;
        await pgPool.query(`
            UPDATE notificaciones 
            SET leido = true
            WHERE usuario_id = $1 AND leido = false
        `, [usuario_id]);
        res.json({ success: true, message: 'Todas las notificaciones marcadas como leidas' });
    } catch (error) {
        console.error('Error al marcar todas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al marcar todas',
            error: error.message
        });
    }
});

// Eliminar notificacion
router.delete('/notificaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pgPool.query(`
            DELETE FROM notificaciones 
            WHERE id = $1
        `, [id]);
        res.json({ success: true, message: 'Notificacion eliminada' });
    } catch (error) {
        console.error('Error al eliminar notificacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar notificacion',
            error: error.message
        });
    }
});

module.exports = router;