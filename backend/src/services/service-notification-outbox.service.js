'use strict';

const { randomUUID } = require('crypto');
const pool = require('../db/pool');

function getWebhookUrl() {
  return String(
    process.env.SERVICE_NOTIFICATIONS_WEBHOOK_URL ||
      ''
  ).trim();
}

function getWebhookTimeoutMs() {
  return Math.max(
    2000,
    Number(
      process.env.SERVICE_NOTIFICATIONS_WEBHOOK_TIMEOUT_MS ||
        10000
    )
  );
}

function isConfigured() {
  return Boolean(
    getWebhookUrl()
  );
}

async function enqueueNotification(
  client,
  {
    serviceOrderId,
    eventType,
    payload = {},
    idempotencyKey = null,
  }
) {
  const key =
    idempotencyKey ||
    `${serviceOrderId}:${eventType}`;

  const result = await client.query(
    `
      INSERT INTO service_notification_outbox (
        id,
        service_order_id,
        event_type,
        idempotency_key,
        payload,
        status,
        attempts,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5::jsonb,
        'pending',0,NOW(),NOW()
      )
      ON CONFLICT (idempotency_key)
      DO NOTHING
      RETURNING *
    `,
    [
      randomUUID(),
      serviceOrderId,
      eventType,
      key,
      JSON.stringify(
        payload || {}
      ),
    ]
  );

  return result.rows[0] ||
    null;
}

async function recoverStuckItems() {
  const result = await pool.query(
    `
      UPDATE service_notification_outbox
      SET status = 'failed',
          last_error =
            COALESCE(
              last_error,
              'Recuperado por V15: item quedo en processing por reinicio o caida del worker.'
            ),
          next_attempt_at = NOW(),
          updated_at = NOW()
      WHERE status = 'processing'
        AND last_attempt_at <
          NOW() -
          INTERVAL '10 minutes'
      RETURNING id
    `
  );

  return result.rowCount;
}

async function claimBatch(
  limit = 10
) {
  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN'
    );

    const result =
      await client.query(
        `
          WITH picked AS (
            SELECT id
            FROM service_notification_outbox
            WHERE status IN (
                'pending',
                'failed'
              )
              AND (
                next_attempt_at IS NULL
                OR
                next_attempt_at <= NOW()
              )
            ORDER BY
              created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE service_notification_outbox o
          SET status = 'processing',
              last_attempt_at = NOW(),
              attempts = attempts + 1,
              updated_at = NOW()
          FROM picked
          WHERE o.id = picked.id
          RETURNING o.*
        `,
        [
          Math.max(
            1,
            Math.min(
              Number(limit) ||
                10,
              50
            )
          ),
        ]
      );

    await client.query(
      'COMMIT'
    );

    return result.rows;
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

async function loadOrderContext(
  item
) {
  const result = await pool.query(
    `
      SELECT
        so.codigo_os,
        so.estado::text AS estado,
        CASE
          WHEN c.tipo_persona =
            'juridica'
          THEN c.razon_social
          ELSE CONCAT_WS(
            ' ',
            c.primer_nombre,
            c.primer_apellido
          )
        END AS client_name,
        c.documento AS client_document,
        c.telefono AS client_phone,
        c.email AS client_email,
        d.receiver_name,
        d.receiver_document,
        d.receiver_phone,
        d.delivered_at
      FROM service_orders so
      LEFT JOIN clients c
        ON c.id =
          so.client_id
      LEFT JOIN service_order_deliveries d
        ON d.service_order_id =
          so.id
      WHERE so.id = $1
      LIMIT 1
    `,
    [
      item.service_order_id,
    ]
  );

  return result.rows[0] ||
    {};
}

async function loadTemplates(
  eventType
) {
  const result = await pool.query(
    `
      SELECT
        id,
        template_key,
        event_type,
        channel,
        name,
        subject_template,
        body_template,
        version
      FROM service_notification_templates
      WHERE event_type = $1
        AND active = TRUE
      ORDER BY
        channel ASC,
        template_key ASC
    `,
    [eventType]
  );

  return result.rows;
}

function scalarContext(
  source = {}
) {
  const result = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      source || {}
    )
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      result[key] = '';
      continue;
    }

    if (
      typeof value ===
        'object'
    ) {
      continue;
    }

    result[key] =
      String(value);
  }

  return result;
}

