'use strict';

const pool = require('../db/pool');
const { randomUUID } = require('crypto');
const {
  SERVICE_ORDER_STATES,
  canTransition,
} = require('../domain/service-order-lifecycle');

const {
  scheduleOrderAutomatically,
} = require('../services/service-scheduling.service');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORK_TYPES = new Set([
  'work',
  'diagnostic',
  'installation',
  'test',
  'support',
  'note',
]);

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function cleanText(value, max = 5000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
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

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {}
}

async function addEvent(
  client,
  {
    serviceOrderId,
    eventType,
    actorUserId,
    metadata = null,
  }
) {
  try {
    await client.query(
      `
        INSERT INTO service_order_events (
          id,
          service_order_id,
          intake_id,
          event_type,
          actor_user_id,
          metadata,
          created_at
        )
        VALUES ($1,$2,NULL,$3,$4,$5::jsonb,NOW())
      `,
      [
        randomUUID(),
        serviceOrderId,
        eventType,
        actorUserId || null,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    // V10 requiere V9, pero no tumbamos una operación de equipo por
    // una bitácora ausente durante una instalación incompleta.
    if (error?.code !== '42P01') throw error;
  }
}

async function validateTechnicians(client, members) {
  const clean = [];
  const seen = new Set();
  let primaryCount = 0;

  for (const raw of Array.isArray(members) ? members : []) {
    const technicianId =
      raw?.technician_id || raw?.id || null;
    const memberRole =
      raw?.member_role === 'primary' ? 'primary' : 'support';

    if (!isUuid(technicianId) || seen.has(technicianId)) {
      continue;
    }

    seen.add(technicianId);

    if (memberRole === 'primary') {
      primaryCount += 1;
    }

    clean.push({
      technician_id: technicianId,
      member_role: memberRole,
    });
  }

  if (clean.length > 10) {
    const error = new Error(
      'Máximo 10 técnicos por orden de servicio'
    );
    error.code = 'TEAM_TOO_LARGE';
    throw error;
  }

  if (primaryCount > 1) {
    const error = new Error(
      'Solo puede existir un técnico responsable principal'
    );
    error.code = 'MULTIPLE_PRIMARY';
    throw error;
  }

  if (clean.length === 0) {
    return [];
  }

  const ids = clean.map((item) => item.technician_id);

  const result = await client.query(
    `
      SELECT
        u.id,
        u.activo,
        u.rol,
        r.name AS role_name
      FROM usuarios u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ANY($1::uuid[])
    `,
    [ids]
  );

  const validIds = new Set(
    result.rows
      .filter((row) => {
        const role = row.role_name || row.rol;
        return row.activo === true && role === 'tecnico';
      })
      .map((row) => row.id)
  );

  const invalid = ids.filter((id) => !validIds.has(id));

  if (invalid.length) {
    const error = new Error(
      'Uno o más técnicos no existen, están inactivos o no tienen rol técnico'
    );
    error.code = 'INVALID_TECHNICIAN';
    throw error;
  }

  return clean;
}

async function getOrder(client, id, lock = false) {
  const result = await client.query(
    `
      SELECT
        id,
        codigo_os,
        estado,
        tecnico_id,
        fecha_asignacion
      FROM service_orders
      WHERE id = $1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getLatestPrimaryAssignment(
  client,
  serviceOrderId,
  lock = false
) {
  const result = await client.query(
    `
      SELECT *
      FROM service_order_assignments
      WHERE service_order_id = $1
      ORDER BY assigned_at DESC, created_at DESC
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [serviceOrderId]
  );

  return result.rows[0] || null;
}

async function isTeamMember(client, orderId, userId) {
  const result = await client.query(
    `
      SELECT member_role, member_status
      FROM service_order_team_members
      WHERE service_order_id = $1
        AND technician_id = $2
        AND member_status = 'assigned'
      LIMIT 1
    `,
    [orderId, userId]
  );

  return result.rows[0] || null;
}

async function getTeamRows(client, orderId) {
  const result = await client.query(
    `
      SELECT
        tm.id,
        tm.service_order_id,
        tm.technician_id,
        tm.member_role,
        tm.member_status,
        tm.added_at,
        tm.assigned_at,
        tm.removed_at,
        tm.removal_note,
        u.nombre1,
        u.nombre2,
        u.apellidos,
        u.usuario,
        u.cedula,
        u.celular,
        u.email,
        u.activo
      FROM service_order_team_members tm
      JOIN usuarios u ON u.id = tm.technician_id
      WHERE tm.service_order_id = $1
        AND tm.member_status <> 'removed'
      ORDER BY
        CASE tm.member_role
          WHEN 'primary' THEN 0
          ELSE 1
        END,
        u.nombre1 ASC NULLS LAST,
        u.apellidos ASC NULLS LAST
    `,
    [orderId]
  );

  return result.rows;
}

async function applyTeam(
  client,
  order,
  members,
  actorUserId
) {
  const clean = await validateTechnicians(client, members);
  const incomingIds = new Set(
    clean.map((item) => item.technician_id)
  );

  const custodyResult = await client.query(
    `
      SELECT holder_user_id
      FROM service_order_current_custody
      WHERE service_order_id = $1
      LIMIT 1
    `,
    [order.id]
  ).catch((error) => {
    if (error?.code === '42P01') return { rows: [] };
    throw error;
  });

  const custodyHolder =
    custodyResult.rows[0]?.holder_user_id || null;

  const currentTeam = await getTeamRows(client, order.id);
  const currentPrimary = currentTeam.find(
    (item) => item.member_role === 'primary'
  );
  const newPrimary = clean.find(
    (item) => item.member_role === 'primary'
  );

  if (
    custodyHolder &&
    currentPrimary &&
    newPrimary &&
    currentPrimary.technician_id !==
      newPrimary.technician_id
  ) {
    const error = new Error(
      'No puedes cambiar el técnico principal mientras exista custodia activa'
    );
    error.code = 'PRIMARY_HAS_CUSTODY';
    throw error;
  }

  if (
    ['en_ejecucion', 'en_espera', 'cerrada'].includes(
      String(order.estado)
    ) &&
    currentPrimary &&
    newPrimary &&
    currentPrimary.technician_id !==
      newPrimary.technician_id
  ) {
    const error = new Error(
      'El técnico principal no puede cambiarse desde el equipo cuando el servicio ya inició. Usa el flujo de reasignación.'
    );
    error.code = 'PRIMARY_CHANGE_REQUIRES_REASSIGNMENT';
    throw error;
  }

  for (const existing of currentTeam) {
    if (!incomingIds.has(existing.technician_id)) {
      if (
        existing.member_role === 'primary' &&
        order.tecnico_id === existing.technician_id &&
        !['pendiente', 'aprobado'].includes(
          String(order.estado)
        )
      ) {
        const error = new Error(
          'No puedes retirar al técnico principal de una orden ya asignada. Reasigna primero el responsable.'
        );
        error.code = 'PRIMARY_REMOVAL_REQUIRES_REASSIGNMENT';
        throw error;
      }

      await client.query(
        `
          UPDATE service_order_team_members
          SET member_status = 'removed',
              removed_at = NOW(),
              removal_note = 'Retirado desde gestión de equipo',
              updated_at = NOW()
          WHERE id = $1
        `,
        [existing.id]
      );
    }
  }

  for (const member of clean) {
    const existing = currentTeam.find(
      (item) =>
        item.technician_id === member.technician_id
    );

    const desiredStatus =
      ['pendiente', 'aprobado'].includes(String(order.estado))
        ? 'planned'
        : 'assigned';

    if (existing) {
      await client.query(
        `
          UPDATE service_order_team_members
          SET member_role = $1,
              member_status = $2,
              assigned_at =
                CASE
                  WHEN $2 = 'assigned'
                  THEN COALESCE(assigned_at, NOW())
                  ELSE assigned_at
                END,
              removed_at = NULL,
              removal_note = NULL,
              updated_at = NOW()
          WHERE id = $3
        `,
        [
          member.member_role,
          desiredStatus,
          existing.id,
        ]
      );
    } else {
      await client.query(
        `
          INSERT INTO service_order_team_members (
            id,
            service_order_id,
            technician_id,
            member_role,
            member_status,
            added_by,
            added_at,
            assigned_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,NOW(),
            CASE WHEN $5 = 'assigned' THEN NOW() ELSE NULL END,
            NOW()
          )
        `,
        [
          randomUUID(),
          order.id,
          member.technician_id,
          member.member_role,
          desiredStatus,
          actorUserId || null,
        ]
      );
    }
  }

  return getTeamRows(client, order.id);
}

exports.getTeam = async (req, res) => {
  const client = await pool.connect();

  try {
    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    if (isTechnician(req)) {
      const membership = await isTeamMember(
        client,
        order.id,
        req.user.id
      );

      if (
        !membership &&
        order.tecnico_id !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'No perteneces al equipo de esta orden',
        });
      }
    } else if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado',
      });
    }

    const team = await getTeamRows(
      client,
      order.id
    );

    return res.json({
      success: true,
      data: team,
      primary_technician_id:
        team.find(
          (item) => item.member_role === 'primary'
        )?.technician_id || null,
    });
  } catch (error) {
    console.error('Error loading service team:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cargar el equipo técnico',
    });
  } finally {
    client.release();
  }
};

