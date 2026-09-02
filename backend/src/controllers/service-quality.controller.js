'use strict';

const pool = require('../db/pool');

function role(req) {
  return req.user?.role?.name ||
    req.user?.rol ||
    null;
}

function isAdmin(req) {
  return role(req) === 'admin';
}

function isTechnician(req) {
  return role(req) === 'tecnico';
}

function normalizeDate(value) {
  const text =
    String(value || '').trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(
    text
  )
    ? text
    : null;
}

async function assertOrderAccess(
  client,
  req,
  orderId
) {
  if (isAdmin(req)) {
    return true;
  }

  if (!isTechnician(req)) {
    return false;
  }

  const result =
    await client.query(
      `
        SELECT 1
        FROM service_orders so
        LEFT JOIN service_order_team_members tm
          ON tm.service_order_id = so.id
         AND tm.member_status <> 'removed'
        WHERE so.id = $1
          AND (
            so.tecnico_id = $2
            OR tm.technician_id = $2
          )
        LIMIT 1
      `,
      [
        orderId,
        req.user.id,
      ]
    );

  return Boolean(
    result.rows[0]
  );
}

const ORDERS_CTE = `
  SELECT
    so.id,
    so.codigo_os,
    so.estado::text AS estado,
    so."createdAt" AS created_at,
    so.fecha_inicio,
    so.fecha_fin,
    so.tecnico_id,
    COALESCE(
      i.priority,
      'normal'
    ) AS priority,
    COALESCE(
      c.rework_count,
      0
    )::int AS rework_count,
    c.status AS closure_status,
    c.updated_at AS closure_updated_at,
    d.status AS delivery_status,
    d.delivered_at,
    s.rating,
    s.would_recommend,
    sp.target_hours,
    sp.warning_percent,
    sp.active AS sla_active,
    COALESCE(
      (
        SELECT tm.technician_id
        FROM service_order_team_members tm
        WHERE tm.service_order_id = so.id
          AND tm.member_role = 'primary'
          AND tm.member_status <> 'removed'
        ORDER BY tm.added_at DESC
        LIMIT 1
      ),
      so.tecnico_id
    ) AS primary_technician_id,
    EXTRACT(
      EPOCH FROM (
        COALESCE(
          d.delivered_at,
          NOW()
        ) -
        so."createdAt"
      )
    ) / 3600.0
      AS elapsed_hours
  FROM service_orders so
  LEFT JOIN service_order_intakes i
    ON i.service_order_id = so.id
  LEFT JOIN service_order_closures c
    ON c.service_order_id = so.id
  LEFT JOIN service_order_deliveries d
    ON d.service_order_id = so.id
  LEFT JOIN service_order_satisfaction s
    ON s.service_order_id = so.id
  LEFT JOIN service_sla_policies sp
    ON sp.priority =
      COALESCE(
        i.priority,
        'normal'
      )
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
`;

