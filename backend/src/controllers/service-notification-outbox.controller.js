'use strict';

const pool =
  require('../db/pool');

const {
  isConfigured,
  processOutbox,
  requeueItem,
} = require('../services/service-notification-outbox.service');

exports.listOutbox =
  async (req, res) => {
    try {
      const status =
        String(
          req.query?.status ||
            ''
        ).trim();

      const allowed =
        new Set([
          'pending',
          'processing',
          'sent',
          'failed',
        ]);

      const result =
        await pool.query(
          `
            SELECT
              o.*,
              so.codigo_os
            FROM
              service_notification_outbox o
            JOIN
              service_orders so
              ON
                so.id =
                  o.service_order_id
            WHERE
              (
                $1::text IS NULL
                OR
                o.status =
                  $1
              )
            ORDER BY
              o.created_at DESC
            LIMIT 100
          `,
          [
            allowed.has(
              status
            )
              ? status
              : null,
          ]
        );

      return res.json({
        success: true,
        configured:
          isConfigured(),
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        'Error listing outbox:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar cola de notificaciones',
        });
    }
  };

exports.processOutbox =
  async (req, res) => {
    try {
      const result =
        await processOutbox({
          limit:
            Number(
              req.body?.limit ||
                10
            ),
        });

      return res.json({
        success: true,
        data:
          result,
      });
    } catch (error) {
      console.error(
        'Error processing outbox:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al procesar cola de notificaciones',
        });
    }
  };

exports.retryOutboxItem =
  async (req, res) => {
    try {
      const result =
        await requeueItem(
          req.params.outboxId
        );

      if (!result) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Item no encontrado o no reintentable',
          });
      }

      return res.json({
        success: true,
        message:
          'Item marcado para reintento',
        data:
          result,
      });
    } catch (error) {
      console.error(
        'Error retrying outbox:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al reintentar item',
        });
    }
  };

exports.getWorkerStatus =
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT *
            FROM
              service_worker_heartbeats
            WHERE
              worker_name =
                'service-notification-worker'
            LIMIT 1
          `
        );

      const row =
        result.rows[0] ||
        null;

      const intervalMs =
        Math.max(
          15000,
          Number(
            process.env.SERVICE_NOTIFICATION_WORKER_INTERVAL_MS ||
              60000
          )
        );

      const heartbeatAgeMs =
        row?.heartbeat_at
          ? Date.now() -
            new Date(
              row.heartbeat_at
            ).getTime()
          : null;

      const online =
        heartbeatAgeMs !==
          null &&
        heartbeatAgeMs <=
          intervalMs * 3;

      return res.json({
        success: true,
        data: {
          configured:
            isConfigured(),
          online,
          expected_interval_ms:
            intervalMs,
          heartbeat_age_ms:
            heartbeatAgeMs,
          worker:
            row,
        },
      });
    } catch (error) {
      console.error(
        'Error reading worker status:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al consultar estado del worker',
        });
    }
  };
