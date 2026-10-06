"use strict";
async function saveOrderSite(db,orderId,site,actor){
 if(!site)return;
 await db.query('UPDATE service_orders SET service_site=$1::jsonb WHERE id=$2',[JSON.stringify(site),orderId]);
 if(['remote','local','workshop'].includes(site.mode)){await db.query('DELETE FROM service_order_geofences WHERE service_order_id=$1',[orderId]);return;}
 await db.query(`INSERT INTO service_order_geofences(service_order_id,latitude,longitude,radius_m,created_by,updated_by,created_at,updated_at)
 VALUES($1,$2,$3,$4,$5,$5,NOW(),NOW()) ON CONFLICT(service_order_id) DO UPDATE SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,radius_m=EXCLUDED.radius_m,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
 [orderId,site.latitude,site.longitude,site.radius_m,actor]);
}
async function hydrateLocalClient(db,id,profile){
 await db.query(`UPDATE clients SET telefono=COALESCE(NULLIF(telefono,''),$2),email=COALESCE(NULLIF(email,''),$3),
 direccion=COALESCE(NULLIF(direccion,''),$4),ciudad=COALESCE(NULLIF(ciudad,''),$5),"updatedAt"=NOW() WHERE id=$1`,
 [id,profile.telefono?String(profile.telefono):null,profile.email?String(profile.email):null,profile.direccion?String(profile.direccion):null,profile.ciudad?String(profile.ciudad):null]);
}
module.exports={saveOrderSite,hydrateLocalClient};
