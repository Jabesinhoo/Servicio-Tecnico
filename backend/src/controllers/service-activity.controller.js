'use strict';
const pool=require('../db/pool');const path=require('path');const fs=require('fs/promises');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function allowedOrder(req){
 if(!UUID.test(req.params.id))throw Object.assign(new Error('Orden no válida'),{status:400});
 const order=(await pool.query('SELECT id,client_id,tecnico_id FROM service_orders WHERE id=$1',[req.params.id])).rows[0];
 if(!order)throw Object.assign(new Error('Orden no encontrada'),{status:404});
 const admin=(req.user?.role?.name||req.user?.rol)==='admin';
 const access=admin||order.tecnico_id===req.user.id||(await pool.query(`SELECT 1 FROM service_order_intakes WHERE service_order_id=$1 AND created_by=$2
 UNION ALL SELECT 1 FROM service_order_team_members WHERE service_order_id=$1 AND technician_id=$2 AND member_status<>'removed' LIMIT 1`,[order.id,req.user.id])).rows.length>0;
 if(!access)throw Object.assign(new Error('No autorizado para consultar esta orden'),{status:403});return order;
}
exports.history=async(req,res)=>{try{const order=await allowedOrder(req);const offset=Math.max(0,Math.min(100000,Number.parseInt(req.query.offset,10)||0));const rows=await pool.query(`SELECT h.*,COALESCE(NULLIF(concat_ws(' ',u.nombre1,u.nombre2,u.apellidos),''),u.usuario,'Sistema') AS actor_name
 FROM service_order_activity_history h LEFT JOIN usuarios u ON u.id=h.actor_user_id WHERE h.service_order_id=$1 AND ($2::uuid IS NULL OR h.actor_user_id=$2::uuid)
 ORDER BY h.created_at DESC,h.id DESC LIMIT 101 OFFSET $3`,[order.id,UUID.test(req.query.actor||'')?req.query.actor:null,offset]);const actors=await pool.query(`SELECT DISTINCT h.actor_user_id,COALESCE(NULLIF(concat_ws(' ',u.nombre1,u.nombre2,u.apellidos),''),u.usuario,'Sistema') AS actor_name FROM service_order_activity_history h JOIN usuarios u ON u.id=h.actor_user_id WHERE h.service_order_id=$1 ORDER BY actor_name`,[order.id]);res.json({success:true,data:rows.rows.slice(0,100),has_more:rows.rows.length>100,actors:actors.rows});}catch(e){res.status(e.status||500).json({message:e.status?e.message:'No se pudo consultar el historial'});}};
exports.signatures=async(req,res)=>{try{const order=await allowedOrder(req);const rows=await pool.query(`SELECT s.id,s.service_order_id,s.source_table,s.signer_name,s.signer_document,s.signer_kind,s.captured_at,o.codigo_os FROM client_service_signatures s JOIN service_orders o ON o.id=s.service_order_id WHERE s.client_id=$1 ORDER BY s.captured_at DESC LIMIT 100`,[order.client_id]);res.json({success:true,data:rows.rows});}catch(e){res.status(e.status||500).json({message:e.status?e.message:'No se pudieron consultar las firmas'});}};
exports.signatureFile=async(req,res)=>{try{const order=await allowedOrder(req);if(!UUID.test(req.params.signatureId))return res.status(400).json({message:'Firma no válida'});
 const record=(await pool.query('SELECT signature_storage_path,mime_type FROM client_service_signatures WHERE id=$1 AND client_id=$2',[req.params.signatureId,order.client_id])).rows[0];if(!record)return res.status(404).json({message:'Firma no encontrada'});
 const root=path.resolve(process.env.SERVICE_EVIDENCE_DIR||path.resolve(__dirname,'../../uploads/service-orders'));const file=path.resolve(root,record.signature_storage_path);
 if(!file.startsWith(root+path.sep)||!['image/png','image/jpeg','image/webp'].includes(record.mime_type))return res.status(400).json({message:'Archivo de firma no válido'});
 await fs.access(file);res.setHeader('Content-Type',record.mime_type);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.sendFile(file);
 }catch(e){res.status(e.status||404).json({message:e.status?e.message:'La imagen de la firma no está disponible'});}};