exports.updateTeam = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administración puede modificar el equipo técnico',
      });
    }

    if (!isUuid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const order = await getOrder(
      client,
      req.params.id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    if (
      ['cerrada', 'cancelado', 'rechazado'].includes(
        String(order.estado)
      )
    ) {
      await rollback(client);
      return res.status(409).json({
        success: false,
        message: 'El equipo de una orden terminal ya no puede modificarse',
      });
    }

    const team = await applyTeam(
      client,
      order,
      req.body?.members || [],
      req.user.id
    );

    let schedule = null;

    if (
      ['asignada', 'en_ejecucion', 'en_espera'].includes(
        String(order.estado)
      )
    ) {
      schedule = await scheduleOrderAutomatically(
        client,
        {
          orderId: order.id,
          actorUserId: req.user.id,
          replaceExisting: true,
        }
      );
    }

    await addEvent(client, {
      serviceOrderId: order.id,
      eventType: 'service_team_updated',
      actorUserId: req.user.id,
      metadata: {
        members: team.map((item) => ({
          technician_id: item.technician_id,
          role: item.member_role,
          status: item.member_status,
        })),
      },
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        schedule
          ? 'Equipo técnico actualizado y agenda recalculada'
          : 'Equipo técnico actualizado',
      data: team,
      schedule,
    });
  } catch (error) {
    await rollback(client);

    console.error('Error updating service team:', error);

    const known = new Set([
      'TEAM_TOO_LARGE',
      'MULTIPLE_PRIMARY',
      'INVALID_TECHNICIAN',
      'PRIMARY_HAS_CUSTODY',
      'PRIMARY_CHANGE_REQUIRES_REASSIGNMENT',
      'PRIMARY_REMOVAL_REQUIRES_REASSIGNMENT',
    ]);

    if (known.has(error?.code)) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (
      [
        'NO_COMMON_SLOT',
        'TEAM_REQUIRED_FOR_SCHEDULE',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el equipo técnico',
    });
  } finally {
    client.release();
  }
};

