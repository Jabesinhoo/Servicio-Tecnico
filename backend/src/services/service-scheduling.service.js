'use strict';

const { randomUUID } = require('crypto');

const TZ = 'America/Bogota';
const SEARCH_DAYS = 45;
const SLOT_MINUTES = 15;

function normalizeDuration(value, fallback = 60) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.round(n), 1440);
}

function validDate(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const e = new Error('Fecha programada no válida');
    e.code = 'INVALID_SCHEDULE';
    throw e;
  }
  return s;
}

function validTime(value) {
  const s = String(value || '').trim();
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(s)) {
    const e = new Error('Hora programada no válida');
    e.code = 'INVALID_SCHEDULE';
    throw e;
  }
  return s.length === 5 ? `${s}:00` : s;
}

async function getOrderAndTeam(client, orderId) {
  const orderResult = await client.query(
    `SELECT id, codigo_os, estado, tecnico_id,
            duracion_estimada, fecha_agendada, hora_inicio_agendada
     FROM service_orders
     WHERE id = $1
     FOR UPDATE`,
    [orderId]
  );

  if (!orderResult.rows[0]) {
    const e = new Error('Orden de servicio no encontrada');
    e.code = 'ORDER_NOT_FOUND';
    throw e;
  }

  const order = orderResult.rows[0];

  const teamResult = await client.query(
    `SELECT technician_id, member_role
     FROM service_order_team_members
     WHERE service_order_id = $1
       AND member_status <> 'removed'
     ORDER BY CASE member_role WHEN 'primary' THEN 0 ELSE 1 END, added_at ASC`,
    [orderId]
  );

  let team = teamResult.rows;

  if (!team.length && order.tecnico_id) {
    team = [{ technician_id: order.tecnico_id, member_role: 'primary' }];
  }

  if (!team.length) {
    const e = new Error('La orden no tiene técnicos asignados.');
    e.code = 'TEAM_REQUIRED_FOR_SCHEDULE';
    throw e;
  }

  return { order, team };
}

async function bogotaTimestamp(client, dateText, timeText) {
  const date = validDate(dateText);
  const time = validTime(timeText);

  const r = await client.query(
    `SELECT make_timestamptz(
       split_part($1, '-', 1)::int,
       split_part($1, '-', 2)::int,
       split_part($1, '-', 3)::int,
       split_part($2, ':', 1)::int,
       split_part($2, ':', 2)::int,
       split_part($2, ':', 3)::int,
       $3
     ) AS start_at`,
    [date, time, TZ]
  );

  return r.rows[0].start_at;
}

async function ensureFuture(client, startAt) {
  const r = await client.query(
    `SELECT $1::timestamptz > NOW() AS ok`,
    [startAt]
  );
  if (!r.rows[0]?.ok) {
    const e = new Error(
      'No se puede programar un servicio en una fecha u hora pasada.'
    );
    e.code = 'PAST_SCHEDULE';
    throw e;
  }
}

async function conflicts(client, technicianIds, startAt, endAt, orderId) {
  const r = await client.query(
    `SELECT technician_id, start_at, end_at, service_order_id
     FROM service_order_schedule_blocks
     WHERE technician_id = ANY($1::uuid[])
       AND status = 'active'
       AND start_at < $2::timestamptz
       AND end_at > $3::timestamptz
       AND service_order_id <> $4
     ORDER BY start_at`,
    [technicianIds, endAt, startAt, orderId]
  );
  return r.rows;
}

async function findCommonSlot(
  client,
  technicianIds,
  initialStart,
  durationMinutes,
  orderId
) {
  let cursor = new Date(initialStart);
  const limit = Date.now() + SEARCH_DAYS * 86400000;

  while (cursor.getTime() < limit) {
    const end = new Date(
      cursor.getTime() + durationMinutes * 60000
    );

    const busy = await conflicts(
      client,
      technicianIds,
      cursor.toISOString(),
      end.toISOString(),
      orderId
    );

    if (!busy.length) {
      return {
        startAt: cursor.toISOString(),
        endAt: end.toISOString(),
      };
    }

    const latestEnd = Math.max(
      ...busy.map((row) => new Date(row.end_at).getTime())
    );

    cursor = new Date(
      Math.ceil(latestEnd / (SLOT_MINUTES * 60000)) *
        SLOT_MINUTES *
        60000
    );
  }

  const e = new Error(
    `No encontré un espacio común disponible para los ${technicianIds.length} técnico(s) en los próximos ${SEARCH_DAYS} días.`
  );
  e.code = 'NO_COMMON_SLOT';
  throw e;
}

