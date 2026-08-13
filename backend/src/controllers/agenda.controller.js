// backend/src/controllers/agenda.controller.js
const pool = require('../db/pool');

// Obtener horarios de trabajo de un técnico
exports.getHorarioTecnico = async (req, res) => {
  try {
    const { tecnico_id } = req.params;
    const result = await pool.query(`
      SELECT * FROM tecnicos_horarios 
      WHERE tecnico_id = $1 AND activo = true
      ORDER BY dia_semana, hora_inicio
    `, [tecnico_id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al obtener horarios' });
  }
};

// Configurar horario de un técnico
exports.setHorarioTecnico = async (req, res) => {
  try {
    const { tecnico_id } = req.params;
    const { horarios } = req.body; // Array de {dia_semana, hora_inicio, hora_fin}

    // Eliminar horarios existentes
    await pool.query(`DELETE FROM tecnicos_horarios WHERE tecnico_id = $1`, [tecnico_id]);

    // Insertar nuevos horarios
    for (const horario of horarios) {
      await pool.query(`
        INSERT INTO tecnicos_horarios (tecnico_id, dia_semana, hora_inicio, hora_fin)
        VALUES ($1, $2, $3, $4)
      `, [tecnico_id, horario.dia_semana, horario.hora_inicio, horario.hora_fin]);
    }

    res.json({ message: 'Horarios guardados correctamente' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al guardar horarios' });
  }
};

// Obtener eventos del calendario (servicios agendados)
// Obtener eventos del calendario (servicios agendados)
exports.getEventos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, tecnico_id } = req.query;

    let query = `
      SELECT
        so.id,
        so.codigo_os,
        so.estado,
        so.descripcion_inicial,
        so.fecha_agendada,
        so.hora_inicio_agendada,
        so.duracion_estimada,

        c.razon_social AS cliente_nombre,

        u.id AS tecnico_id,
        u.nombre1 AS tecnico_nombre,
        u.apellidos AS tecnico_apellidos,

        CASE
          WHEN c.tipo_persona = 'juridica'
            THEN c.razon_social
          ELSE
            TRIM(
              CONCAT(
                COALESCE(c.primer_nombre, ''),
                ' ',
                COALESCE(c.primer_apellido, '')
              )
            )
        END AS cliente_nombre_completo

      FROM service_orders so

      LEFT JOIN clients c
        ON so.client_id = c.id

      LEFT JOIN usuarios u
        ON so.tecnico_id = u.id

      WHERE so.fecha_agendada IS NOT NULL
        AND so.estado::text NOT IN ('cerrada', 'cancelada')
        AND (
          $1::date IS NULL
          OR so.fecha_agendada >= $1::date
        )
        AND (
          $2::date IS NULL
          OR so.fecha_agendada < ($2::date + INTERVAL '1 day')
        )
    `;

    const params = [
      fechaInicio || null,
      fechaFin || null
    ];

    let paramIndex = 3;

    if (tecnico_id) {
      query += ` AND so.tecnico_id = $${paramIndex}`;
      params.push(tecnico_id);
    }

    query += `
      ORDER BY
        so.fecha_agendada ASC,
        so.hora_inicio_agendada ASC
    `;

    const result = await pool.query(query, params);

    const eventos = result.rows.map(evento => {
      const fechaEvento =
        evento.fecha_agendada instanceof Date
          ? evento.fecha_agendada
          : new Date(evento.fecha_agendada);

      const fechaTexto = fechaEvento
        .toISOString()
        .split('T')[0];

      const horaInicio =
        evento.hora_inicio_agendada || '08:00';

      return {
        id: evento.id,

        title: `${evento.codigo_os} - ${evento.cliente_nombre_completo ||
          evento.cliente_nombre ||
          'Cliente'
          }`,

        start: `${fechaTexto}T${horaInicio}`,

        end: calcularHoraFin(
          fechaEvento,
          horaInicio,
          evento.duracion_estimada || 60
        ),

        backgroundColor: getColorPorEstado(
          evento.estado
        ),

        extendedProps: {
          estado: evento.estado,
          codigo_os: evento.codigo_os,
          cliente:
            evento.cliente_nombre_completo ||
            evento.cliente_nombre ||
            'Cliente',

          descripcion:
            evento.descripcion_inicial,

          tecnico_id:
            evento.tecnico_id,

          tecnico_nombre:
            `${evento.tecnico_nombre || ''} ${evento.tecnico_apellidos || ''
              }`.trim(),

          duracion:
            evento.duracion_estimada
        }
      };
    });

    res.json(eventos);

  } catch (error) {
    console.error(
      'Error al obtener eventos de agenda:',
      error
    );

    res.status(500).json({
      message: 'Error al obtener eventos',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined
    });
  }
};
// Obtener disponibilidad de técnicos para una fecha
exports.getDisponibilidad = async (req, res) => {
  try {
    const { fecha, tecnico_id } = req.query;

    if (!fecha) {
      return res.status(400).json({ message: 'Fecha requerida' });
    }

    // Obtener técnicos activos
    let tecnicosQuery = `
      SELECT id, nombre1, apellidos, usuario 
      FROM usuarios 
      WHERE rol = 'tecnico' AND activo = true
    `;
    const tecnicosParams = [];

    if (tecnico_id) {
      tecnicosQuery += ` AND id = $1`;
      tecnicosParams.push(tecnico_id);
    }

    const tecnicos = await pool.query(tecnicosQuery, tecnicosParams);

    // Para cada técnico, obtener sus horarios y servicios agendados en la fecha
    const disponibilidad = [];

    for (const tecnico of tecnicos.rows) {
      // Obtener día de la semana (0=Domingo)
      const diaSemana = new Date(fecha).getDay();

      // Obtener horario de trabajo
      const horario = await pool.query(`
        SELECT hora_inicio, hora_fin 
        FROM tecnicos_horarios 
        WHERE tecnico_id = $1 AND dia_semana = $2 AND activo = true
      `, [tecnico.id, diaSemana]);

      if (horario.rows.length === 0) {
        disponibilidad.push({
          tecnico_id: tecnico.id,
          tecnico_nombre: `${tecnico.nombre1} ${tecnico.apellidos || ''}`,
          disponible: false,
          motivo: 'Sin horario configurado',
          horarios_ocupados: []
        });
        continue;
      }

      // Obtener servicios agendados en esa fecha
      const servicios = await pool.query(`
        SELECT hora_inicio_agendada, duracion_estimada, codigo_os
        FROM service_orders
WHERE tecnico_id = $1
  AND DATE(fecha_agendada) = $2
  AND estado::text NOT IN ('cerrada', 'cancelada')
      `, [tecnico.id, fecha]);

      // Calcular horarios ocupados
      const horariosOcupados = servicios.rows.map(s => ({
        inicio: s.hora_inicio_agendada,
        fin: calcularHoraFin(fecha, s.hora_inicio_agendada, s.duracion_estimada || 60),
        servicio: s.codigo_os
      }));

      disponibilidad.push({
        tecnico_id: tecnico.id,
        tecnico_nombre: `${tecnico.nombre1} ${tecnico.apellidos || ''}`,
        disponible: true,
        horario_laboral: {
          inicio: horario.rows[0].hora_inicio,
          fin: horario.rows[0].hora_fin
        },
        horarios_ocupados: horariosOcupados,
        servicios_count: servicios.rows.length
      });
    }

    res.json(disponibilidad);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al obtener disponibilidad' });
  }
};

// Agendar un servicio
exports.agendarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_agendada, hora_inicio, duracion_estimada } = req.body;

    const result = await pool.query(`
      UPDATE service_orders 
      SET fecha_agendada = $1,
          hora_inicio_agendada = $2,
          duracion_estimada = COALESCE($3, duracion_estimada),
          estado = 'asignada',
          "updatedAt" = NOW()
      WHERE id = $4
      RETURNING *
    `, [fecha_agendada, hora_inicio, duracion_estimada, id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error al agendar servicio' });
  }
};

// Funciones auxiliares
function calcularHoraFin(fecha, horaInicio, duracionMinutos) {
  if (!fecha || !horaInicio) {
    return null;
  }

  const [horas, minutos] = String(horaInicio)
    .split(':')
    .map(Number);

  const fechaObj =
    fecha instanceof Date
      ? new Date(fecha)
      : new Date(fecha);

  fechaObj.setHours(
    horas,
    minutos + Number(duracionMinutos || 60),
    0,
    0
  );

  return fechaObj.toISOString();
}
function getColorPorEstado(estado) {
  const colores = {
    pendiente: '#f59e0b', // amarillo
    asignada: '#3b82f6',  // azul
    en_ejecucion: '#8b5cf6', // morado
    en_espera: '#ef4444', // rojo
    cerrada: '#10b981'    // verde
  };
  return colores[estado] || '#6b7280';
}