// backend/src/controllers/tipo-servicio.controller.js
const pool = require('../db/pool');
const {readRequirements,saveRequirements}=require('../services/service-type-inventory.service');
async function enrich(rows,client=pool){if(!rows.length)return rows;const items=await readRequirements(client,rows.map(r=>r.id));return rows.map(r=>({...r,inventory_requirements:items.filter(i=>i.service_type_id===r.id)}));}
exports.inventoryCatalog=async(req,res)=>{try{const q=String(req.query.q||'').trim().slice(0,120);const r=await pool.query(`SELECT p.id AS product_id,p.codigo,p.nombre,p.stock_actual,p.imagenes->0 AS photo,w.kind FROM products p LEFT JOIN workshop_catalog w ON w.product_id=p.id WHERE p.estado=true AND (p.nombre ILIKE $1 OR p.codigo ILIKE $1) ORDER BY p.nombre LIMIT 50`,['%'+q+'%']);res.json(r.rows);}catch(e){res.status(500).json({message:'No se pudo consultar el inventario.'});}};

// Obtener todos los tipos de servicio
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tipos_servicio 
      ORDER BY nombre ASC
    `);
    res.json(await enrich(result.rows));
  } catch (error) {
    console.error('Error getting tipos servicio:', error);
    res.status(500).json({ message: 'Error al obtener los tipos de servicio' });
  }
};

// Obtener tipos de servicio activos
exports.getActivos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM tipos_servicio 
      WHERE activo = true 
      ORDER BY nombre ASC
    `);
    res.json(await enrich(result.rows));
  } catch (error) {
    console.error('Error getting active tipos servicio:', error);
    res.status(500).json({ message: 'Error al obtener los tipos de servicio' });
  }
};

// Obtener por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM tipos_servicio WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    res.json((await enrich(result.rows))[0]);
  } catch (error) {
    console.error('Error getting tipo servicio:', error);
    res.status(500).json({ message: 'Error al obtener el tipo de servicio' });
  }
};

// Crear tipo de servicio
exports.create = async (req, res) => {
  let client;
  try {
    const { nombre, descripcion, valor_base, duracion_estimada, 
            requiere_diagnostico, requiere_repuestos, requiere_aprobacion, 
            categoria, activo } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    
    if(!Number.isInteger(Number(duracion_estimada||60))||Number(duracion_estimada||60)<1||Number(duracion_estimada||60)>1440||!Number.isFinite(Number(valor_base||0))||Number(valor_base||0)<0)return res.status(400).json({message:'Indica una duración entera entre 1 y 1440 minutos y un valor no negativo.'});
    if(req.body.inventory_requirements!==undefined)require('../services/service-type-inventory.service').validateRequirements(req.body.inventory_requirements);
    client=await pool.connect();await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO tipos_servicio (
        id, nombre, descripcion, valor_base, duracion_estimada,
        requiere_diagnostico, requiere_repuestos, requiere_aprobacion,
        categoria, activo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *
    `, [nombre, descripcion, valor_base || 0, duracion_estimada || 60,
        requiere_diagnostico || false, requiere_repuestos || false, requiere_aprobacion || false,
        categoria, activo !== false]);
    
    if(req.body.inventory_requirements!==undefined)await saveRequirements(client,result.rows[0].id,req.body.inventory_requirements);
    const saved=(await enrich(result.rows,client))[0];await client.query('COMMIT');
    res.status(201).json(saved);
  } catch (error) {
    if(client)await client.query('ROLLBACK').catch(()=>{});
    if(error.status)return res.status(error.status).json({message:error.message});
    console.error('Error creating tipo servicio:', error);
    res.status(500).json({ message: 'Error al crear el tipo de servicio' });
  } finally {if(client)client.release();}
};

// Actualizar tipo de servicio
exports.update = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    if(req.body.duracion_estimada!==undefined&&(!Number.isInteger(Number(req.body.duracion_estimada))||Number(req.body.duracion_estimada)<1||Number(req.body.duracion_estimada)>1440))return res.status(400).json({message:'La duración debe ser un entero entre 1 y 1440 minutos.'});
    const { nombre, descripcion, valor_base, duracion_estimada, 
            requiere_diagnostico, requiere_repuestos, requiere_aprobacion, 
            categoria, activo } = req.body;
    
    if(req.body.inventory_requirements!==undefined)require('../services/service-type-inventory.service').validateRequirements(req.body.inventory_requirements);
    client=await pool.connect();await client.query('BEGIN');
    const result = await client.query(`
      UPDATE tipos_servicio 
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          valor_base = COALESCE($3, valor_base),
          duracion_estimada = COALESCE($4, duracion_estimada),
          requiere_diagnostico = COALESCE($5, requiere_diagnostico),
          requiere_repuestos = COALESCE($6, requiere_repuestos),
          requiere_aprobacion = COALESCE($7, requiere_aprobacion),
          categoria = COALESCE($8, categoria),
          activo = COALESCE($9, activo),
          "updatedAt" = NOW()
      WHERE id = $10
      RETURNING *
    `, [nombre, descripcion, valor_base, duracion_estimada,
        requiere_diagnostico, requiere_repuestos, requiere_aprobacion,
        categoria, activo, id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    if(req.body.inventory_requirements!==undefined)await saveRequirements(client,result.rows[0].id,req.body.inventory_requirements);
    const saved=(await enrich(result.rows,client))[0];await client.query('COMMIT');
    res.json(saved);
  } catch (error) {
    if(client)await client.query('ROLLBACK').catch(()=>{});
    if(error.status)return res.status(error.status).json({message:error.message});
    console.error('Error updating tipo servicio:', error);
    res.status(500).json({ message: 'Error al actualizar el tipo de servicio' });
  } finally {if(client)client.release();}
};


exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      DELETE FROM tipos_servicio WHERE id = $1 RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de servicio no encontrado' });
    }
    
    res.json({ message: 'Tipo de servicio eliminado permanentemente' });
  } catch (error) {
    console.error('Error deleting tipo servicio:', error);
    res.status(500).json({ message: 'Error al eliminar el tipo de servicio' });
  }
};