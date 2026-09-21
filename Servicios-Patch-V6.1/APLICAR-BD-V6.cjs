'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
if (!projectRoot) {
  console.error('Usage: node APLICAR-BD-V6.cjs <ProjectRoot>');
  process.exit(1);
}

require(path.join(projectRoot, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(projectRoot, 'backend', '.env'),
});

const pool = require(path.join(projectRoot, 'backend', 'src', 'db', 'pool'));
const sql = fs.readFileSync(
  path.join(__dirname, 'sql', '20260917-servicio-materiales-v19.sql'),
  'utf8'
);

(async () => {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('OK DB: servicio_materiales listo.');

    // Backfill seguro: las OS activadas antes de V6.1 podían tener intake
    // completo pero ningún registro en service_order_services.
    const backfill = await client.query(`
      INSERT INTO service_order_services (
        service_order_id,
        tipo_servicio_id,
        tipo_servicio_nombre,
        descripcion_problema,
        observaciones,
        precio_estimado,
        equipo_relacionado,
        requiere_diagnostico,
        requiere_repuestos,
        repuestos_necesarios,
        "createdAt",
        "updatedAt"
      )
      SELECT
        i.service_order_id,
        CASE
          WHEN NULLIF(BTRIM(i.service_type_id::text), '') ~*
               '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN i.service_type_id::uuid
          ELSE NULL
        END,
        NULLIF(BTRIM(i.service_type_name), ''),
        NULLIF(BTRIM(i.request_description), ''),
        NULLIF(BTRIM(i.scope_text), ''),
        i.base_value,
        NULL,
        (i.classification = 'diagnostic'),
        FALSE,
        NULL,
        NOW(),
        NOW()
      FROM service_order_intakes i
      WHERE i.service_order_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM service_order_services sos
          WHERE sos.service_order_id = i.service_order_id
        )
        AND (
          NULLIF(BTRIM(i.service_type_name), '') IS NOT NULL
          OR NULLIF(BTRIM(i.request_description), '') IS NOT NULL
        )
      RETURNING service_order_id
    `);

    console.log(`OK DB: ${backfill.rowCount} OS histórica(s) recuperaron detalle de servicio.`);
  } catch (error) {
    console.error('DB migration/backfill failed:', error.message);
    if (error.detail) console.error(error.detail);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
