"use strict";
const pool = require('../db/pool');
const fs = require('fs/promises');
const path = require('path');
const {randomUUID} = require('crypto');
const {MAX_BYTES, validateFile} = require('../domain/service-acceptance-file');
const DIR = path.resolve(__dirname, '../../storage/service-acceptance');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = 'id, original_name, mime_type, byte_size, created_at';
async function access(db, req, write=false) {
 if (!UUID.test(req.params.intakeId)) throw Object.assign(new Error('Solicitud no válida'), {status:400});
 const {rows} = await db.query(`SELECT * FROM service_order_intakes WHERE id=$1 ${write?'FOR UPDATE':''}`, [req.params.intakeId]);
 const intake = rows[0];
 if (!intake) throw Object.assign(new Error('Solicitud no encontrada'), {status:404});
 const role = req.user?.role?.name || req.user?.rol;
 if (role==='admin' || (role==='tecnico' && intake.created_by===req.user.id)) return intake;
 if (!write && role==='tecnico' && intake.service_order_id) {
  const team = await db.query(`SELECT 1 FROM service_order_team_members WHERE service_order_id=$1 AND technician_id=$2 AND member_status IN ('assigned','accepted','active')
  UNION ALL SELECT 1 FROM service_orders WHERE id=$1 AND tecnico_id=$2`, [intake.service_order_id, req.user.id]);
  if (team.rowCount) return intake;
 }
 throw Object.assign(new Error('No tienes acceso a estas evidencias'), {status:403});
}
const fail = (res,e) => { if(!e.status) console.error('Acceptance evidence:',e); res.status(e.status||500).json({message:e.status?e.message:'No se pudo procesar la evidencia'}); };
exports.list = async(req,res) => {try {await access(pool,req); const r=await pool.query(`SELECT ${fields} FROM service_intake_acceptance_evidences WHERE intake_id=$1 ORDER BY created_at`,[req.params.intakeId]);res.json({data:r.rows});}catch(e){fail(res,e);}};
exports.upload = async(req,res) => {
 let db, disk;
 try {
  const key=req.query.upload_key;
  if (!UUID.test(key||'')) throw Object.assign(new Error('Identificador de archivo no válido'),{status:400});
  db=await pool.connect(); await db.query('BEGIN'); await access(db,req,true);
  const old=await db.query(`SELECT ${fields} FROM service_intake_acceptance_evidences WHERE intake_id=$1 AND upload_key=$2`,[req.params.intakeId,key]);
  if(old.rowCount){await db.query('COMMIT'); return res.json({data:old.rows[0]});}
  const count=await db.query('SELECT count(*)::int AS n FROM service_intake_acceptance_evidences WHERE intake_id=$1',[req.params.intakeId]);
  if(count.rows[0].n>=5) throw Object.assign(new Error('Máximo 5 adjuntos por solicitud'),{status:400});
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>MAX_BYTES)throw Object.assign(new Error('Máximo 25 MB por archivo'),{status:413});chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);const meta=validateFile(req.query.name,bytes);
  const id=randomUUID(); const storage=id+meta.extension;
  await fs.mkdir(DIR,{recursive:true});disk=path.join(DIR,storage);await fs.writeFile(disk,bytes,{flag:'wx'});
  const r=await db.query(`INSERT INTO service_intake_acceptance_evidences(id,intake_id,created_by,original_name,mime_type,byte_size,storage_name,upload_key)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${fields}`,[id,req.params.intakeId,req.user.id,meta.safeName,meta.mime,bytes.length,storage,key]);
  await db.query('COMMIT');disk=null;res.status(201).json({data:r.rows[0]});
 }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});if(disk)await fs.unlink(disk).catch(()=>{});fail(res,e);}finally{db?.release();}
};
exports.download=async(req,res)=>{try{
 await access(pool,req);
 if(!UUID.test(req.params.evidenceId))throw Object.assign(new Error('Archivo no válido'),{status:400});
 const r=await pool.query('SELECT * FROM service_intake_acceptance_evidences WHERE id=$1 AND intake_id=$2',[req.params.evidenceId,req.params.intakeId]);
 const file=r.rows[0];if(!file)throw Object.assign(new Error('Archivo no encontrado'),{status:404});
 if(path.basename(file.storage_name)!==file.storage_name)throw new Error('Invalid storage path');
 await fs.access(path.join(DIR,file.storage_name));res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','private, no-store');
 res.download(path.join(DIR,file.storage_name),file.original_name);
}catch(e){if(e.code==='ENOENT')e=Object.assign(new Error('El archivo no está disponible'),{status:404});fail(res,e);}};
