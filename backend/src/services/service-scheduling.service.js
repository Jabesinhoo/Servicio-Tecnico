'use strict';

const { randomUUID } = require('crypto');

const TZ = 'America/Bogota';
const SEARCH_DAYS = 45;
const SLOT_MINUTES = 15;
const {chooseFreeSlot}=require('../domain/service-free-calendar');

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
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s)) {
    const e = new Error('Hora programada no válida');
    e.code = 'INVALID_SCHEDULE';
    throw e;
  }
  return s.length === 5 ? `${s}:00` : s;
}

async function getOrderAndTeam(client, orderId) {
  const orderResult = await client.query(
    `SELECT id, codigo_os, estado, tecnico_id,
            duracion_estimada, fecha_agendada::text AS fecha_agendada, hora_inicio_agendada
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
  const typed = await client.query(`SELECT SUM(COALESCE(ss.estimated_minutes,ts.duracion_estimada))::int AS minutes FROM service_order_services ss JOIN tipos_servicio ts ON ts.id=ss.tipo_servicio_id WHERE ss.service_order_id=$1`,[orderId]);
  if(Number(typed.rows[0]?.minutes)>0) order.duracion_estimada=Number(typed.rows[0].minutes);


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

  for(const id of [...new Set(team.map(m=>m.technician_id))].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))',['schedule:'+id]);
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

async function findCommonSlot(client,ids,start,duration,orderId){const r=await client.query(`SELECT technician_id,start_at,end_at FROM service_order_schedule_blocks WHERE technician_id=ANY($1::uuid[]) AND status='active' AND service_order_id<>$2 AND end_at>$3::timestamptz AND start_at<$3::timestamptz+interval '45 days'`,[ids,orderId,start]);const slot=chooseFreeSlot({start,duration,ids,busy:r.rows});if(!slot)throw Object.assign(new Error('No hay un intervalo libre para todo el equipo que permita completar la duración del servicio en los próximos 45 días.'),{code:'NO_COMMON_SLOT',status:409});return slot;}
async function assertExecutionWindow(client,orderId){const {order,team}=await getOrderAndTeam(client,orderId);const ids=team.map(m=>m.technician_id);const r=await client.query(`SELECT now() AS start_at, COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at,now())-started_at))/60),0) AS elapsed FROM service_execution_sessions WHERE service_order_id=$1`,[orderId]);const duration=normalizeDuration(order.duracion_estimada);const remaining=Math.max(1,duration-Number(r.rows[0].elapsed));const start=r.rows[0].start_at;const end=new Date(new Date(start).getTime()+remaining*60000).toISOString();const planned=await client.query(`SELECT MIN(start_at) AS start_at FROM service_order_schedule_blocks WHERE service_order_id=$1 AND status='active'`,[orderId]);if(!planned.rows[0].start_at)throw Object.assign(new Error('Programa el servicio en Agenda antes de iniciarlo.'),{code:'SCHEDULE_REQUIRED',status:409});if(planned.rows[0].start_at && new Date(start)<new Date(planned.rows[0].start_at))throw Object.assign(new Error('El turno programado todavía no ha comenzado. Revisa la agenda en hora de Colombia.'),{code:'SCHEDULE_NOT_STARTED',status:409});if((await conflicts(client,ids,start,end,orderId)).length)throw Object.assign(new Error('El tiempo restante se cruza con otro servicio; reprograma la orden.'),{code:'SCHEDULE_CONFLICT',status:409});await client.query(`UPDATE service_order_schedule_blocks SET start_at=LEAST(start_at,$2::timestamptz),end_at=$3::timestamptz,updated_at=now() WHERE service_order_id=$1 AND status='active'`,[orderId,start,end]);return{duration_minutes:duration,remaining_minutes:remaining};}

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
       ($1::timestamptz AT TIME ZONE $2::text)::date::text AS date_local,
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

    if (dateText >= todayText) {
      const ts = await bogotaTimestamp(client, dateText, order.hora_inicio_agendada || '08:00:00');
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
  const { order, team } = await getOrderAndTeam(client, orderId);
  const duration = normalizeDuration(order.duracion_estimada, 60);
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
  assertExecutionWindow,
};