exports.getQualityDashboard =
  async (req, res) => {
    try {
      if (
        !isAdmin(req) &&
        !isTechnician(req)
      ) {
        return res
          .status(403)
          .json({
            success:
              false,
            message:
              'No autorizado',
          });
      }

      const from =
        normalizeDate(
          req.query?.from ||
            req.query
              ?.fechaInicio
        );

      const to =
        normalizeDate(
          req.query?.to ||
            req.query
              ?.fechaFin
        );

      const params = [
        from,
        to,
      ];

      const [
        areaResult,
        technicianResult,
        policiesResult,
        outboxResult,
        alertResult,
      ] = await Promise.all([
        pool.query(
          `
            WITH orders_base AS (
              ${ORDERS_CTE}
            )
            SELECT
              COUNT(*)::int
                AS total_services,

              COUNT(*) FILTER (
                WHERE estado =
                  'cerrada'
              )::int
                AS closed_services,

              COUNT(*) FILTER (
                WHERE rework_count > 0
              )::int
                AS reworked_orders,

              COALESCE(
                SUM(
                  rework_count
                ),
                0
              )::int
                AS rework_cycles,

              COALESCE(
                ROUND(
                  100.0 *
                  COUNT(*) FILTER (
                    WHERE
                      rework_count > 0
                  ) /
                  NULLIF(
                    COUNT(*),
                    0
                  ),
                  1
                ),
                0
              )::numeric
                AS rework_rate_pct,

              COALESCE(
                ROUND(
                  AVG(
                    rating
                  ),
                  2
                ),
                0
              )::numeric
                AS avg_satisfaction,

              COALESCE(
                ROUND(
                  100.0 *
                  COUNT(*) FILTER (
                    WHERE
                      would_recommend =
                        TRUE
                  ) /
                  NULLIF(
                    COUNT(*) FILTER (
                      WHERE
                        would_recommend
                          IS NOT NULL
                    ),
                    0
                  ),
                  1
                ),
                0
              )::numeric
                AS recommend_pct,

              COALESCE(
                ROUND(
                  AVG(
                    elapsed_hours
                  ) FILTER (
                    WHERE
                      delivery_status =
                        'delivered'
                  ),
                  1
                ),
                0
              )::numeric
                AS avg_turnaround_hours,

              COUNT(*) FILTER (
                WHERE
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
              )::int
                AS sla_eligible,

              COUNT(*) FILTER (
                WHERE
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  delivery_status =
                    'delivered'
                  AND
                  elapsed_hours <=
                    target_hours
              )::int
                AS sla_on_time,

              COUNT(*) FILTER (
                WHERE
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  elapsed_hours >
                    target_hours
              )::int
                AS sla_breached,

              COUNT(*) FILTER (
                WHERE
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  delivery_status IS
                    DISTINCT FROM
                    'delivered'
                  AND
                  elapsed_hours >=
                    target_hours *
                    (
                      warning_percent /
                      100.0
                    )
                  AND
                  elapsed_hours <=
                    target_hours
              )::int
                AS sla_warning
            FROM orders_base
          `,
          params
        ),

        pool.query(
          `
            WITH orders_base AS (
              ${ORDERS_CTE}
            )
            SELECT
              u.id,
              u.nombre1,
              u.nombre2,
              u.apellidos,
              u.usuario,

              COUNT(
                ob.id
              )::int
                AS principal_services,

              COUNT(
                ob.id
              ) FILTER (
                WHERE
                  ob.estado =
                    'cerrada'
              )::int
                AS closed_services,

              COUNT(
                ob.id
              ) FILTER (
                WHERE
                  ob.rework_count > 0
              )::int
                AS reworked_orders,

              COALESCE(
                SUM(
                  ob.rework_count
                ),
                0
              )::int
                AS rework_cycles,

              COALESCE(
                ROUND(
                  100.0 *
                  COUNT(
                    ob.id
                  ) FILTER (
                    WHERE
                      ob.rework_count > 0
                  ) /
                  NULLIF(
                    COUNT(
                      ob.id
                    ),
                    0
                  ),
                  1
                ),
                0
              )::numeric
                AS rework_rate_pct,

              COALESCE(
                ROUND(
                  AVG(
                    ob.rating
                  ),
                  2
                ),
                0
              )::numeric
                AS avg_satisfaction,

              COUNT(
                ob.id
              ) FILTER (
                WHERE
                  ob.sla_active = TRUE
                  AND
                  ob.target_hours
                    IS NOT NULL
                  AND
                  ob.delivery_status =
                    'delivered'
                  AND
                  ob.elapsed_hours <=
                    ob.target_hours
              )::int
                AS sla_on_time,

              COUNT(
                ob.id
              ) FILTER (
                WHERE
                  ob.sla_active = TRUE
                  AND
                  ob.target_hours
                    IS NOT NULL
                  AND
                  ob.elapsed_hours >
                    ob.target_hours
              )::int
                AS sla_breached

            FROM usuarios u
            LEFT JOIN roles r
              ON r.id = u.role_id
            LEFT JOIN orders_base ob
              ON
                ob.primary_technician_id =
                  u.id
            WHERE LOWER(
              COALESCE(
                r.name,
                u.rol::text,
                ''
              )
            ) = 'tecnico'
            GROUP BY
              u.id,
              u.nombre1,
              u.nombre2,
              u.apellidos,
              u.usuario
            ORDER BY
              avg_satisfaction
                DESC,
              rework_rate_pct
                ASC,
              principal_services
                DESC
          `,
          params
        ),

        pool.query(
          `
            SELECT
              id,
              priority,
              target_hours,
              warning_percent,
              active,
              updated_at
            FROM service_sla_policies
            ORDER BY
              CASE priority
                WHEN 'urgente'
                  THEN 1
                WHEN 'alta'
                  THEN 2
                WHEN 'normal'
                  THEN 3
                ELSE 4
              END
          `
        ),

        isAdmin(req)
          ? pool.query(
              `
                SELECT
                  COUNT(*) FILTER (
                    WHERE
                      status =
                        'pending'
                  )::int
                    AS pending,

                  COUNT(*) FILTER (
                    WHERE
                      status =
                        'processing'
                  )::int
                    AS processing,

                  COUNT(*) FILTER (
                    WHERE
                      status =
                        'failed'
                  )::int
                    AS failed,

                  COUNT(*) FILTER (
                    WHERE
                      status =
                        'sent'
                  )::int
                    AS sent,

                  COALESCE(
                    MAX(
                      created_at
                    ) FILTER (
                      WHERE
                        status IN (
                          'pending',
                          'failed'
                        )
                    ),
                    NULL
                  )
                    AS oldest_pending
                FROM
                  service_notification_outbox
              `
            )
          : Promise.resolve({
              rows: [],
            }),

        pool.query(
          `
            WITH orders_base AS (
              ${ORDERS_CTE}
            ),
            alerts AS (
              SELECT
                ob.*,

                EXISTS (
                  SELECT 1
                  FROM
                    service_order_client_notifications n
                  WHERE
                    n.service_order_id =
                      ob.id
                )
                  AS has_notification,

                EXISTS (
                  SELECT 1
                  FROM
                    service_order_satisfaction s2
                  WHERE
                    s2.service_order_id =
                      ob.id
                )
                  AS has_satisfaction,

                EXISTS (
                  SELECT 1
                  FROM
                    service_order_team_members tm2
                  WHERE
                    tm2.service_order_id =
                      ob.id
                    AND
                    tm2.technician_id =
                      $3::uuid
                    AND
                    tm2.member_status <>
                      'removed'
                )
                  AS current_user_member

              FROM
                orders_base ob
            )
            SELECT
              id,
              codigo_os,
              estado,
              priority,
              primary_technician_id,
              elapsed_hours,
              target_hours,
              warning_percent,
              closure_status,
              delivery_status,

              CASE
                WHEN
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  elapsed_hours >
                    target_hours
                THEN
                  'sla_breached'

                WHEN
                  closure_status =
                    'rework_required'
                THEN
                  'rework_required'

                WHEN
                  closure_status =
                    'validated'
                  AND
                  has_notification =
                    FALSE
                THEN
                  'client_notification_pending'

                WHEN
                  closure_status =
                    'validated'
                  AND
                  has_notification =
                    TRUE
                  AND
                  delivery_status IS
                    DISTINCT FROM
                    'delivered'
                THEN
                  'delivery_pending'

                WHEN
                  delivery_status =
                    'delivered'
                  AND
                  has_satisfaction =
                    FALSE
                THEN
                  'satisfaction_pending'

                WHEN
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  delivery_status IS
                    DISTINCT FROM
                    'delivered'
                  AND
                  elapsed_hours >=
                    target_hours *
                    (
                      warning_percent /
                      100.0
                    )
                THEN
                  'sla_warning'

                ELSE NULL
              END
                AS alert_type,

              CASE
                WHEN
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  elapsed_hours >
                    target_hours
                THEN 1

                WHEN
                  closure_status =
                    'rework_required'
                THEN 1

                WHEN
                  closure_status =
                    'validated'
                  AND
                  has_notification =
                    FALSE
                THEN 2

                WHEN
                  sla_active = TRUE
                  AND
                  target_hours IS NOT NULL
                  AND
                  delivery_status IS
                    DISTINCT FROM
                    'delivered'
                  AND
                  elapsed_hours >=
                    target_hours *
                    (
                      warning_percent /
                      100.0
                    )
                THEN 2

                ELSE 3
              END
                AS severity_rank

            FROM alerts
            WHERE
              (
                CASE
                  WHEN
                    sla_active = TRUE
                    AND
                    target_hours IS NOT NULL
                    AND
                    elapsed_hours >
                      target_hours
                  THEN TRUE

                  WHEN
                    closure_status =
                      'rework_required'
                  THEN TRUE

                  WHEN
                    closure_status =
                      'validated'
                    AND
                    has_notification =
                      FALSE
                  THEN TRUE

                  WHEN
                    closure_status =
                      'validated'
                    AND
                    has_notification =
                      TRUE
                    AND
                    delivery_status IS
                      DISTINCT FROM
                      'delivered'
                  THEN TRUE

                  WHEN
                    delivery_status =
                      'delivered'
                    AND
                    has_satisfaction =
                      FALSE
                  THEN TRUE

                  WHEN
                    sla_active = TRUE
                    AND
                    target_hours IS NOT NULL
                    AND
                    delivery_status IS
                      DISTINCT FROM
                      'delivered'
                    AND
                    elapsed_hours >=
                      target_hours *
                      (
                        warning_percent /
                        100.0
                      )
                  THEN TRUE

                  ELSE FALSE
                END
              )
              AND (
                $3::uuid IS NULL
                OR
                primary_technician_id =
                  $3
                OR
                current_user_member =
                  TRUE
              )
            ORDER BY
              severity_rank ASC,
              elapsed_hours DESC
            LIMIT 50
          `,
          [
            from,
            to,
            isTechnician(req)
              ? req.user.id
              : null,
          ]
        ),
      ]);

      const technicians =
        technicianResult.rows;

      const own =
        isTechnician(req)
          ? technicians.find(
              (item) =>
                item.id ===
                req.user.id
            ) || null
          : null;

      return res.json({
        success: true,
        data: {
          scope:
            isAdmin(req)
              ? 'admin'
              : 'technician',

          summary:
            areaResult.rows[0] ||
            {},

          my_quality:
            own,

          technicians:
            isAdmin(req)
              ? technicians
              : [],

          alerts:
            alertResult.rows,

          sla_policies:
            policiesResult.rows,

          outbox:
            isAdmin(req)
              ? {
                  configured:
                    Boolean(
                      process.env
                        .SERVICE_NOTIFICATIONS_WEBHOOK_URL
                    ),
                  ...(outboxResult
                    .rows[0] ||
                    {}),
                }
              : null,

          definitions: {
            sla:
              'Desde creación de la OS hasta entrega final. Solo aplica cuando el administrador activa una política por prioridad.',
            rework:
              'Orden con uno o más reprocesos solicitados por Dirección Técnica.',
          },
        },
      });
    } catch (error) {
      console.error(
        'Error quality dashboard:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al calcular indicadores de calidad',
        });
    }
  };

