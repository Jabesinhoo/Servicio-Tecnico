// backend/src/controllers/dashboard.controller.js
const pool = require('../db/pool');

// Estadísticas existentes
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    let stats = {
      totalVentas: 0,
      totalServicios: 0,
      serviciosPendientes: 0,
      serviciosEnEjecucion: 0,
      serviciosCompletados: 0,
      stockBajo: 0,
      productosTotales: 0,
      clientesActivos: 0,
      tecnicosActivos: 0,
      ingresosMes: 0,
      ingresosTotales: 0,
    };

    // Consultas según el rol
    if (userRole === "admin") {
      const [
        ventasResult,
        serviciosResult,
        pendientesResult,
        ejecucionResult,
        completadosResult,
        stockResult,
        productosResult,
        clientesResult,
        tecnicosResult,
      ] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM sales_orders WHERE estado = 'confirmada'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders`),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'pendiente'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'en_ejecucion'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'cerrada'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE stock_actual <= stock_minimo`),
        pool.query(`SELECT COUNT(*)::int AS count FROM products`),
        pool.query(`SELECT COUNT(*)::int AS count FROM clients`),
        pool.query(`SELECT COUNT(*)::int AS count FROM usuarios WHERE rol = 'tecnico'`),
      ]);

      stats.totalVentas = ventasResult.rows[0]?.count || 0;
      stats.totalServicios = serviciosResult.rows[0]?.count || 0;
      stats.serviciosPendientes = pendientesResult.rows[0]?.count || 0;
      stats.serviciosEnEjecucion = ejecucionResult.rows[0]?.count || 0;
      stats.serviciosCompletados = completadosResult.rows[0]?.count || 0;
      stats.stockBajo = stockResult.rows[0]?.count || 0;
      stats.productosTotales = productosResult.rows[0]?.count || 0;
      stats.clientesActivos = clientesResult.rows[0]?.count || 0;
      stats.tecnicosActivos = tecnicosResult.rows[0]?.count || 0;
    } else if (userRole === "tecnico") {
      const [serviciosTecnico, pendientesTecnico, ejecucionTecnico, completadosTecnico] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE tecnico_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE tecnico_id = $1 AND estado = 'pendiente'`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE tecnico_id = $1 AND estado = 'en_ejecucion'`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE tecnico_id = $1 AND estado = 'cerrada'`, [userId]),
      ]);

      stats.totalServicios = serviciosTecnico.rows[0]?.count || 0;
      stats.serviciosPendientes = pendientesTecnico.rows[0]?.count || 0;
      stats.serviciosEnEjecucion = ejecucionTecnico.rows[0]?.count || 0;
      stats.serviciosCompletados = completadosTecnico.rows[0]?.count || 0;
    }

    res.json(stats);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Actividad reciente (corregido)
exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    let activities = [];

    if (userRole === "admin") {
      // Obtener servicios recientes
      const servicios = await pool.query(`
        SELECT s.id, s.codigo_os, s.estado, s.descripcion_inicial, s."createdAt", 
               c.razon_social as cliente_nombre
        FROM service_orders s 
        LEFT JOIN clients c ON s.client_id = c.id 
        ORDER BY s."createdAt" DESC 
        LIMIT 10
      `);

      activities = servicios.rows.map((s) => ({
        title: `Servicio ${s.codigo_os}`,
        description: s.descripcion_inicial || "Sin descripción",
        time: new Date(s.createdAt).toLocaleString(),
        user: s.cliente_nombre || "Cliente",
      }));
    } else if (userRole === "tecnico") {
      const servicios = await pool.query(`
        SELECT s.codigo_os, s.descripcion_inicial, s.estado, s."createdAt", 
               c.razon_social as cliente_nombre
        FROM service_orders s 
        LEFT JOIN clients c ON s.client_id = c.id 
        WHERE s.tecnico_id = $1 
        ORDER BY s."createdAt" DESC 
        LIMIT 10
      `, [userId]);

      activities = servicios.rows.map((s) => ({
        title: `Servicio ${s.codigo_os}`,
        description: s.descripcion_inicial || "Sin descripción",
        time: new Date(s.createdAt).toLocaleString(),
        user: s.cliente_nombre || "Cliente",
      }));
    }

    res.json(activities);
  } catch (error) {
    console.error("Error getting recent activities:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Órdenes recientes
exports.getRecentSales = async (req, res) => {
  try {
    const query = `
      SELECT so.id, so.numero_ov, so.estado, so.total_general as total,
             COALESCE(c.razon_social, c.primer_nombre || ' ' || c.primer_apellido) as cliente_nombre
      FROM sales_orders so
      LEFT JOIN clients c ON so.client_id = c.id
      ORDER BY so."createdAt" DESC
      LIMIT 10
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting recent sales:", error);
    res.json([]);
  }
};

// Productos más vendidos
exports.getTopProducts = async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.nombre, COALESCE(SUM(soi.cantidad), 0) as cantidad
      FROM products p
      LEFT JOIN sales_order_items soi ON p.id = soi.product_id
      GROUP BY p.id, p.nombre
      ORDER BY cantidad DESC
      LIMIT 5
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting top products:", error);
    res.json([]);
  }
};

// Datos para gráficos
exports.getChartData = async (req, res) => {
  try {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const resultado = {
      labels: [],
      ventas: [],
      servicios: [],
    };

    // Ventas por mes (últimos 6 meses)
    const salesQuery = `
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as mes,
        COUNT(*) as cantidad
      FROM sales_orders
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
        AND estado = 'confirmada'
      GROUP BY mes
      ORDER BY mes DESC
    `;
    const salesResult = await pool.query(salesQuery);
    
    // Servicios por mes (últimos 6 meses)
    const servicesQuery = `
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as mes,
        COUNT(*) as cantidad
      FROM service_orders
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY mes
      ORDER BY mes DESC
    `;
    const servicesResult = await pool.query(servicesQuery);

    // Crear arrays con los últimos 6 meses
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const mes = new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth() + 1;
      resultado.labels.push(meses[mes - 1]);
      
      const venta = salesResult.rows.find(r => parseInt(r.mes) === mes);
      resultado.ventas.push(venta ? parseInt(venta.cantidad) : 0);
      
      const servicio = servicesResult.rows.find(r => parseInt(r.mes) === mes);
      resultado.servicios.push(servicio ? parseInt(servicio.cantidad) : 0);
    }

    res.json(resultado);
  } catch (error) {
    console.error("Error getting chart data:", error);
    res.json({ labels: [], ventas: [], servicios: [] });
  }
};