'use strict';

const {
  randomUUID,
} = require('crypto');

const pool =
  require('../db/pool');

const {
  enqueueNotification,
} = require('./service-notification-outbox.service');

async function monitorSlaAlerts() {
  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    const result =
      await client.query(
        `
          SELECT
            so.id,
            so.codigo_os,
            so.estado::text AS estado,
            so."createdAt" AS created_at,

            COALESCE(
              i.priority,
              'normal'
            ) AS priority,

            p.id AS policy_id,
            p.target_hours,
            p.warning_percent,
            p.updated_at
              AS policy_updated_at,

            EXTRACT(
              EPOCH FROM (
                NOW() -
                so."createdAt"
              )
            ) / 3600.0
              AS elapsed_hours

          FROM service_orders so

          LEFT JOIN service_order_intakes i
            ON
              i.service_order_id =
                so.id

          JOIN service_sla_policies p
            ON
              p.priority =
                COALESCE(
                  i.priority,
                  'normal'
                )

          WHERE
            p.active = TRUE

            AND
            p.target_hours
              IS NOT NULL

            AND
            so.estado::text
              NOT IN (
                'cerrada',
                'cancelado',
                'rechazado'
              )

          ORDER BY
            so."createdAt"
              ASC
        `
      );

    let warnings = 0;
    let breached = 0;
    let created = 0;

    for (
      const row of
      result.rows
    ) {
      const elapsed =
        Number(
          row.elapsed_hours ||
            0
        );

      const target =
        Number(
          row.target_hours ||
            0
        );

      const warningAt =
        target *
        (
          Number(
            row.warning_percent ||
              80
          ) /
          100
        );

      let alertType =
        null;

      if (
        elapsed > target
      ) {
        alertType =
          'breached';
      } else if (
        elapsed >=
        warningAt
      ) {
        alertType =
          'warning';
      }

      if (!alertType) {
        continue;
      }

      const policyVersion =
        new Date(
          row.policy_updated_at
        ).toISOString();

      const alertKey =
        `${row.id}:${alertType}:${policyVersion}`;

      const insert =
        await client.query(
          `
            INSERT INTO service_sla_alert_events (
              id,
              service_order_id,
              policy_id,
              alert_key,
              alert_type,
              priority,
              elapsed_hours,
              target_hours,
              warning_percent,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,
              $7,$8,$9,NOW()
            )
            ON CONFLICT (
              alert_key
            )
            DO NOTHING
            RETURNING *
          `,
          [
            randomUUID(),
            row.id,
            row.policy_id,
            alertKey,
            alertType,
            row.priority,
            elapsed,
            target,
            Number(
              row.warning_percent ||
                80
            ),
          ]
        );

      if (
        !insert.rows[0]
      ) {
        continue;
      }

      created += 1;

      if (
        alertType ===
        'warning'
      ) {
        warnings += 1;
      } else {
        breached += 1;
      }

      await enqueueNotification(
        client,
        {
          serviceOrderId:
            row.id,

          eventType:
            alertType ===
            'warning'
              ? 'sla_warning'
              : 'sla_breached',

          idempotencyKey:
            alertKey,

          payload: {
            codigo_os:
              row.codigo_os,
            priority:
              row.priority,
            elapsed_hours:
              Number(
                elapsed.toFixed(
                  2
                )
              ),
            target_hours:
              target,
            warning_percent:
              Number(
                row.warning_percent ||
                  80
              ),
          },
        }
      );
    }

    await client.query(
      'COMMIT'
    );

    return {
      scanned:
        result.rows.length,
      created,
      warnings,
      breached,
    };
  } catch (error) {
    try {
      await client.query(
        'ROLLBACK'
      );
    } catch (_) {}

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  monitorSlaAlerts,
};
