'use strict';

const pool = require('../db/pool');

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

function getRole(req) {
  return req.user?.role?.name || req.user?.rol || null;
}

function isAdmin(req) {
  return getRole(req) === 'admin';
}

function isTechnician(req) {
  return getRole(req) === 'tecnico';
}

const ORDERS_BASE = `
  SELECT
    so.id,
    so.estado::text AS estado,
    so.tecnico_id,
    so."createdAt",
    so.fecha_inicio,
    so.fecha_fin,
    COALESCE(
      CASE
        WHEN i.payment_status = 'verified'
        THEN i.base_value
        ELSE 0
      END,
      0
    )::numeric AS confirmed_revenue
  FROM service_orders so
  LEFT JOIN service_order_intakes i
    ON i.service_order_id = so.id
  WHERE
    ($1::date IS NULL OR so."createdAt"::date >= $1)
    AND
    ($2::date IS NULL OR so."createdAt"::date <= $2)
    AND so.estado::text NOT IN (
      'cancelado',
      'rechazado'
    )
`;

const PRIMARY_OWNER = `
  SELECT
    ob.id AS service_order_id,
    COALESCE(
      (
        SELECT tm.technician_id
        FROM service_order_team_members tm
        WHERE tm.service_order_id = ob.id
          AND tm.member_role = 'primary'
          AND tm.member_status <> 'removed'
        ORDER BY tm.added_at DESC
        LIMIT 1
      ),
      ob.tecnico_id
    ) AS technician_id
  FROM orders_base ob
`;

