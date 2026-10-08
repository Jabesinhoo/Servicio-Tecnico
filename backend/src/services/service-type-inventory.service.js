"use strict";
function validateRequirements(value) {
 if (!Array.isArray(value) || value.length > 100) throw Object.assign(new Error('Selecciona hasta 100 artículos de inventario.'), {status:400});
 const seen = new Set();
 return value.map(item => {
 const id = String(item?.product_id || ''); const quantity = Number(item?.quantity);
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || seen.has(id.toLowerCase())) throw Object.assign(new Error('Cada artículo debe ser único y tener una cantidad entera positiva.'), {status:400});
 seen.add(id.toLowerCase());return {product_id:id,quantity};
 });
}
async function readRequirements(client, ids) {
 const result=await client.query(`SELECT r.service_type_id,r.product_id,r.quantity,p.codigo,p.nombre,p.stock_actual,p.estado,p.imagenes->0 AS photo,w.kind FROM service_type_inventory_requirements r JOIN products p ON p.id=r.product_id LEFT JOIN workshop_catalog w ON w.product_id=p.id WHERE r.service_type_id=ANY($1::uuid[]) ORDER BY p.nombre`,[ids]);
 return result.rows;
}
async function saveRequirements(client,id,value) {
 const items=validateRequirements(value);
 if(items.length){const result=await client.query('SELECT id FROM products WHERE id=ANY($1::uuid[]) AND estado=true FOR SHARE',[items.map(i=>i.product_id)]);if(result.rows.length!==items.length)throw Object.assign(new Error('Uno de los artículos ya no está disponible en el catálogo.'),{status:400});}
 await client.query('DELETE FROM service_type_inventory_requirements WHERE service_type_id=$1',[id]);
 for(const item of items)await client.query('INSERT INTO service_type_inventory_requirements(service_type_id,product_id,quantity) VALUES($1,$2,$3)',[id,item.product_id,item.quantity]);
 return readRequirements(client,[id]);
}
module.exports={validateRequirements,readRequirements,saveRequirements};