function renderTemplate(
  template,
  context
) {
  const replace =
    (text) =>
      text === null ||
      text === undefined
        ? null
        : String(text).replace(
            /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
            (
              _match,
              key
            ) =>
              Object.prototype.hasOwnProperty.call(
                context,
                key
              )
                ? String(
                    context[key] ??
                      ''
                  )
                : ''
          );

  return {
    id:
      template.id,
    template_key:
      template.template_key,
    channel:
      template.channel,
    name:
      template.name,
    version:
      template.version,
    subject:
      replace(
        template.subject_template
      ),
    body:
      replace(
        template.body_template
      ),
  };
}

async function buildWebhookEnvelope(
  item
) {
  const [
    orderContext,
    templates,
  ] = await Promise.all([
    loadOrderContext(
      item
    ),
    loadTemplates(
      item.event_type
    ),
  ]);

  const context = {
    ...scalarContext(
      orderContext
    ),
    ...scalarContext(
      item.payload || {}
    ),
  };

  return {
    source:
      'servicio-tecnico',
    event:
      item.event_type,
    service_order_id:
      item.service_order_id,
    idempotency_key:
      item.idempotency_key,
    created_at:
      item.created_at,
    context,
    payload:
      item.payload || {},
    messages:
      templates.map(
        (template) =>
          renderTemplate(
            template,
            context
          )
      ),
  };
}

async function sendWebhook(
  item
) {
  const webhookUrl =
    getWebhookUrl();

  if (!webhookUrl) {
    const error =
      new Error(
        'SERVICE_NOTIFICATIONS_WEBHOOK_URL no esta configurado'
      );
    error.code =
      'WEBHOOK_NOT_CONFIGURED';
    throw error;
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      getWebhookTimeoutMs()
    );

  try {
    const envelope =
      await buildWebhookEnvelope(
        item
      );

    const response =
      await fetch(
        webhookUrl,
        {
          method:
            'POST',
          headers: {
            'Content-Type':
              'application/json',
            'X-TN-Event':
              item.event_type,
            'X-TN-Idempotency-Key':
              item.idempotency_key,
          },
          body:
            JSON.stringify(
              envelope
            ),
          signal:
            controller.signal,
        }
      );

    const text =
      await response.text();

    if (
      !response.ok
    ) {
      const error =
        new Error(
          `Webhook HTTP ${response.status}: ${text.slice(
            0,
            600
          )}`
        );

      error.status =
        response.status;

      throw error;
    }

    return {
      ok: true,
      response_status:
        response.status,
      response_excerpt:
        text.slice(
          0,
          600
        ),
    };
  } finally {
    clearTimeout(
      timer
    );
  }
}

async function markSent(
  id
) {
  await pool.query(
    `
      UPDATE service_notification_outbox
      SET status = 'sent',
          last_error = NULL,
          next_attempt_at = NULL,
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

async function markFailed(
  item,
  error
) {
  const delayMinutes =
    Math.min(
      1440,
      Math.max(
        5,
        5 *
          Math.pow(
            2,
            Math.min(
              Number(
                item.attempts ||
                  1
              ) - 1,
              8
            )
          )
      )
    );

  await pool.query(
    `
      UPDATE service_notification_outbox
      SET status = 'failed',
          last_error = $2,
          next_attempt_at =
            NOW() +
            ($3::text ||
              ' minutes')::interval,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      item.id,
      String(
        error?.message ||
          error ||
          'Error desconocido'
      ).slice(
        0,
        4000
      ),
      String(
        delayMinutes
      ),
    ]
  );
}

async function requeueItem(
  id
) {
  const result =
    await pool.query(
      `
        UPDATE service_notification_outbox
        SET status = 'pending',
            next_attempt_at = NOW(),
            last_error = NULL,
            updated_at = NOW()
        WHERE id = $1
          AND status IN (
            'failed',
            'pending'
          )
        RETURNING *
      `,
      [id]
    );

  return result.rows[0] ||
    null;
}

async function processOutbox(
  {
    limit = 10,
  } = {}
) {
  if (
    !isConfigured()
  ) {
    return {
      configured: false,
      processed: 0,
      sent: 0,
      failed: 0,
      recovered: 0,
      message:
        'SERVICE_NOTIFICATIONS_WEBHOOK_URL no esta configurado. La cola permanece pendiente.',
    };
  }

  const recovered =
    await recoverStuckItems();

  const items =
    await claimBatch(
      limit
    );

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await sendWebhook(
        item
      );

      await markSent(
        item.id
      );

      sent += 1;
    } catch (error) {
      await markFailed(
        item,
        error
      );

      failed += 1;
    }
  }

  return {
    configured: true,
    processed:
      items.length,
    sent,
    failed,
    recovered,
  };
}

module.exports = {
  enqueueNotification,
  isConfigured,
  processOutbox,
  requeueItem,
  buildWebhookEnvelope,
};
