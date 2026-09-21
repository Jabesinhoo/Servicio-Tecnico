const path = require('path');

const root = process.argv[2] || process.cwd();

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(root, 'backend', '.env') });

const pool = require(path.join(root, 'backend', 'src', 'db', 'pool'));

(async () => {
  const client = await pool.connect();

  try {
    const schema = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name IN (
          'service_orders',
          'service_order_intakes',
          'service_order_schedule_blocks',
          'service_order_team_members',
          'servicio_materiales'
        )
      ORDER BY table_name, ordinal_position
    `);

    console.log('\\n=== ESQUEMA SERVICIO V7 ===');
    console.table(schema.rows);

    const conflicts = await client.query(`
      SELECT a.technician_id,
             a.service_order_id AS os_a,
             b.service_order_id AS os_b,
             a.start_at AS inicio_a,
             a.end_at AS fin_a,
             b.start_at AS inicio_b,
             b.end_at AS fin_b
      FROM service_order_schedule_blocks a
      JOIN service_order_schedule_blocks b
        ON b.technician_id = a.technician_id
       AND b.id <> a.id
       AND b.status='active'
       AND a.status='active'
       AND a.start_at < b.end_at
       AND a.end_at > b.start_at
       AND a.id::text < b.id::text
      LIMIT 50
    `);

    console.log('\\n=== SOLAPAMIENTOS ACTIVOS ===');
    if (!conflicts.rows.length) {
      console.log('OK: no hay solapamientos activos.');
    } else {
      console.table(conflicts.rows);
    }

    const recent = await client.query(`
      SELECT so.codigo_os,
             so.estado,
             so.fecha_agendada,
             so.hora_inicio_agendada,
             so.duracion_estimada,
             COUNT(b.id)::int AS bloques_activos
      FROM service_orders so
      LEFT JOIN service_order_schedule_blocks b
        ON b.service_order_id=so.id
       AND b.status='active'
      GROUP BY so.id
      ORDER BY so."createdAt" DESC
      LIMIT 15
    `);

    console.log('\\n=== ÚLTIMAS OS Y AGENDA ===');
    console.table(recent.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
