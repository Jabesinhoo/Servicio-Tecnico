'use strict';

const pool = require('../db/pool');
const {
  rescheduleOrderAt,
} = require('../services/service-scheduling.service');

function getRole(req) {
  return req.user?.role?.name || req.user?.rol || null;
}

function isAdmin(req) {
  return getRole(req) === 'admin';
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : null;
}

function getColorPorEstado(estado) {
  const colores = {
    pendiente: '#f59e0b',
    aprobado: '#0284c7',
    asignada: '#2563eb',
    en_ejecucion: '#7c3aed',
    en_espera: '#dc2626',
    cerrada: '#059669',
    cancelado: '#64748b',
    rechazado: '#64748b',
  };

  return colores[String(estado)] || '#64748b';
}

// Obtener horarios de trabajo de un técnico
exports.getHorarioTecnico = async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT *
        FROM tecnicos_horarios
        WHERE tecnico_id = $1
          AND activo = TRUE
        ORDER BY dia_semana, hora_inicio
      `,
      [req.params.tecnico_id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error leyendo horarios:', error);
    return res.status(500).json({
      message: 'Error al obtener horarios',
    });
  }
};

// Configurar horario
exports.setHorarioTecnico = async (req, res) => {
  const client = await pool.connect();

  try {
    const horarios = Array.isArray(req.body?.horarios)
      ? req.body.horarios
      : [];

    await client.query('BEGIN');

    await client.query(
      `
        DELETE FROM tecnicos_horarios
        WHERE tecnico_id = $1
      `,
      [req.params.tecnico_id]
    );

    for (const horario of horarios) {
      await client.query(
        `
          INSERT INTO tecnicos_horarios (
            tecnico_id,
            dia_semana,
            hora_inicio,
            hora_fin,
            activo
          )
          VALUES ($1,$2,$3,$4,TRUE)
        `,
        [
          req.params.tecnico_id,
          horario.dia_semana,
          horario.hora_inicio,
          horario.hora_fin,
        ]
      );
    }

    await client.query('COMMIT');

    return res.json({
      message: 'Horarios guardados correctamente',
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error('Error guardando horarios:', error);

    return res.status(500).json({
      message: 'Error al guardar horarios',
    });
  } finally {
    client.release();
  }
};

// Eventos de agenda: un bloque por cada técnico participante.
exports.getEventos = async (req, res) => {
  try {
    const fechaInicio =
      normalizeDate(req.query?.fechaInicio);
    const fechaFin =
      normalizeDate(req.query?.fechaFin);
    const requestedTechnician =
      String(req.query?.tecnico_id || '').trim();

    const role = getRole(req);
    const ownTechnicianId =
      role === 'tecnico'
        ? req.user?.id
        : null;

    const technicianFilter =
      ownTechnicianId || requestedTechnician || null;

    const result = await pool.query(
      `
        SELECT
          b.id AS block_id,
          b.service_order_id,
          b.technician_id,
          b.block_role,
          b.start_at,
          b.end_at,
          so.codigo_os,
          so.estado,
          so.descripcion_inicial,
          CASE
            WHEN c.tipo_persona = 'juridica'
            THEN c.razon_social
            ELSE CONCAT_WS(
              ' ',
              c.primer_nombre,
              c.primer_apellido
            )
          END AS cliente_nombre,
          u.nombre1,
          u.nombre2,
          u.apellidos,
          u.usuario
        FROM service_order_schedule_blocks b
        JOIN service_orders so
          ON so.id = b.service_order_id
        LEFT JOIN clients c
          ON c.id = so.client_id
        JOIN usuarios u
          ON u.id = b.technician_id
        WHERE b.status IN (
            'active',
            'completed'
          )
          AND so.estado::text NOT IN (
            'cancelado',
            'rechazado'
          )
          AND (
            $1::date IS NULL
            OR (
              b.start_at AT TIME ZONE 'America/Bogota'
            )::date >= $1
          )
          AND (
            $2::date IS NULL
            OR (
              b.start_at AT TIME ZONE 'America/Bogota'
            )::date <= $2
          )
          AND (
            $3::uuid IS NULL
            OR b.technician_id = $3
          )
        ORDER BY b.start_at ASC
      `,
      [
        fechaInicio,
        fechaFin,
        technicianFilter || null,
      ]
    );

    const eventos = result.rows.map((row) => {
      const technicianName = [
        row.nombre1,
        row.nombre2,
        row.apellidos,
      ]
        .filter(Boolean)
        .join(' ') || row.usuario || 'Técnico';

      return {
        id: row.block_id,
        title:
          `${row.codigo_os} · ${technicianName}`,
        start: row.start_at,
        end: row.end_at,
        backgroundColor:
          getColorPorEstado(row.estado),
        borderColor:
          row.block_role === 'primary'
            ? '#0f172a'
            : '#64748b',
        extendedProps: {
          service_order_id: row.service_order_id,
          estado: row.estado,
          codigo_os: row.codigo_os,
          cliente: row.cliente_nombre,
          descripcion: row.descripcion_inicial,
          tecnico_id: row.technician_id,
          tecnico_nombre: technicianName,
          team_role: row.block_role,
        },
      };
    });

    return res.json(eventos);
  } catch (error) {
    console.error('Error leyendo agenda:', error);

    if (error?.code === '42P01') {
      return res.status(409).json({
        code: 'V11_TABLES_NOT_INSTALLED',
        message:
          'Falta ejecutar el SQL V11 de agenda automática',
      });
    }

    return res.status(500).json({
      message: 'Error al obtener eventos',
    });
  }
};

// Disponibilidad de técnicos en una fecha.
exports.getDisponibilidad = async (req, res) => {
  try {
    const fecha = normalizeDate(req.query?.fecha);
    const tecnicoId =
      String(req.query?.tecnico_id || '').trim();

    if (!fecha) {
      return res.status(400).json({
        message: 'Fecha requerida',
      });
    }

    const params = [];
    let techFilter = '';

    if (tecnicoId) {
      params.push(tecnicoId);
      techFilter = `AND u.id = $${params.length}`;
    }

    params.push(fecha);
    const dateParam = `$${params.length}`;

    const result = await pool.query(
      `
        SELECT
          u.id AS tecnico_id,
          CONCAT_WS(
            ' ',
            u.nombre1,
            u.apellidos
          ) AS tecnico_nombre,
          u.usuario,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'inicio', b.start_at,
                  'fin', b.end_at,
                  'servicio', so.codigo_os,
                  'estado', so.estado
                )
                ORDER BY b.start_at
              )
              FROM service_order_schedule_blocks b
              JOIN service_orders so
                ON so.id = b.service_order_id
              WHERE b.technician_id = u.id
                AND b.status = 'active'
                AND (
                  b.start_at AT TIME ZONE
                    'America/Bogota'
                )::date = ${dateParam}::date
                AND so.estado::text NOT IN (
                  'cerrada',
                  'cancelado',
                  'rechazado'
                )
            ),
            '[]'::jsonb
          ) AS horarios_ocupados,
          EXISTS (
            SELECT 1
            FROM service_orders running
            LEFT JOIN service_order_team_members tm
              ON tm.service_order_id = running.id
             AND tm.member_status <> 'removed'
            WHERE running.estado::text = 'en_ejecucion'
              AND (
                running.tecnico_id = u.id
                OR tm.technician_id = u.id
              )
          ) AS en_servicio_ahora
        FROM usuarios u
        LEFT JOIN roles r
          ON r.id = u.role_id
        WHERE u.activo = TRUE
          AND LOWER(
            COALESCE(
              r.name,
              u.rol::text,
              ''
            )
          ) = 'tecnico'
          ${techFilter}
        ORDER BY u.nombre1, u.apellidos
      `,
      params
    );

    return res.json(
      result.rows.map((row) => ({
        ...row,
        disponible:
          !row.en_servicio_ahora &&
          row.horarios_ocupados.length === 0,
        motivo:
          row.en_servicio_ahora
            ? 'Actualmente en servicio'
            : row.horarios_ocupados.length > 0
              ? 'Tiene servicios programados'
              : null,
      }))
    );
  } catch (error) {
    console.error(
      'Error leyendo disponibilidad:',
      error
    );

    return res.status(500).json({
      message: 'Error al obtener disponibilidad',
    });
  }
};

// Reprogramación manual desde agenda: mueve a TODO el equipo.
exports.agendarServicio = async (req, res) => {
  const client = await pool.connect();

  try {
    const fecha =
      normalizeDate(req.body?.fecha_agendada);
    const hora =
      String(req.body?.hora_inicio || '').slice(0, 5);
    const duracion =
      Number(req.body?.duracion_estimada || 60);

    if (
      !fecha ||
      !/^\d{2}:\d{2}$/.test(hora)
    ) {
      return res.status(400).json({
        message: 'Fecha u hora no válida',
      });
    }

    await client.query('BEGIN');

    const schedule = await rescheduleOrderAt(
      client,
      {
        orderId: req.params.id,
        dateText: fecha,
        timeText: hora,
        durationMinutes: duracion,
        actorUserId: req.user?.id || null,
      }
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message:
        'Servicio reprogramado para todo el equipo',
      data: schedule,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      'Error reprogramando servicio:',
      error
    );

    if (
      [
        'SCHEDULE_CONFLICT',
        'OUTSIDE_WORK_HOURS',
        'NO_COMMON_WORK_WINDOW',
        'TEAM_REQUIRED_FOR_SCHEDULE',
        'INVALID_SCHEDULE_TIME',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      message: 'Error al agendar servicio',
    });
  } finally {
    client.release();
  }
};