exports.getTechnicalStatistics = async (req, res) => {
  try {
    const role = getRole(req);

    if (!['admin', 'tecnico'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado',
      });
    }

    const from = normalizeDate(
      req.query?.from || req.query?.fechaInicio
    );
    const to = normalizeDate(
      req.query?.to || req.query?.fechaFin
    );

    const params = [from, to];

    const [
      areaResult,
      techniciansResult,
      monthlyAreaResult,
      myMonthlyResult,
    ] = await Promise.all([
      pool.query(
        `
          WITH orders_base AS (
            ${ORDERS_BASE}
          )
          SELECT
            COUNT(*)::int AS total_services,
            COUNT(*) FILTER (
              WHERE estado = 'cerrada'
            )::int AS closed_services,
            COUNT(*) FILTER (
              WHERE estado IN (
                'asignada',
                'en_ejecucion',
                'en_espera'
              )
            )::int AS active_services,
            COALESCE(
              SUM(confirmed_revenue),
              0
            )::numeric AS confirmed_revenue,
            COALESCE(
              AVG(
                EXTRACT(
                  EPOCH FROM (
                    fecha_fin - fecha_inicio
                  )
                ) / 60
              ) FILTER (
                WHERE fecha_inicio IS NOT NULL
                  AND fecha_fin IS NOT NULL
              ),
              0
            )::numeric AS avg_service_minutes,
            COALESCE(
              (
                SELECT AVG(s.rating)::numeric
                FROM service_order_satisfaction s
                JOIN orders_base ob2
                  ON ob2.id = s.service_order_id
              ),
              0
            )::numeric AS avg_satisfaction
          FROM orders_base
        `,
        params
      ),

      pool.query(
        `
          WITH orders_base AS (
            ${ORDERS_BASE}
          ),
          primary_owner AS (
            ${PRIMARY_OWNER}
          ),
          primary_stats AS (
            SELECT
              po.technician_id,
              COUNT(*)::int AS principal_services,
              COUNT(*) FILTER (
                WHERE ob.estado = 'cerrada'
              )::int AS closed_services,
              COUNT(*) FILTER (
                WHERE ob.estado IN (
                  'asignada',
                  'en_ejecucion',
                  'en_espera'
                )
              )::int AS active_services,
              COALESCE(
                SUM(ob.confirmed_revenue),
                0
              )::numeric AS confirmed_revenue
            FROM orders_base ob
            JOIN primary_owner po
              ON po.service_order_id = ob.id
            WHERE po.technician_id IS NOT NULL
            GROUP BY po.technician_id
          ),
          support_stats AS (
            SELECT
              tm.technician_id,
              COUNT(DISTINCT tm.service_order_id)::int
                AS support_services
            FROM service_order_team_members tm
            JOIN orders_base ob
              ON ob.id = tm.service_order_id
            WHERE tm.member_role = 'support'
              AND tm.member_status <> 'removed'
            GROUP BY tm.technician_id
          ),
          worked AS (
            SELECT
              wl.technician_id,
              COALESCE(
                SUM(wl.duration_minutes),
                0
              )::int AS worked_minutes
            FROM service_order_work_logs wl
            JOIN orders_base ob
              ON ob.id = wl.service_order_id
            GROUP BY wl.technician_id
          ),
          satisfaction AS (
            SELECT
              po.technician_id,
              AVG(s.rating)::numeric AS avg_satisfaction
            FROM service_order_satisfaction s
            JOIN primary_owner po
              ON po.service_order_id = s.service_order_id
            GROUP BY po.technician_id
          )
          SELECT
            u.id,
            u.nombre1,
            u.nombre2,
            u.apellidos,
            u.usuario,
            u.activo,
            COALESCE(
              ps.principal_services,
              0
            )::int AS principal_services,
            COALESCE(
              ss.support_services,
              0
            )::int AS support_services,
            COALESCE(
              ps.closed_services,
              0
            )::int AS closed_services,
            COALESCE(
              ps.active_services,
              0
            )::int AS active_services,
            COALESCE(
              ps.confirmed_revenue,
              0
            )::numeric AS confirmed_revenue,
            COALESCE(
              w.worked_minutes,
              0
            )::int AS worked_minutes,
            COALESCE(
              sat.avg_satisfaction,
              0
            )::numeric AS avg_satisfaction
          FROM usuarios u
          LEFT JOIN roles r
            ON r.id = u.role_id
          LEFT JOIN primary_stats ps
            ON ps.technician_id = u.id
          LEFT JOIN support_stats ss
            ON ss.technician_id = u.id
          LEFT JOIN worked w
            ON w.technician_id = u.id
          LEFT JOIN satisfaction sat
            ON sat.technician_id = u.id
          WHERE LOWER(
            COALESCE(
              r.name,
              u.rol::text,
              ''
            )
          ) = 'tecnico'
          ORDER BY
            COALESCE(
              ps.confirmed_revenue,
              0
            ) DESC,
            COALESCE(
              ps.principal_services,
              0
            ) DESC,
            u.nombre1 ASC NULLS LAST
        `,
        params
      ),

      pool.query(
        `
          WITH orders_base AS (
            ${ORDERS_BASE}
          )
          SELECT
            TO_CHAR(
              DATE_TRUNC(
                'month',
                "createdAt"
              ),
              'YYYY-MM'
            ) AS month,
            COUNT(*)::int AS services,
            COUNT(*) FILTER (
              WHERE estado = 'cerrada'
            )::int AS closed_services,
            COALESCE(
              SUM(confirmed_revenue),
              0
            )::numeric AS revenue
          FROM orders_base
          GROUP BY DATE_TRUNC(
            'month',
            "createdAt"
          )
          ORDER BY DATE_TRUNC(
            'month',
            "createdAt"
          )
        `,
        params
      ),

      isTechnician(req)
        ? pool.query(
            `
              WITH orders_base AS (
                ${ORDERS_BASE}
              ),
              primary_owner AS (
                ${PRIMARY_OWNER}
              )
              SELECT
                TO_CHAR(
                  DATE_TRUNC(
                    'month',
                    ob."createdAt"
                  ),
                  'YYYY-MM'
                ) AS month,
                COUNT(*)::int AS services,
                COUNT(*) FILTER (
                  WHERE ob.estado = 'cerrada'
                )::int AS closed_services,
                COALESCE(
                  SUM(ob.confirmed_revenue),
                  0
                )::numeric AS revenue
              FROM orders_base ob
              JOIN primary_owner po
                ON po.service_order_id = ob.id
              WHERE po.technician_id = $3
              GROUP BY DATE_TRUNC(
                'month',
                ob."createdAt"
              )
              ORDER BY DATE_TRUNC(
                'month',
                ob."createdAt"
              )
            `,
            [from, to, req.user.id]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const technicians = techniciansResult.rows;
    const own = technicians.find(
      (item) => item.id === req.user?.id
    ) || null;

    const payload = {
      scope: isAdmin(req)
        ? 'admin'
        : 'technician',
      summary: areaResult.rows[0] || {},
      technicians: isAdmin(req)
        ? technicians
        : [],
      my_stats: isTechnician(req)
        ? own
        : null,
      monthly: isAdmin(req)
        ? monthlyAreaResult.rows
        : [],
      my_monthly: isTechnician(req)
        ? myMonthlyResult.rows
        : [],
      basis: {
        revenue_definition:
          'confirmed_service_income',
        note:
          'Ingreso confirmado = valor base de solicitudes con pago verificado. No se inventan ingresos para órdenes legacy ni pospago sin pago registrado. No sustituye WorldOffice.',
      },
    };

    return res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error(
      'Error technical statistics:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al calcular estadísticas del área técnica',
    });
  }
};