exports.updateSlaPolicies =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede configurar SLA',
        });
    }

    const policies =
      Array.isArray(
        req.body?.policies
      )
        ? req.body.policies
        : [];

    const allowed =
      new Set([
        'baja',
        'normal',
        'alta',
        'urgente',
      ]);

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      for (const item of policies) {
        const priority =
          String(
            item?.priority ||
              ''
          ).trim();

        if (
          !allowed.has(
            priority
          )
        ) {
          continue;
        }

        const targetRaw =
          item?.target_hours;

        const targetHours =
          targetRaw === '' ||
          targetRaw === null ||
          targetRaw ===
            undefined
            ? null
            : Number(
                targetRaw
              );

        const warningPercent =
          Number(
            item
              ?.warning_percent ||
              80
          );

        const active =
          Boolean(
            item?.active
          );

        if (
          targetHours !== null &&
          (
            !Number.isInteger(
              targetHours
            ) ||
            targetHours < 1 ||
            targetHours >
              8760
          )
        ) {
          const error =
            new Error(
              `Horas SLA inválidas para ${priority}`
            );
          error.code =
            'INVALID_SLA';
          throw error;
        }

        if (
          active &&
          targetHours === null
        ) {
          const error =
            new Error(
              `Define horas objetivo antes de activar ${priority}`
            );
          error.code =
            'INVALID_SLA';
          throw error;
        }

        if (
          !Number.isInteger(
            warningPercent
          ) ||
          warningPercent <
            50 ||
          warningPercent >
            100
        ) {
          const error =
            new Error(
              `Porcentaje de alerta inválido para ${priority}`
            );
          error.code =
            'INVALID_SLA';
          throw error;
        }

        await client.query(
          `
            UPDATE
              service_sla_policies
            SET
              target_hours = $1,
              warning_percent =
                $2,
              active = $3,
              updated_by = $4,
              updated_at = NOW()
            WHERE
              priority = $5
          `,
          [
            targetHours,
            warningPercent,
            active,
            req.user.id,
            priority,
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      const result =
        await pool.query(
          `
            SELECT
              id,
              priority,
              target_hours,
              warning_percent,
              active,
              updated_at
            FROM
              service_sla_policies
            ORDER BY
              CASE priority
                WHEN 'urgente'
                  THEN 1
                WHEN 'alta'
                  THEN 2
                WHEN 'normal'
                  THEN 3
                ELSE 4
              END
          `
        );

      return res.json({
        success: true,
        message:
          'Políticas SLA actualizadas',
        data:
          result.rows,
      });
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch (_) {}

      console.error(
        'Error updating SLA:',
        error
      );

      if (
        error?.code ===
        'INVALID_SLA'
      ) {
        return res
          .status(400)
          .json({
            success:
              false,
            code:
              error.code,
            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al actualizar SLA',
        });
    } finally {
      client.release();
    }
  };

exports.getAuditTimeline =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const orderId =
        String(
          req.params.id ||
            ''
        ).trim();

      if (
        !(await assertOrderAccess(
          client,
          req,
          orderId
        ))
      ) {
        return res
          .status(403)
          .json({
            success:
              false,
            message:
              'No autorizado para consultar esta auditoría',
          });
      }

      const [
        baseEvents,
        closureEvents,
        deliveryEvents,
        custodyEvents,
        workLogs,
        notifications,
        satisfaction,
        documentEvents,
        financialEvents,
      ] = await Promise.all([
        client.query(
          `
            SELECT
              event_type,
              actor_user_id,
              metadata,
              created_at
            FROM
              service_order_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              event_type,
              actor_user_id,
              metadata,
              created_at
            FROM
              service_order_closure_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              event_type,
              actor_user_id,
              metadata,
              created_at
            FROM
              service_order_delivery_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              action,
              performed_by,
              from_user_id,
              to_user_id,
              note,
              created_at
            FROM
              service_order_custody_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              technician_id,
              activity_type,
              description,
              duration_minutes,
              result_note,
              created_at
            FROM
              service_order_work_logs
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              channel,
              recipient_name,
              recipient_contact,
              reference,
              note,
              notified_by,
              notified_at
                AS created_at
            FROM
              service_order_client_notifications
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              rating,
              would_recommend,
              comment,
              captured_by,
              captured_at
                AS created_at
            FROM
              service_order_satisfaction
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              event_type,
              actor_user_id,
              metadata,
              created_at
            FROM
              service_order_document_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),

        client.query(
          `
            SELECT
              event_type,
              actor_user_id,
              metadata,
              created_at
            FROM
              service_order_financial_events
            WHERE
              service_order_id =
                $1
          `,
          [orderId]
        ),
      ]);

      const items = [];

      for (const row of baseEvents.rows) {
        items.push({
          source:
            'service',
          event_type:
            row.event_type,
          actor_user_id:
            row.actor_user_id,
          metadata:
            row.metadata || {},
          created_at:
            row.created_at,
        });
      }

      for (const row of closureEvents.rows) {
        items.push({
          source:
            'closure',
          event_type:
            row.event_type,
          actor_user_id:
            row.actor_user_id,
          metadata:
            row.metadata || {},
          created_at:
            row.created_at,
        });
      }

      for (const row of deliveryEvents.rows) {
        items.push({
          source:
            'delivery',
          event_type:
            row.event_type,
          actor_user_id:
            row.actor_user_id,
          metadata:
            row.metadata || {},
          created_at:
            row.created_at,
        });
      }

      for (const row of custodyEvents.rows) {
        items.push({
          source:
            'custody',
          event_type:
            `custody_${row.action}`,
          actor_user_id:
            row.performed_by,
          metadata: {
            from_user_id:
              row.from_user_id,
            to_user_id:
              row.to_user_id,
            note:
              row.note,
          },
          created_at:
            row.created_at,
        });
      }

      for (const row of workLogs.rows) {
        items.push({
          source:
            'work_log',
          event_type:
            `work_${row.activity_type}`,
          actor_user_id:
            row.technician_id,
          metadata: {
            description:
              row.description,
            duration_minutes:
              row.duration_minutes,
            result_note:
              row.result_note,
          },
          created_at:
            row.created_at,
        });
      }

      for (const row of notifications.rows) {
        items.push({
          source:
            'notification',
          event_type:
            `client_notification_${row.channel}`,
          actor_user_id:
            row.notified_by,
          metadata: {
            recipient_name:
              row.recipient_name,
            recipient_contact:
              row.recipient_contact,
            reference:
              row.reference,
            note:
              row.note,
          },
          created_at:
            row.created_at,
        });
      }

      for (const row of satisfaction.rows) {
        items.push({
          source:
            'satisfaction',
          event_type:
            'client_satisfaction',
          actor_user_id:
            row.captured_by,
          metadata: {
            rating:
              row.rating,
            would_recommend:
              row.would_recommend,
            comment:
              row.comment,
          },
          created_at:
            row.created_at,
        });
      }

      for (const row of documentEvents.rows) {
        items.push({
          source:
            'document',
          event_type:
            row.event_type,
          actor_user_id:
            row.actor_user_id,
          metadata:
            row.metadata || {},
          created_at:
            row.created_at,
        });
      }

      for (const row of financialEvents.rows) {
        items.push({
          source:
            'financial',
          event_type:
            row.event_type,
          actor_user_id:
            row.actor_user_id,
          metadata:
            row.metadata || {},
          created_at:
            row.created_at,
        });
      }

      const actorIds = [
        ...new Set(
          items
            .map(
              (item) =>
                item.actor_user_id
            )
            .filter(Boolean)
        ),
      ];

      const userMap =
        new Map();

      if (actorIds.length) {
        const users =
          await client.query(
            `
              SELECT
                id,
                nombre1,
                nombre2,
                apellidos,
                usuario
              FROM usuarios
              WHERE
                id =
                  ANY(
                    $1::uuid[]
                  )
            `,
            [actorIds]
          );

        for (const user of users.rows) {
          userMap.set(
            user.id,
            [
              user.nombre1,
              user.nombre2,
              user.apellidos,
            ]
              .filter(Boolean)
              .join(' ') ||
              user.usuario ||
              'Usuario'
          );
        }
      }

      items.sort(
        (a, b) =>
          new Date(
            a.created_at
          ) -
          new Date(
            b.created_at
          )
      );

      return res.json({
        success: true,
        data:
          items.map(
            (item) => ({
              ...item,
              actor_name:
                item.actor_user_id
                  ? userMap.get(
                      item.actor_user_id
                    ) ||
                    'Usuario'
                  : 'Sistema',
            })
          ),
      });
    } catch (error) {
      console.error(
        'Error audit timeline:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar auditoría de la orden',
        });
    } finally {
      client.release();
    }
  };


exports.getSlaHistory =
  async (req, res) => {
    try {
      const roleName =
        req.user?.role?.name ||
        req.user?.rol ||
        null;

      if (
        ![
          'admin',
          'tecnico',
        ].includes(
          roleName
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'No autorizado',
          });
      }

      const result =
        await pool.query(
          `
            SELECT
              e.id,
              e.service_order_id,
              so.codigo_os,
              e.alert_type,
              e.priority,
              e.elapsed_hours,
              e.target_hours,
              e.warning_percent,
              e.created_at,

              COALESCE(
                (
                  SELECT
                    tm.technician_id
                  FROM
                    service_order_team_members tm
                  WHERE
                    tm.service_order_id =
                      so.id
                    AND
                    tm.member_role =
                      'primary'
                    AND
                    tm.member_status <>
                      'removed'
                  ORDER BY
                    tm.added_at DESC
                  LIMIT 1
                ),
                so.tecnico_id
              )
                AS primary_technician_id

            FROM
              service_sla_alert_events e

            JOIN
              service_orders so
              ON
                so.id =
                  e.service_order_id

            WHERE
              (
                $1::uuid IS NULL
                OR
                COALESCE(
                  (
                    SELECT
                      tm2.technician_id
                    FROM
                      service_order_team_members tm2
                    WHERE
                      tm2.service_order_id =
                        so.id
                      AND
                      tm2.member_role =
                        'primary'
                      AND
                      tm2.member_status <>
                        'removed'
                    ORDER BY
                      tm2.added_at DESC
                    LIMIT 1
                  ),
                  so.tecnico_id
                ) = $1

                OR EXISTS (
                  SELECT 1
                  FROM
                    service_order_team_members tm3
                  WHERE
                    tm3.service_order_id =
                      so.id
                    AND
                    tm3.technician_id =
                      $1
                    AND
                    tm3.member_status <>
                      'removed'
                )
              )

            ORDER BY
              e.created_at DESC

            LIMIT 100
          `,
          [
            roleName ===
            'tecnico'
              ? req.user.id
              : null,
          ]
        );

      return res.json({
        success: true,
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        'Error loading SLA history:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar historial SLA',
        });
    }
  };