exports.approveAndAssign = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        message: 'Solo administración puede aprobar una orden',
      });
    }

    const { id } = req.params;
    const { observaciones } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({
        message: 'ID de orden no válido',
      });
    }

    await client.query('BEGIN');

    const order = await getOrder(
      client,
      id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        message: 'Orden no encontrada',
      });
    }

    if (
      !canTransition(
        order.estado,
        SERVICE_ORDER_STATES.APROBADO
      )
    ) {
      await rollback(client);
      return res.status(409).json({
        message:
          `No se puede aprobar una orden que está en estado "${order.estado}"`,
      });
    }

    const team = await getTeamRows(client, id);
    const primary = team.find(
      (item) =>
        item.member_role === 'primary' &&
        item.member_status !== 'removed'
    );

    const nextState = primary
      ? SERVICE_ORDER_STATES.ASIGNADA
      : SERVICE_ORDER_STATES.APROBADO;

    const result = await client.query(
      `
        UPDATE service_orders
        SET estado = $1,
            aprobado_por = $2,
            fecha_aprobacion = NOW(),
            observaciones = COALESCE($3, observaciones),
            tecnico_id = $4,
            fecha_asignacion =
              CASE WHEN $4::uuid IS NOT NULL THEN NOW()
              ELSE fecha_asignacion END,
            "updatedAt" = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        nextState,
        req.user.id,
        cleanText(observaciones, 3000),
        primary?.technician_id || null,
        id,
      ]
    );

    let assignment = null;

    if (primary) {
      await client.query(
        `
          UPDATE service_order_assignments
          SET status = 'revocada',
              updated_at = NOW()
          WHERE service_order_id = $1
            AND status = 'pendiente'
        `,
        [id]
      );

      const assignmentResult = await client.query(
        `
          INSERT INTO service_order_assignments (
            id,
            service_order_id,
            tecnico_id,
            assigned_by,
            status,
            assigned_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,'pendiente',
            NOW(),NOW(),NOW()
          )
          RETURNING *
        `,
        [
          randomUUID(),
          id,
          primary.technician_id,
          req.user.id,
        ]
      );

      assignment = assignmentResult.rows[0];

      await client.query(
        `
          UPDATE service_order_team_members
          SET member_status = 'assigned',
              assigned_at = COALESCE(assigned_at, NOW()),
              updated_at = NOW()
          WHERE service_order_id = $1
            AND member_status = 'planned'
        `,
        [id]
      );
    }

    let schedule = null;

    if (primary) {
      schedule = await scheduleOrderAutomatically(
        client,
        {
          orderId: id,
          actorUserId: req.user.id,
          replaceExisting: true,
        }
      );
    }

    await addEvent(client, {
      serviceOrderId: id,
      eventType: primary
        ? 'service_approved_and_team_assigned'
        : 'service_approved',
      actorUserId: req.user.id,
      metadata: {
        primary_technician_id:
          primary?.technician_id || null,
        team_size: team.length,
      },
    });

    await client.query('COMMIT');

    return res.json({
      ...result.rows[0],
      assignment,
      team_auto_assigned: Boolean(primary),
      team_size: team.length,
      schedule,
    });
  } catch (error) {
    await rollback(client);

    console.error('Error approving and assigning service:', error);

    if (
      [
        'NO_COMMON_SLOT',
        'TEAM_REQUIRED_FOR_SCHEDULE',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      message: 'Error al aprobar y asignar la orden',
    });
  } finally {
    client.release();
  }
};

exports.assignPrimary = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        message: 'Solo administración puede asignar técnico principal',
      });
    }

    const { id } = req.params;
    const technicianId = req.body?.tecnico_id;

    if (!isUuid(id) || !isUuid(technicianId)) {
      return res.status(400).json({
        message: 'Orden y técnico deben ser válidos',
      });
    }

    await client.query('BEGIN');

    const validTeam = await validateTechnicians(
      client,
      [
        {
          technician_id: technicianId,
          member_role: 'primary',
        },
      ]
    );

    if (!validTeam.length) {
      await rollback(client);
      return res.status(400).json({
        message: 'Técnico no válido',
      });
    }

    const order = await getOrder(
      client,
      id,
      true
    );

    if (!order) {
      await rollback(client);
      return res.status(404).json({
        message: 'Orden no encontrada',
      });
    }

    const latest = await getLatestPrimaryAssignment(
      client,
      id,
      true
    );

    const normalAllowed = canTransition(
      order.estado,
      SERVICE_ORDER_STATES.ASIGNADA
    );

    const reassignmentAllowed =
      order.estado === SERVICE_ORDER_STATES.ASIGNADA &&
      latest?.status === 'impedimento';

    if (!normalAllowed && !reassignmentAllowed) {
      await rollback(client);
      return res.status(409).json({
        message:
          `No se puede asignar/reasignar cuando la orden está en "${order.estado}"`,
      });
    }

    await client.query(
      `
        UPDATE service_order_assignments
        SET status = 'revocada',
            updated_at = NOW()
        WHERE service_order_id = $1
          AND status = 'pendiente'
      `,
      [id]
    );

    await client.query(
      `
        UPDATE service_order_team_members
        SET member_status = 'removed',
            removed_at = NOW(),
            removal_note = 'Reasignación de responsable principal',
            updated_at = NOW()
        WHERE service_order_id = $1
          AND member_role = 'primary'
          AND member_status <> 'removed'
      `,
      [id]
    );

    const existingMember = await client.query(
      `
        SELECT id
        FROM service_order_team_members
        WHERE service_order_id = $1
          AND technician_id = $2
        ORDER BY added_at DESC
        LIMIT 1
      `,
      [id, technicianId]
    );

    if (existingMember.rows[0]) {
      await client.query(
        `
          UPDATE service_order_team_members
          SET member_role = 'primary',
              member_status = 'assigned',
              assigned_at = NOW(),
              removed_at = NULL,
              removal_note = NULL,
              updated_at = NOW()
          WHERE id = $1
        `,
        [existingMember.rows[0].id]
      );
    } else {
      await client.query(
        `
          INSERT INTO service_order_team_members (
            id,
            service_order_id,
            technician_id,
            member_role,
            member_status,
            added_by,
            added_at,
            assigned_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,'primary','assigned',
            $4,NOW(),NOW(),NOW()
          )
        `,
        [
          randomUUID(),
          id,
          technicianId,
          req.user.id,
        ]
      );
    }

    const orderResult = await client.query(
      `
        UPDATE service_orders
        SET tecnico_id = $1,
            estado = $2,
            fecha_asignacion = NOW(),
            "updatedAt" = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [
        technicianId,
        SERVICE_ORDER_STATES.ASIGNADA,
        id,
      ]
    );

    const assignmentResult = await client.query(
      `
        INSERT INTO service_order_assignments (
          id,
          service_order_id,
          tecnico_id,
          assigned_by,
          status,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,'pendiente',
          NOW(),NOW(),NOW()
        )
        RETURNING *
      `,
      [
        randomUUID(),
        id,
        technicianId,
        req.user.id,
      ]
    );

    const schedule = await scheduleOrderAutomatically(
      client,
      {
        orderId: id,
        actorUserId: req.user.id,
        replaceExisting: true,
      }
    );

    await addEvent(client, {
      serviceOrderId: id,
      eventType: 'primary_technician_assigned',
      actorUserId: req.user.id,
      metadata: {
        technician_id: technicianId,
      },
    });

    await client.query('COMMIT');

    return res.json({
      ...orderResult.rows[0],
      assignment: assignmentResult.rows[0],
      schedule,
    });
  } catch (error) {
    await rollback(client);

    console.error('Error assigning primary technician:', error);

    if (
      [
        'NO_COMMON_SLOT',
        'TEAM_REQUIRED_FOR_SCHEDULE',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      message: 'Error al asignar técnico principal',
    });
  } finally {
    client.release();
  }
};

