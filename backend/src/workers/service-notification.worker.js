'use strict';

const os =
  require('os');

const fs =
  require('fs');

const path =
  require('path');

const envPath =
  path.resolve(
    __dirname,
    '../../.env'
  );

if (
  fs.existsSync(
    envPath
  )
) {
  require('dotenv').config({
    path:
      envPath,
  });
}

const requiredDbVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

const missingDbVars =
  requiredDbVars.filter(
    (key) =>
      typeof process.env[key] !==
        'string' ||
      process.env[key].length ===
        0
  );

if (
  missingDbVars.length >
  0
) {
  throw new Error(
    `Worker V15.1: faltan variables de base de datos: ${missingDbVars.join(', ')}. Se reviso ${envPath}.`
  );
}

const pool =
  require('../db/pool');

const {
  processOutbox,
} = require('../services/service-notification-outbox.service');

const {
  monitorSlaAlerts,
} = require('../services/service-sla-monitor.service');

const WORKER_NAME =
  'service-notification-worker';

const ADVISORY_LOCK_KEY =
  781542153;

const INTERVAL_MS =
  Math.max(
    15000,
    Number(
      process.env.SERVICE_NOTIFICATION_WORKER_INTERVAL_MS ||
        60000
    )
  );

const RUN_ONCE =
  process.argv.includes(
    '--once'
  );

let lockClient =
  null;

let stopping =
  false;

let timer =
  null;

async function acquireLock() {
  lockClient =
    await pool.connect();

  const result =
    await lockClient.query(
      `
        SELECT
          pg_try_advisory_lock(
            $1
          ) AS locked
      `,
      [
        ADVISORY_LOCK_KEY,
      ]
    );

  if (
    result.rows[0]
      ?.locked !== true
  ) {
    lockClient.release();
    lockClient = null;

    console.log(
      '[V15 WORKER] Ya existe otro worker activo para esta base de datos. No se inicia una segunda instancia.'
    );

    return false;
  }

  return true;
}

async function updateHeartbeat({
  status,
  result = null,
  error = null,
  started = false,
}) {
  await pool.query(
    `
      INSERT INTO service_worker_heartbeats (
        worker_name,
        host_name,
        process_id,
        started_at,
        heartbeat_at,
        last_run_at,
        last_status,
        last_result,
        last_error,
        updated_at
      )
      VALUES (
        $1,$2,$3,
        CASE
          WHEN $4::boolean
          THEN NOW()
          ELSE NULL
        END,
        NOW(),
        NOW(),
        $5,
        $6::jsonb,
        $7,
        NOW()
      )
      ON CONFLICT (
        worker_name
      )
      DO UPDATE SET
        host_name =
          EXCLUDED.host_name,
        process_id =
          EXCLUDED.process_id,
        started_at =
          CASE
            WHEN $4::boolean
            THEN NOW()
            ELSE
              COALESCE(
                service_worker_heartbeats.started_at,
                NOW()
              )
          END,
        heartbeat_at =
          NOW(),
        last_run_at =
          NOW(),
        last_status =
          EXCLUDED.last_status,
        last_result =
          EXCLUDED.last_result,
        last_error =
          EXCLUDED.last_error,
        updated_at =
          NOW()
    `,
    [
      WORKER_NAME,
      os.hostname(),
      process.pid,
      Boolean(
        started
      ),
      status,
      JSON.stringify(
        result || {}
      ),
      error
        ? String(
            error
          ).slice(
            0,
            4000
          )
        : null,
    ]
  );
}

async function runCycle() {
  const startedAt =
    Date.now();

  try {
    const sla =
      await monitorSlaAlerts();

    const outbox =
      await processOutbox({
        limit:
          Number(
            process.env.SERVICE_NOTIFICATION_WORKER_BATCH_SIZE ||
              20
          ),
      });

    const cycleResult = {
      duration_ms:
        Date.now() -
        startedAt,
      sla,
      outbox,
    };

    await updateHeartbeat({
      status:
        'ok',
      result:
        cycleResult,
    });

    console.log(
      '[V15 WORKER]',
      JSON.stringify(
        cycleResult
      )
    );
  } catch (error) {
    await updateHeartbeat({
      status:
        'error',
      error:
        error?.message ||
        error,
    });

    console.error(
      '[V15 WORKER] Error:',
      error
    );
  }
}

async function releaseLock() {
  if (!lockClient) {
    return;
  }

  try {
    await lockClient.query(
      `
        SELECT
          pg_advisory_unlock(
            $1
          )
      `,
      [
        ADVISORY_LOCK_KEY,
      ]
    );
  } catch (_) {}

  lockClient.release();
  lockClient = null;
}

async function shutdown(
  signal
) {
  if (stopping) {
    return;
  }

  stopping = true;

  if (timer) {
    clearTimeout(
      timer
    );
  }

  console.log(
    `[V15 WORKER] Cerrando por ${signal}...`
  );

  await releaseLock();

  try {
    await pool.end();
  } catch (_) {}

  process.exit(0);
}

async function scheduleNext() {
  if (stopping) {
    return;
  }

  await runCycle();

  if (
    RUN_ONCE
  ) {
    await releaseLock();

    try {
      await pool.end();
    } catch (_) {}

    process.exit(0);
  }

  timer = setTimeout(
    scheduleNext,
    INTERVAL_MS
  );
}

async function main() {
  const locked =
    await acquireLock();

  if (!locked) {
    try {
      await pool.end();
    } catch (_) {}

    return;
  }

  await updateHeartbeat({
    status:
      'starting',
    result: {
      interval_ms:
        INTERVAL_MS,
      run_once:
        RUN_ONCE,
    },
    started: true,
  });

  console.log(
    `[V15 WORKER] Iniciado PID ${process.pid}. Intervalo ${INTERVAL_MS} ms.`
  );

  await scheduleNext();
}

process.on(
  'SIGINT',
  () => shutdown(
    'SIGINT'
  )
);

process.on(
  'SIGTERM',
  () => shutdown(
    'SIGTERM'
  )
);

process.on(
  'unhandledRejection',
  (error) => {
    console.error(
      '[V15 WORKER] unhandledRejection:',
      error
    );
  }
);

main().catch(
  async (error) => {
    console.error(
      '[V15 WORKER] No pudo iniciar:',
      error
    );

    await releaseLock();

    try {
      await pool.end();
    } catch (_) {}

    process.exit(1);
  }
);
