const pool = require("../db/pool");

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

    switch (userRole) {
      case "admin": {
        const [ventasResult, serviciosResult, pendientesResult, stockResult] =
          await Promise.all([
            pool.query(
              `SELECT COUNT(*)::int AS count 
               FROM sales_orders 
               WHERE estado = $1`,
              ["confirmada"]
            ),
            pool.query(`SELECT COUNT(*)::int AS count FROM service_orders`),
            pool.query(
              `SELECT COUNT(*)::int AS count 
               FROM service_orders 
               WHERE estado IN ($1, $2)`,
              ["pendiente", "asignada"]
            ),
            pool.query(
              `SELECT COUNT(*)::int AS count 
               FROM products 
               WHERE stock_actual <= stock_minimo`
            ),
          ]);

        stats.totalVentas = ventasResult.rows[0]?.count || 0;
        stats.totalServicios = serviciosResult.rows[0]?.count || 0;
        stats.serviciosPendientes = pendientesResult.rows[0]?.count || 0;
        stats.stockBajo = stockResult.rows[0]?.count || 0;
        break;
      }

      case "ventas": {
        const ventasVendedor = await pool.query(
          `SELECT COUNT(*)::int AS count 
           FROM sales_orders 
           WHERE vendedor_id = $1 
             AND estado = $2`,
          [userId, "confirmada"]
        );
        stats.totalVentas = ventasVendedor.rows[0]?.count || 0;
        break;
      }

      case "tecnico": {
        const [serviciosTecnico, pendientesTecnico] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS count 
             FROM service_orders 
             WHERE tecnico_id = $1`,
            [userId]
          ),
          pool.query(
            `SELECT COUNT(*)::int AS count 
             FROM service_orders 
             WHERE tecnico_id = $1 
               AND estado IN ($2, $3)`,
            [userId, "asignada", "en_ejecucion"]
          ),
        ]);

        stats.totalServicios = serviciosTecnico.rows[0]?.count || 0;
        stats.serviciosPendientes = pendientesTecnico.rows[0]?.count || 0;
        break;
      }

      case "inventario": {
        const stockBajo = await pool.query(
          `SELECT COUNT(*)::int AS count 
           FROM products 
           WHERE stock_actual <= stock_minimo`
        );
        stats.stockBajo = stockBajo.rows[0]?.count || 0;
        break;
      }

      default:
        break;
    }

    res.json(stats);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    let activities = [];

    switch (userRole) {
      case "admin": {
        // ✅ CAMBIO CLAVE: fecha_creacion -> "createdAt"
        const ventas = await pool.query(
          `SELECT s.id, s.numero_ov, s."createdAt", c.nombre_razon_social 
           FROM sales_orders s 
           JOIN clients c ON s.client_id = c.id 
           ORDER BY s."createdAt" DESC 
           LIMIT 5`
        );

        activities = ventas.rows.map((v) => ({
          title: `Venta #${v.numero_ov}`,
          description: `Cliente: ${v.nombre_razon_social}`,
          time: new Date(v.createdAt).toLocaleString(),
          icon:
            "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
        }));
        break;
      }

      case "tecnico": {
        // ✅ CAMBIO CLAVE: fecha_creacion -> "createdAt"
        const servicios = await pool.query(
          `SELECT s.codigo_os, s.descripcion_inicial, s.estado, s."createdAt" 
           FROM service_orders s 
           WHERE s.tecnico_id = $1 
           ORDER BY s."createdAt" DESC 
           LIMIT 5`,
          [userId]
        );

        activities = servicios.rows.map((s) => {
          const desc = (s.descripcion_inicial || "").trim();
          return {
            title: `Servicio ${s.codigo_os}`,
            description: desc.length > 60 ? desc.slice(0, 60) + "..." : desc || "Sin descripción",
            time: new Date(s.createdAt).toLocaleString(),
            icon:
              "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
          };
        });
        break;
      }

      default:
        // Otros roles: devuelve vacío
        activities = [];
        break;
    }

    res.json(activities);
  } catch (error) {
    console.error("Error getting recent activities:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