exports.getWorkLogs = async (req, res) => {
  const client = await pool.connect();

  try {
    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    if (isTechnician(req)) {
      const membership = await isTeamMember(
        client,
        order.id,
        req.user.id
      );

      if (
        !membership &&
        order.tecnico_id !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'No perteneces a esta orden',
        });
      }
    } else if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado',
      });
    }

    const result = await client.query(
      `
        SELECT
          wl.*,
          u.nombre1,
          u.nombre2,
          u.apellidos,
          u.usuario
        FROM service_order_work_logs wl
        JOIN usuarios u ON u.id = wl.technician_id
        WHERE wl.service_order_id = $1
        ORDER BY wl.created_at DESC
        LIMIT 250
      `,
      [order.id]
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error loading work logs:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cargar la bitácora técnica',
    });
  } finally {
    client.release();
  }
};

exports.addWorkLog = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isTechnician(req)) {
      return res.status(403).json({
        success: false,
        message: 'Solo técnicos pueden registrar actividades',
      });
    }

    const order = await getOrder(
      client,
      req.params.id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada',
      });
    }

    const membership = await isTeamMember(
      client,
      order.id,
      req.user.id
    );

    if (
      !membership &&
      order.tecnico_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No perteneces al equipo técnico de esta orden',
      });
    }

    if (String(order.estado) !== 'en_ejecucion') {
      return res.status(409).json({
        success: false,
        code: 'SERVICE_NOT_IN_EXECUTION',
        message:
          'Las actividades técnicas solo pueden registrarse mientras el servicio está en ejecución',
      });
    }

    const description = cleanText(
      req.body?.description,
      6000
    );

    const activityType =
      cleanText(req.body?.activity_type, 30) || 'work';

    const durationRaw = req.body?.duration_minutes;
    const duration =
      durationRaw === '' ||
      durationRaw === undefined ||
      durationRaw === null
        ? null
        : Number(durationRaw);

    const resultNote = cleanText(
      req.body?.result_note,
      4000
    );

    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Describe la actividad realizada',
      });
    }

    if (!WORK_TYPES.has(activityType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de actividad no válido',
      });
    }

    if (
      duration !== null &&
      (
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 1440
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'La duración debe estar entre 1 y 1440 minutos',
      });
    }

    const result = await client.query(
      `
        INSERT INTO service_order_work_logs (
          id,
          service_order_id,
          technician_id,
          activity_type,
          description,
          duration_minutes,
          result_note,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        RETURNING *
      `,
      [
        randomUUID(),
        order.id,
        req.user.id,
        activityType,
        description,
        duration,
        resultNote,
      ]
    );

    await addEvent(client, {
      serviceOrderId: order.id,
      eventType: 'technician_work_logged',
      actorUserId: req.user.id,
      metadata: {
        activity_type: activityType,
        duration_minutes: duration,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Actividad técnica registrada',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding work log:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al registrar la actividad técnica',
    });
  } finally {
    client.release();
  }
};