async function persistSchedule(
  client,
  {
    orderId,
    team,
    startAt,
    endAt,
    durationMinutes,
    actorUserId,
    source,
  }
) {
  const technicianIds = team.map((m) => m.technician_id);

  await client.query(
    `UPDATE service_order_schedule_blocks
     SET status = 'cancelled',
         updated_at = NOW()
     WHERE service_order_id = $1
       AND status = 'active'`,
    [orderId]
  );

  const busy = await conflicts(
    client,
    technicianIds,
    startAt,
    endAt,
    orderId
  );

  if (busy.length) {
    const e = new Error(
      'Uno o más técnicos ya están ocupados en ese intervalo.'
    );
    e.code = 'SCHEDULE_CONFLICT';
    throw e;
  }

  for (const member of team) {
    await client.query(
      `INSERT INTO service_order_schedule_blocks (
         id, service_order_id, technician_id,
         block_role, start_at, end_at,
         status, source, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,
               'active',$7,NOW(),NOW())`,
      [
        randomUUID(),
        orderId,
        member.technician_id,
        member.member_role === 'primary' ? 'primary' : 'support',
        startAt,
        endAt,
        source,
      ]
    );
  }

  const local = await client.query(
    `SELECT
       ($1::timestamptz AT TIME ZONE $2::text)::date AS date_local,
       ($1::timestamptz AT TIME ZONE $2::text)::time AS time_local`,
    [startAt, TZ]
  );

  await client.query(
    `UPDATE service_orders
     SET fecha_agendada = $1::date,
         hora_inicio_agendada = $2::time,
         duracion_estimada = $3,
         "updatedAt" = NOW()
     WHERE id = $4`,
    [
      local.rows[0].date_local,
      local.rows[0].time_local,
      durationMinutes,
      orderId,
    ]
  );

  return {
    order_id: orderId,
    technician_ids: technicianIds,
    start_at: startAt,
    end_at: endAt,
    duration_minutes: durationMinutes,
    source,
    actor_user_id: actorUserId || null,
  };
}

async function scheduleOrderAutomatically(
  client,
  { orderId, actorUserId = null, replaceExisting = true }
) {
  const { order, team } = await getOrderAndTeam(client, orderId);
  const duration = normalizeDuration(order.duracion_estimada, 60);
  const technicianIds = team.map((m) => m.technician_id);

  if (replaceExisting) {
    await client.query(
      `UPDATE service_order_schedule_blocks
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE service_order_id = $1
         AND status = 'active'`,
      [orderId]
    );
  }

  let initialMs = Date.now();

  if (order.fecha_agendada) {
    const dateText = String(order.fecha_agendada).slice(0, 10);
    const today = await client.query(
      `SELECT (NOW() AT TIME ZONE $1)::date::text AS today`,
      [TZ]
    );
    const todayText = today.rows[0].today;

    if (dateText > todayText) {
      const ts = await bogotaTimestamp(client, dateText, '08:00:00');
      initialMs = Math.max(initialMs, new Date(ts).getTime());
    }
  }

  initialMs =
    Math.ceil(initialMs / (SLOT_MINUTES * 60000)) *
    SLOT_MINUTES *
    60000;

  const slot = await findCommonSlot(
    client,
    technicianIds,
    new Date(initialMs).toISOString(),
    duration,
    orderId
  );

  const result = await persistSchedule(client, {
    orderId,
    team,
    startAt: slot.startAt,
    endAt: slot.endAt,
    durationMinutes: duration,
    actorUserId,
    source: 'auto',
  });

  await client.query(
    `INSERT INTO service_order_events (
       id, service_order_id, event_type,
       actor_user_id, metadata, created_at
     )
     VALUES ($1,$2,'service_auto_scheduled',$3,$4::jsonb,NOW())`,
    [
      randomUUID(),
      orderId,
      actorUserId || null,
      JSON.stringify(result),
    ]
  );

  return result;
}

async function rescheduleOrderAt(
  client,
  {
    orderId,
    dateText,
    timeText,
    durationMinutes,
    actorUserId = null,
  }
) {
  const { team } = await getOrderAndTeam(client, orderId);
  const duration = normalizeDuration(durationMinutes, 60);
  const startAt = await bogotaTimestamp(client, dateText, timeText);

  await ensureFuture(client, startAt);

  const end = await client.query(
    `SELECT $1::timestamptz +
            ($2::int * INTERVAL '1 minute') AS end_at`,
    [startAt, duration]
  );

  const result = await persistSchedule(client, {
    orderId,
    team,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(end.rows[0].end_at).toISOString(),
    durationMinutes: duration,
    actorUserId,
    source: 'manual',
  });

  await client.query(
    `INSERT INTO service_order_events (
       id, service_order_id, event_type,
       actor_user_id, metadata, created_at
     )
     VALUES ($1,$2,'service_manual_scheduled',$3,$4::jsonb,NOW())`,
    [
      randomUUID(),
      orderId,
      actorUserId || null,
      JSON.stringify(result),
    ]
  );

  return result;
}

module.exports = {
  scheduleOrderAutomatically,
  rescheduleOrderAt,
};
