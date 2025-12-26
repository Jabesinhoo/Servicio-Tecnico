const pool = require('../db/pool');

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.rol;

        let stats = {
            totalVentas: 0,
            totalServicios: 0,
            serviciosPendientes: 0,
            stockBajo: 0,
        };

        // Estadísticas según el rol
        switch (userRole) {
            case 'admin':
                // Obtener todas las estadísticas
                const [
                    ventasResult,
                    serviciosResult,
                    pendientesResult,
                    stockResult
                ] = await Promise.all([
                    pool.query('SELECT COUNT(*) FROM sales_orders WHERE estado = $1', ['confirmada']),
                    pool.query('SELECT COUNT(*) FROM service_orders'),
                    pool.query('SELECT COUNT(*) FROM service_orders WHERE estado IN ($1, $2)', ['pendiente', 'asignada']),
                    pool.query('SELECT COUNT(*) FROM products WHERE stock_actual <= stock_minimo')
                ]);
                
                stats.totalVentas = parseInt(ventasResult.rows[0].count);
                stats.totalServicios = parseInt(serviciosResult.rows[0].count);
                stats.serviciosPendientes = parseInt(pendientesResult.rows[0].count);
                stats.stockBajo = parseInt(stockResult.rows[0].count);
                break;

            case 'ventas':
                // Estadísticas para vendedor
                const ventasVendedor = await pool.query(
                    'SELECT COUNT(*) FROM sales_orders WHERE vendedor_id = $1 AND estado = $2',
                    [userId, 'confirmada']
                );
                stats.totalVentas = parseInt(ventasVendedor.rows[0].count);
                break;

            case 'tecnico':
                // Estadísticas para técnico
                const serviciosTecnico = await pool.query(
                    'SELECT COUNT(*) FROM service_orders WHERE tecnico_id = $1',
                    [userId]
                );
                const pendientesTecnico = await pool.query(
                    'SELECT COUNT(*) FROM service_orders WHERE tecnico_id = $1 AND estado IN ($2, $3)',
                    [userId, 'asignada', 'en_ejecucion']
                );
                stats.totalServicios = parseInt(serviciosTecnico.rows[0].count);
                stats.serviciosPendientes = parseInt(pendientesTecnico.rows[0].count);
                break;

            case 'inventario':
                // Estadísticas para inventario
                const stockBajo = await pool.query(
                    'SELECT COUNT(*) FROM products WHERE stock_actual <= stock_minimo'
                );
                stats.stockBajo = parseInt(stockBajo.rows[0].count);
                break;
        }

        res.json(stats);
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.getRecentActivities = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.rol;

        let activities = [];

        // Actividades recientes según el rol
        switch (userRole) {
            case 'admin':
                // Últimas ventas
                const ventas = await pool.query(
                    `SELECT s.id, s.numero_ov, s.fecha_creacion, c.nombre_razon_social 
                     FROM sales_orders s 
                     JOIN clients c ON s.client_id = c.id 
                     ORDER BY s.fecha_creacion DESC LIMIT 5`
                );
                
                activities = ventas.rows.map(v => ({
                    title: `Venta #${v.numero_ov}`,
                    description: `Cliente: ${v.nombre_razon_social}`,
                    time: new Date(v.fecha_creacion).toLocaleString(),
                    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
                }));
                break;

            case 'tecnico':
                // Últimos servicios del técnico
                const servicios = await pool.query(
                    `SELECT s.codigo_os, s.descripcion_inicial, s.estado, s.fecha_creacion 
                     FROM service_orders s 
                     WHERE s.tecnico_id = $1 
                     ORDER BY s.fecha_creacion DESC LIMIT 5`,
                    [userId]
                );
                
                activities = servicios.rows.map(s => ({
                    title: `Servicio ${s.codigo_os}`,
                    description: s.descripcion_inicial.substring(0, 50) + '...',
                    time: new Date(s.fecha_creacion).toLocaleString(),
                    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                }));
                break;
        }

        res.json(activities);
    } catch (error) {
        console.error('Error getting recent activities:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};