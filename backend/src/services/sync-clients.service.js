// backend/src/services/sync-clients.service.js
const syncMelissaClients = async () => {
  const melissaClients = await getClientesFromMelissa();
  
  for (const mc of melissaClients) {
    await pool.query(`
      INSERT INTO clients (
        id, tipo_persona, documento, razon_social, primer_nombre, 
        primer_apellido, telefono, email, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (documento) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        primer_nombre = EXCLUDED.primer_nombre,
        primer_apellido = EXCLUDED.primer_apellido,
        telefono = EXCLUDED.telefono,
        email = EXCLUDED.email,
        activo = EXCLUDED.activo
    `, [
      mc.id,
      mc.tipo_persona || 'natural',
      mc.documento,
      mc.razon_social,
      mc.primer_nombre,
      mc.primer_apellido,
      mc.telefono,
      mc.email,
      true
    ]);
  }
};