'use strict';

const pool = require('../db/pool');

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

exports.getTechnicalStatistics = async (req, res) => {
  try {
    const from = normalizeDate(
      req.query?.from ||
        req.query?.fechaInicio
    );
    const to = normalizeDate(
      req.query?.to ||
        req.query?.fechaFin
    );

    const result = await pool.query(
      `
        WITH orders_base AS (
          SELECT
            so.id,
            so.codigo_os,
            so.estado::text AS estado,
            so.tecnico_id,
            so."createdAt",
            so.fecha_inicio,
            so.fecha_fin,
            so.total_general,
            i.id AS intake_id,
            i.base_value,
            i.payment_status,
            i.billing_mode,
            COALESCE(
              CASE
                WHEN i.payment_status = 'verified'
                THEN i.base_value
                ELSE NULL
              END,
              CASE
                WHEN i.id IS NULL
                 AND so.estado::text = 'cerrada'
                THEN so.total_general
                ELSE NULL
              END,
              0
            )::numeric AS confirmed_revenue
          FROM service_orders so
          LEFT JOIN service_order_intakes i
            ON i.service_order_id = so.id
          WHERE (
              $1::date IS NULL
              OR so."createdAt"::date >= $1
            )
            AND (
              $2::date IS NULL
              OR so."createdAt"::date <= $2
            )
            AND so.estado::text NOT IN (
              'cancelado',
              'rechazado'
            )
        ),
        primary_owner AS (
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
        ),
        support_members AS (
          SELECT DISTINCT
            tm.service_order_id,
            tm.technician_id
          FROM service_order_team_members tm
          JOIN orders_base ob
            ON ob.id = tm.service_order_id
          WHERE tm.member_role = 'support'
            AND tm.member_status <> 'removed'
        ),
        techs AS (
          SELECT
            u.id,
            u.nombre1,
            u.nombre2,
            u.apellidos,
            u.usuario,
            u.activo
          FROM usuarios u
          LEFT JOIN roles r
            ON r.id = u.role_id
          WHERE LOWER(
            COALESCE(
              r.name,
              u.rol::text,
              ''
            )
          ) = 'tecnico'
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
        technician_stats AS (
          SELECT
            t.id,
            t.nombre1,
            t.nombre2,
            t.apellidos,
            t.usuario,
            t.activo,
            COUNT(DISTINCT ob.id)
              FILTER (
                WHERE po.technician_id = t.id
              )::int AS principal_services,
            COUNT(DISTINCT ob.id)
              FILTER (
                WHERE po.technician_id = t.id
                  AND ob.estado = 'cerrada'
              )::int AS closed_services,
            COUNT(DISTINCT ob.id)
              FILTER (
                WHERE po.technician_id = t.id
                  AND ob.estado IN (
                    'asignada',
                    'en_ejecucion',
                    'en_espera'
                  )
              )::int AS active_services,
            COUNT(DISTINCT sm.service_order_id)::int
              AS support_services,
            COALESCE(
              SUM(ob.confirmed_revenue)
                FILTER (
                  WHERE po.technician_id = t.id
                ),
              0
            )::numeric AS confirmed_revenue,
            COALESCE(
              MAX(w.worked_minutes),
              0
            )::int AS worked_minutes
          FROM techs t
          LEFT JOIN primary_owner po
            ON po.technician_id = t.id
          LEFT JOIN orders_base ob
            ON ob.id = po.service_order_id
          LEFT JOIN support_members sm
            ON sm.technician_id = t.id
          LEFT JOIN worked w
            ON w.technician_id = t.id
          GROUP BY
            t.id,
            t.nombre1,
            t.nombre2,
            t.apellidos,
            t.usuario,
            t.activo
        ),
        monthly AS (
          SELECT
            DATE_TRUNC(
              'month',
              ob."createdAt"
            ) AS month,
            COUNT(*)::int AS services,
            COUNT(*)
              FILTER (
                WHERE ob.estado = 'cerrada'
              )::int AS closed_services,
            COALESCE(
              SUM(ob.confirmed_revenue),
              0
            )::numeric AS revenue
          FROM orders_base ob
          GROUP BY DATE_TRUNC(
            'month',
            ob."createdAt"
          )
          ORDER BY month ASC
        ),
        area AS (
          SELECT
            COUNT(*)::int AS total_services,
            COUNT(*)
              FILTER (
                WHERE estado = 'cerrada'
              )::int AS closed_services,
            COUNT(*)
              FILTER (
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
              )
              FILTER (
                WHERE fecha_inicio IS NOT NULL
                  AND fecha_fin IS NOT NULL
              ),
              0
            )::numeric AS avg_service_minutes
          FROM orders_base
        )
        SELECT jsonb_build_object(
          'summary',
          (
            SELECT to_jsonb(area)
            FROM area
          ),
          'technicians',
          (
            SELECT COALESCE(
              jsonb_agg(
                to_jsonb(ts)
                ORDER BY
                  ts.confirmed_revenue DESC,
                  ts.principal_services DESC,
                  ts.nombre1 ASC
              ),
              '[]'::jsonb
            )
            FROM technician_stats ts
          ),
          'monthly',
          (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'month',
                  TO_CHAR(month, 'YYYY-MM'),
                  'label',
                  TO_CHAR(month, 'Mon YYYY'),
                  'services',
                  services,
                  'closed_services',
                  closed_services,
                  'revenue',
                  revenue
                )
                ORDER BY month
              ),
              '[]'::jsonb
            )
            FROM monthly
          ),
          'basis',
          jsonb_build_object(
            'revenue_definition',
            'confirmed_service_income',
            'note',
            'Prepago V9/V11: valor base con pago verificado. Órdenes legacy sin intake: total_general solo al estar cerradas. No sustituye la contabilidad de WorldOffice.'
          )
        ) AS payload
      `,
      [
        from,
        to,
      ]
    );

    return res.json({
      success: true,
      data:
        result.rows[0]?.payload || {
          summary: {},
          technicians: [],
          monthly: [],
        },
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
