'use strict';

const { randomUUID } = require('crypto');

const TIME_ZONE = 'America/Bogota';
const SLOT_MINUTES = Math.max(
  5,
  Number(process.env.AUTO_SCHEDULE_SLOT_MINUTES || 15)
);
const SEARCH_DAYS = Math.min(
  90,
  Math.max(
    7,
    Number(process.env.AUTO_SCHEDULE_SEARCH_DAYS || 45)
  )
);

function cleanTechnicianIds(ids) {
  return [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
}

function timeToMinutes(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToTime(total) {
  const normalized = Math.max(0, Math.min(1439, total));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(dateText) {
  return new Date(`${dateText}T12:00:00Z`).getUTCDay();
}

function toBogotaIso(dateText, timeText) {
  return `${dateText}T${String(timeText).slice(0, 8)}-05:00`;
}

async function getBogotaNow(client) {
  const result = await client.query(`
    SELECT
      TO_CHAR(
        CURRENT_TIMESTAMP AT TIME ZONE '${TIME_ZONE}',
        'YYYY-MM-DD'
      ) AS local_date,
      TO_CHAR(
        CURRENT_TIMESTAMP AT TIME ZONE '${TIME_ZONE}',
        'HH24:MI:SS'
      ) AS local_time
  `);

  return result.rows[0];
}

async function getTeamForOrder(client, orderId) {
  const result = await client.query(
    `
      SELECT
        tm.technician_id,
        tm.member_role
      FROM service_order_team_members tm
      WHERE tm.service_order_id = $1
        AND tm.member_status <> 'removed'
      ORDER BY
        CASE tm.member_role
          WHEN 'primary' THEN 0
          ELSE 1
        END,
        tm.added_at ASC
    `,
    [orderId]
  );

  if (result.rows.length > 0) {
    return result.rows;
  }

  const fallback = await client.query(
    `
      SELECT
        tecnico_id AS technician_id,
        'primary'::varchar AS member_role
      FROM service_orders
      WHERE id = $1
        AND tecnico_id IS NOT NULL
      LIMIT 1
    `,
    [orderId]
  );

  return fallback.rows;
}

async function lockTechnicians(client, technicianIds) {
  const ids = cleanTechnicianIds(technicianIds);
  if (!ids.length) return;

  await client.query(
    `
      SELECT id
      FROM usuarios
      WHERE id = ANY($1::uuid[])
      ORDER BY id
      FOR UPDATE
    `,
    [ids]
  );
}

async function getWorkingWindow(
  client,
  technicianIds,
  dateText
) {
  const ids = cleanTechnicianIds(technicianIds);

  if (!ids.length) return null;

  const dow = dayOfWeek(dateText);

  const result = await client.query(
    `
      SELECT
        tecnico_id,
        MIN(hora_inicio) AS hora_inicio,
        MAX(hora_fin) AS hora_fin
      FROM tecnicos_horarios
      WHERE tecnico_id = ANY($1::uuid[])
        AND dia_semana = $2
        AND activo = TRUE
      GROUP BY tecnico_id
    `,
    [ids, dow]
  );

  if (result.rows.length !== ids.length) {
    return null;
  }

  const starts = result.rows
    .map((row) => timeToMinutes(row.hora_inicio))
    .filter(Number.isFinite);
  const ends = result.rows
    .map((row) => timeToMinutes(row.hora_fin))
    .filter(Number.isFinite);

  if (
    starts.length !== ids.length ||
    ends.length !== ids.length
  ) {
    return null;
  }

  const commonStart = Math.max(...starts);
  const commonEnd = Math.min(...ends);

  if (commonEnd <= commonStart) return null;

  return {
    startMinutes: commonStart,
    endMinutes: commonEnd,
  };
}

async function anyTechnicianRunningNow(
  client,
  technicianIds
) {
  const ids = cleanTechnicianIds(technicianIds);
  if (!ids.length) return false;

  const result = await client.query(
    `
      SELECT 1
      FROM service_orders so
      LEFT JOIN service_order_team_members tm
        ON tm.service_order_id = so.id
       AND tm.member_status <> 'removed'
      WHERE so.estado::text = 'en_ejecucion'
        AND (
          so.tecnico_id = ANY($1::uuid[])
          OR tm.technician_id = ANY($1::uuid[])
        )
      LIMIT 1
    `,
    [ids]
  );

  return Boolean(result.rows[0]);
}

async function hasConflict(
  client,
  technicianIds,
  startIso,
  endIso,
  excludeOrderId = null
) {
  const ids = cleanTechnicianIds(technicianIds);

  const result = await client.query(
    `
      SELECT 1
      FROM service_order_schedule_blocks b
      WHERE b.technician_id = ANY($1::uuid[])
        AND b.status = 'active'
        AND ($4::uuid IS NULL OR b.service_order_id <> $4)
        AND b.start_at < $3::timestamptz
        AND b.end_at > $2::timestamptz
      LIMIT 1
    `,
    [
      ids,
      startIso,
      endIso,
      excludeOrderId,
    ]
  );

  return Boolean(result.rows[0]);
}

async function replaceBlocks(
  client,
  {
    orderId,
    team,
    startIso,
    endIso,
    actorUserId,
    source,
  }
) {
  await client.query(
    `
      UPDATE service_order_schedule_blocks
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE service_order_id = $1
        AND status = 'active'
    `,
    [orderId]
  );

  for (const member of team) {
    await client.query(
      `
        INSERT INTO service_order_schedule_blocks (
          id,
          service_order_id,
          technician_id,
          block_role,
          start_at,
          end_at,
          status,
          source,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,
          'active',$7,$8,NOW(),NOW()
        )
      `,
      [
        randomUUID(),
        orderId,
        member.technician_id,
        member.member_role || 'support',
        startIso,
        endIso,
        source || 'auto',
        actorUserId || null,
      ]
    );
  }
}

async function scheduleOrderAutomatically(
  client,
  {
    orderId,
    actorUserId = null,
    replaceExisting = false,
  }
) {
  const orderResult = await client.query(
    `
      SELECT
        id,
        codigo_os,
        duracion_estimada,
        fecha_agendada,
        hora_inicio_agendada
      FROM service_orders
      WHERE id = $1
      FOR UPDATE
    `,
    [orderId]
  );

  const order = orderResult.rows[0];

  if (!order) {
    const error = new Error('Orden de servicio no encontrada');
    error.code = 'ORDER_NOT_FOUND';
    throw error;
  }

  const existing = await client.query(
    `
      SELECT
        MIN(start_at) AS start_at,
        MAX(end_at) AS end_at,
        COUNT(*)::int AS total
      FROM service_order_schedule_blocks
      WHERE service_order_id = $1
        AND status = 'active'
    `,
    [orderId]
  );

  if (
    Number(existing.rows[0]?.total || 0) > 0 &&
    !replaceExisting
  ) {
    return {
      scheduled: true,
      reused: true,
      start_at: existing.rows[0].start_at,
      end_at: existing.rows[0].end_at,
    };
  }

  const team = await getTeamForOrder(client, orderId);

  if (!team.length) {
    const error = new Error(
      'La orden no tiene técnicos seleccionados'
    );
    error.code = 'TEAM_REQUIRED_FOR_SCHEDULE';
    throw error;
  }

  const technicianIds = cleanTechnicianIds(
    team.map((member) => member.technician_id)
  );

  await lockTechnicians(client, technicianIds);

  const duration = Math.max(
    SLOT_MINUTES,
    Number(order.duracion_estimada || 60)
  );

  const now = await getBogotaNow(client);
  const runningToday = await anyTechnicianRunningNow(
    client,
    technicianIds
  );

  for (let offset = 0; offset < SEARCH_DAYS; offset += 1) {
    const dateText = addDays(now.local_date, offset);

    if (offset === 0 && runningToday) {
      continue;
    }

    const window = await getWorkingWindow(
      client,
      technicianIds,
      dateText
    );

    if (!window) continue;

    let candidateStart = window.startMinutes;

    if (offset === 0) {
      const nowMinutes = timeToMinutes(now.local_time);
      candidateStart = Math.max(
        candidateStart,
        roundUp(nowMinutes + 5, SLOT_MINUTES)
      );
    }

    for (
      let minute = roundUp(candidateStart, SLOT_MINUTES);
      minute + duration <= window.endMinutes;
      minute += SLOT_MINUTES
    ) {
      const startTime = minutesToTime(minute);
      const endTime = minutesToTime(minute + duration);

      const startIso = toBogotaIso(dateText, startTime);
      const endIso = toBogotaIso(dateText, endTime);

      const conflict = await hasConflict(
        client,
        technicianIds,
        startIso,
        endIso,
        orderId
      );

      if (conflict) continue;

      await replaceBlocks(client, {
        orderId,
        team,
        startIso,
        endIso,
        actorUserId,
        source: 'auto',
      });

      await client.query(
        `
          UPDATE service_orders
          SET fecha_agendada = $1::date,
              hora_inicio_agendada = $2::time,
              duracion_estimada = $3,
              "updatedAt" = NOW()
          WHERE id = $4
        `,
        [
          dateText,
          startTime,
          duration,
          orderId,
        ]
      );

      return {
        scheduled: true,
        reused: false,
        date: dateText,
        time: startTime,
        duration_minutes: duration,
        start_at: startIso,
        end_at: endIso,
        technician_ids: technicianIds,
      };
    }
  }

  const error = new Error(
    `No encontré un espacio común disponible para los ${technicianIds.length} técnico(s) en los próximos ${SEARCH_DAYS} días. Revisa sus horarios o carga de agenda.`
  );
  error.code = 'NO_COMMON_SLOT';
  throw error;
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
  const team = await getTeamForOrder(client, orderId);

  if (!team.length) {
    const error = new Error(
      'La orden no tiene equipo técnico'
    );
    error.code = 'TEAM_REQUIRED_FOR_SCHEDULE';
    throw error;
  }

  const technicianIds = cleanTechnicianIds(
    team.map((member) => member.technician_id)
  );

  await lockTechnicians(client, technicianIds);

  const duration = Math.max(
    SLOT_MINUTES,
    Number(durationMinutes || 60)
  );

  const startMinute = timeToMinutes(timeText);
  if (!Number.isFinite(startMinute)) {
    const error = new Error('Hora no válida');
    error.code = 'INVALID_SCHEDULE_TIME';
    throw error;
  }

  const window = await getWorkingWindow(
    client,
    technicianIds,
    dateText
  );

  if (!window) {
    const error = new Error(
      'Uno o más técnicos no tienen horario laboral común ese día'
    );
    error.code = 'NO_COMMON_WORK_WINDOW';
    throw error;
  }

  if (
    startMinute < window.startMinutes ||
    startMinute + duration > window.endMinutes
  ) {
    const error = new Error(
      'El servicio quedaría por fuera del horario común del equipo'
    );
    error.code = 'OUTSIDE_WORK_HOURS';
    throw error;
  }

  const startTime = minutesToTime(startMinute);
  const endTime = minutesToTime(startMinute + duration);
  const startIso = toBogotaIso(dateText, startTime);
  const endIso = toBogotaIso(dateText, endTime);

  if (
    await hasConflict(
      client,
      technicianIds,
      startIso,
      endIso,
      orderId
    )
  ) {
    const error = new Error(
      'Uno o más técnicos ya tienen otro servicio en ese horario'
    );
    error.code = 'SCHEDULE_CONFLICT';
    throw error;
  }

  await replaceBlocks(client, {
    orderId,
    team,
    startIso,
    endIso,
    actorUserId,
    source: 'manual',
  });

  await client.query(
    `
      UPDATE service_orders
      SET fecha_agendada = $1::date,
          hora_inicio_agendada = $2::time,
          duracion_estimada = $3,
          "updatedAt" = NOW()
      WHERE id = $4
    `,
    [
      dateText,
      startTime,
      duration,
      orderId,
    ]
  );

  return {
    scheduled: true,
    date: dateText,
    time: startTime,
    duration_minutes: duration,
    start_at: startIso,
    end_at: endIso,
    technician_ids: technicianIds,
  };
}

module.exports = {
  getTeamForOrder,
  scheduleOrderAutomatically,
  rescheduleOrderAt,
};
