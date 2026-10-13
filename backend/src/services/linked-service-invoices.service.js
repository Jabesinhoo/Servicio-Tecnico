'use strict';
const {documents}=require('../domain/linked-service-finance');
async function loadLinkedInvoices(db){
 const rows=(await db.query(`
 SELECT 'worldoffice' AS source,wo.record,wo.invoice_reference,wo.linked_at,
 so.id AS service_order_id,so.codigo_os,so.client_id,so.tecnico_id,
 COALESCE(NULLIF(cl.razon_social,''),NULLIF(concat_ws(' ',cl.primer_nombre,cl.primer_apellido),''),'Sin cliente') AS client_name
 FROM service_intake_worldoffice_invoices wo JOIN service_order_intakes i ON i.id=wo.intake_id
 JOIN service_orders so ON so.id=i.service_order_id LEFT JOIN clients cl ON cl.id=so.client_id
 UNION ALL
 SELECT 'local' AS source,to_jsonb(bill) AS record,bill.numero_factura AS invoice_reference,bill.fecha_emision AS linked_at,
 so.id AS service_order_id,so.codigo_os,so.client_id,so.tecnico_id,
 COALESCE(NULLIF(cl.razon_social,''),NULLIF(concat_ws(' ',cl.primer_nombre,cl.primer_apellido),''),'Sin cliente') AS client_name
 FROM invoices bill JOIN service_orders so ON so.id=bill.service_order_id LEFT JOIN clients cl ON cl.id=so.client_id
 LIMIT 20001`)).rows;
 if(rows.length>20000)throw Object.assign(new Error('Hay más de 20.000 vínculos de facturas. Se requiere paginar antes de calcular el total completo.'),{status:400});
 return documents(rows);
}
module.exports={loadLinkedInvoices};
