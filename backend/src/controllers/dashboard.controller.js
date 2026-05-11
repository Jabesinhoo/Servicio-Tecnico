// backend/src/controllers/dashboard.controller.js
const pool = require("../db/pool");

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
      // Trends (vs mes anterior)
      trendVentas: 0,
      trendServicios: 0,
      trendIngresos: 0,
    };

    if (userRole === "admin") {
      // Ventas totales
      const ventasResult = await pool.query(`SELECT COUNT(*)::int AS count FROM sales_orders WHERE estado = 'confirmada'`);
      stats.totalVentas = ventasResult.rows[0]?.count || 0;

      // Ventas mes actual vs mes anterior
      const ventasTrend = await pool.query(`
        SELECT 
          COUNT(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW()) THEN 1 END) as mes_actual,
          COUNT(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW() - INTERVAL '1 month') THEN 1 END) as mes_anterior
        FROM sales_orders 
        WHERE estado = 'confirmada' AND "createdAt" >= NOW() - INTERVAL '2 months'
      `);
      const actual = parseInt(ventasTrend.rows[0]?.mes_actual || 0);
      const anterior = parseInt(ventasTrend.rows[0]?.mes_anterior || 0);
      stats.trendVentas = anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : actual > 0 ? 100 : 0;

      // Servicios
      const serviciosResult = await pool.query(`SELECT COUNT(*)::int AS count FROM service_orders`);
      stats.totalServicios = serviciosResult.rows[0]?.count || 0;

      const serviciosTrend = await pool.query(`
        SELECT 
          COUNT(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW()) THEN 1 END) as mes_actual,
          COUNT(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW() - INTERVAL '1 month') THEN 1 END) as mes_anterior
        FROM service_orders 
        WHERE "createdAt" >= NOW() - INTERVAL '2 months'
      `);
      const sActual = parseInt(serviciosTrend.rows[0]?.mes_actual || 0);
      const sAnterior = parseInt(serviciosTrend.rows[0]?.mes_anterior || 0);
      stats.trendServicios = sAnterior > 0 ? Math.round(((sActual - sAnterior) / sAnterior) * 100) : sActual > 0 ? 100 : 0;

      // Pendientes
      const pendientesResult = await pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'pendiente'`);
      stats.serviciosPendientes = pendientesResult.rows[0]?.count || 0;

      // En ejecución
      const ejecucionResult = await pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'en_ejecucion'`);
      stats.serviciosEnEjecucion = ejecucionResult.rows[0]?.count || 0;

      // Completados
      const completadosResult = await pool.query(`SELECT COUNT(*)::int AS count FROM service_orders WHERE estado = 'cerrada'`);
      stats.serviciosCompletados = completadosResult.rows[0]?.count || 0;

      // Stock bajo
      const stockResult = await pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE stock_actual <= stock_minimo`);
      stats.stockBajo = stockResult.rows[0]?.count || 0;

      // Productos totales
      const productosResult = await pool.query(`SELECT COUNT(*)::int AS count FROM products`);
      stats.productosTotales = productosResult.rows[0]?.count || 0;

      // Clientes activos
      const clientesResult = await pool.query(`SELECT COUNT(*)::int AS count FROM clients`);
      stats.clientesActivos = clientesResult.rows[0]?.count || 0;

      // Técnicos activos
      const tecnicosResult = await pool.query(`SELECT COUNT(*)::int AS count FROM usuarios WHERE rol = 'tecnico'`);
      stats.tecnicosActivos = tecnicosResult.rows[0]?.count || 0;

      // Ingresos del mes
      const ingresosMesResult = await pool.query(`
        SELECT COALESCE(SUM(total_general), 0)::int AS total 
        FROM sales_orders 
        WHERE estado = 'confirmada' AND EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW())
      `);
      stats.ingresosMes = ingresosMesResult.rows[0]?.total || 0;

      // Ingresos totales
      const ingresosTotalesResult = await pool.query(`
        SELECT COALESCE(SUM(total_general), 0)::int AS total 
        FROM sales_orders 
        WHERE estado = 'confirmada'
      `);
      stats.ingresosTotales = ingresosTotalesResult.rows[0]?.total || 0;

      // Trend ingresos
      const ingresosTrend = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW()) THEN total_general END), 0) as mes_actual,
          COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM NOW() - INTERVAL '1 month') THEN total_general END), 0) as mes_anterior
        FROM sales_orders 
        WHERE estado = 'confirmada' AND "createdAt" >= NOW() - INTERVAL '2 months'
      `);
      const iActual = parseFloat(ingresosTrend.rows[0]?.mes_actual || 0);
      const iAnterior = parseFloat(ingresosTrend.rows[0]?.mes_anterior || 0);
      stats.trendIngresos = iAnterior > 0 ? Math.round(((iActual - iAnterior) / iAnterior) * 100) : iActual > 0 ? 100 : 0;

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
// Actividad reciente
exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    let activities = [];

    if (userRole === "admin") {
      const ventas = await pool.query(
        `SELECT s.id, s.numero_ov, s."createdAt", c.nombre_razon_social 
         FROM sales_orders s 
         JOIN clients c ON s.client_id = c.id 
         ORDER BY s."createdAt" DESC 
         LIMIT 10`
      );

      activities = ventas.rows.map((v) => ({
        title: `Venta #${v.numero_ov}`,
        description: `Cliente: ${v.nombre_razon_social}`,
        time: new Date(v.createdAt).toLocaleString(),
        user: null,
      }));
    } else if (userRole === "tecnico") {
      const servicios = await pool.query(
        `SELECT s.codigo_os, s.descripcion_inicial, s.estado, s."createdAt" 
         FROM service_orders s 
         WHERE s.tecnico_id = $1 
         ORDER BY s."createdAt" DESC 
         LIMIT 10`,
        [userId]
      );

      activities = servicios.rows.map((s) => ({
        title: `Servicio ${s.codigo_os}`,
        description: s.descripcion_inicial || "Sin descripción",
        time: new Date(s.createdAt).toLocaleString(),
        user: null,
      }));
    }

    res.json(activities);
  } catch (error) {
    console.error("Error getting recent activities:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Órdenes recientes (NUEVO)
exports.getRecentSales = async (req, res) => {
  try {
    const query = `
      SELECT so.id, so.numero_ov, so.estado, so.total_general as total,
             c.nombre_razon_social as cliente_nombre
      FROM sales_orders so
      JOIN clients c ON so.client_id = c.id
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

// Productos más vendidos (NUEVO)
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

// Datos para gráficos (NUEVO)
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