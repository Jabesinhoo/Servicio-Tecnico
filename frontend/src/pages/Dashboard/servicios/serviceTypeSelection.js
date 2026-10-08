export function summarizeServiceTypes(types){
 const inventory=new Map();for(const type of types)for(const item of type.inventory_requirements||[]){const previous=inventory.get(item.product_id);inventory.set(item.product_id,{...item,quantity:Number(item.quantity)+(previous?.quantity||0)});}
 return {service_type_ids:types.map(t=>t.id),service_type_id:types[0]?.id||'',service_type_name:types.map(t=>t.nombre).join(' + '),service_type_category:types.map(t=>t.categoria).filter(Boolean).join(', '),base_value:types.reduce((n,t)=>n+Number(t.valor_base||0),0),estimated_minutes:types.reduce((n,t)=>n+Number(t.duracion_estimada||60),0),estimated_duration:types.reduce((n,t)=>n+Number(t.duracion_estimada||60),0),inventory_requirements:[...inventory.values()]};
}
