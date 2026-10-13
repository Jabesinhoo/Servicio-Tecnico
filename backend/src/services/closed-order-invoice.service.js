'use strict';
const {randomUUID}=require('crypto');
const fail=(message,status)=>Object.assign(new Error(message),{status});
async function updateClosedInvoice(db,{current,body,userId,isAdmin},sourceProvider){
 if(!isAdmin)throw fail('Solo administración puede cambiar la factura de una orden finalizada.',403);
 if(current.estado!=='cerrada')throw fail('Esta operación corresponde a una orden cerrada.',409);
 if(Object.keys(body).some(key=>!['worldoffice_invoice','invoice_reference'].includes(key)))throw fail('En una orden finalizada solo se puede cambiar la factura. Los demás datos permanecen bloqueados.',400);
 const selected=body.worldoffice_invoice;
 if(!selected||typeof selected!=='object'||!selected.reference||!selected.source_company||!selected.source_id)throw fail('Busca y selecciona una factura de World Office.',400);
 const customer=(await db.query('SELECT documento,codigo_worldoffice FROM clients WHERE id=$1',[current.client_id])).rows[0];
 if(!customer)throw fail('Cliente de la orden no encontrado.',404);
 const source=await sourceProvider();
 const result=await source.query({invoiceReference:selected.reference,sourceCompany:selected.source_company,sourceId:selected.source_id,clientDocument:customer.documento,clientExternalId:customer.codigo_worldoffice});
 if(result.client_match_count!==1||result.rows?.length!==1)throw fail('La factura no corresponde inequívocamente al cliente de esta orden.',409);
 const record=result.rows[0],reference=record.invoice_reference;
 if(body.invoice_reference!==undefined&&body.invoice_reference!==reference)throw fail('La referencia no coincide con la factura seleccionada.',400);
 let intake=(await db.query('SELECT id FROM service_order_intakes WHERE service_order_id=$1 FOR UPDATE',[current.id])).rows[0];
 if(!intake){intake=(await db.query(`INSERT INTO service_order_intakes(id,client_id,created_by,service_order_id,status,invoice_reference)
 VALUES($1,$2,$3,$4,'activated',$5) RETURNING id`,[randomUUID(),current.client_id,userId,current.id,reference])).rows[0];}
 const previous=(await db.query('SELECT invoice_reference,record FROM service_intake_worldoffice_invoices WHERE intake_id=$1',[intake.id])).rows[0];
 if(previous&&(previous.record?.source_company!==record.source_company||previous.record?.source_id!==record.source_id))await db.query("DELETE FROM service_intake_creation_files WHERE intake_id=$1 AND kind='invoice_support'",[intake.id]);
 await db.query(`INSERT INTO service_intake_worldoffice_invoices(intake_id,mapping_id,invoice_reference,record,linked_by) VALUES($1,$2,$3,$4::jsonb,$5)
 ON CONFLICT(intake_id) DO UPDATE SET mapping_id=EXCLUDED.mapping_id,invoice_reference=EXCLUDED.invoice_reference,record=EXCLUDED.record,linked_by=EXCLUDED.linked_by,linked_at=now()`,[intake.id,source.id,reference,JSON.stringify(record),userId]);
 await db.query('UPDATE service_order_intakes SET invoice_reference=$1 WHERE id=$2',[reference,intake.id]);
 await db.query('UPDATE service_order_financial_controls SET invoice_reference=$1,updated_at=now() WHERE service_order_id=$2',[reference,current.id]);
 await db.query(`INSERT INTO service_order_events(id,service_order_id,event_type,actor_user_id,metadata,created_at)
 VALUES($1,$2,'service_order_updated',$3,$4::jsonb,now())`,[randomUUID(),current.id,userId,JSON.stringify({fields:['worldoffice_invoice'],summary:'Actualizó la factura de la orden cerrada',invoice_before:previous||null,invoice_after:{invoice_reference:reference,record},closed_order:true})]);
 return {...current,invoice_reference:reference,invoice:{reference,record}};
}
module.exports={updateClosedInvoice};
