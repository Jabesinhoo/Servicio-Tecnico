BEGIN;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS tecnico_id uuid REFERENCES usuarios(id);
-- Existing active blocks are the authoritative reservation; recover calendar fields from them.
UPDATE service_orders so SET fecha_agendada=(b.start_at AT TIME ZONE 'America/Bogota')::date,hora_inicio_agendada=(b.start_at AT TIME ZONE 'America/Bogota')::time,"updatedAt"=NOW()
FROM (SELECT service_order_id,MIN(start_at) start_at FROM service_order_schedule_blocks WHERE status='active' GROUP BY service_order_id) b
WHERE so.id=b.service_order_id AND so.fecha_agendada IS NULL;
CREATE OR REPLACE FUNCTION record_service_activity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r JSONB; old_r JSONB:='{}';order_id UUID;actor UUID;creator UUID;code TEXT;actor_name TEXT;fields JSONB;label TEXT;key TEXT;raw_actor TEXT;status TEXT;detail TEXT;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_OP='UPDATE' THEN old_r:=to_jsonb(OLD); END IF;
 order_id:=CASE WHEN TG_TABLE_NAME='service_orders' THEN (r->>'id')::uuid ELSE NULLIF(r->>'service_order_id','')::uuid END;
 IF order_id IS NULL THEN RETURN NULL; END IF;
 SELECT codigo_os INTO code FROM service_orders WHERE id=order_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT COALESCE(jsonb_agg(k),'[]') INTO fields FROM jsonb_object_keys(r) k
 WHERE k NOT IN ('updated_at','updatedAt','created_at','createdAt') AND (TG_OP<>'UPDATE' OR r->k IS DISTINCT FROM old_r->k);
 IF TG_OP='UPDATE' AND fields='[]'::jsonb THEN RETURN NULL; END IF;
 raw_actor:=NULLIF(current_setting('app.actor_id',true),'');
 IF raw_actor IS NULL THEN raw_actor:=COALESCE(r->>'actor_user_id',r->>'performed_by',CASE WHEN TG_TABLE_NAME='service_order_visit_events' THEN r->>'tecnico_id' ELSE NULL END); END IF;
 IF raw_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  SELECT u.id,COALESCE(NULLIF(concat_ws(' ',to_jsonb(u)->>'nombre1',NULLIF(to_jsonb(u)->>'nombre2',to_jsonb(u)->>'nombre1'),CASE WHEN to_jsonb(u)->>'apellidos' IN (to_jsonb(u)->>'nombre1',to_jsonb(u)->>'nombre2') THEN NULL ELSE to_jsonb(u)->>'apellidos' END),''),to_jsonb(u)->>'usuario','Usuario') INTO actor,actor_name FROM usuarios u WHERE u.id=raw_actor::uuid;
 END IF;
 actor_name:=COALESCE(actor_name,'Sistema');
 status:=COALESCE(r->>'status',r->>'estado',r->>'member_status',r->>'event_type',r->>'action');
 label:=TG_ARGV[0]||CASE WHEN TG_OP='DELETE' THEN ' eliminado' WHEN TG_OP='INSERT' THEN ' registrado' ELSE ' actualizado' END||CASE WHEN status IS NOT NULL THEN ' ('||CASE status WHEN 'en_camino' THEN 'en camino' WHEN 'llegada_declarada' THEN 'llegada registrada por el técnico' WHEN 'llegada_validada' THEN 'llegada con GPS confirmado' WHEN 'material_requested' THEN 'material solicitado' WHEN 'material_approved' THEN 'material aprobado' WHEN 'material_rejected' THEN 'material rechazado' WHEN 'material_delivered' THEN 'material entregado' WHEN 'material_consumed' THEN 'material consumido' WHEN 'material_returned' THEN 'material devuelto' WHEN 'technical_closed' THEN 'cierre técnico confirmado' WHEN 'handed_to_direction' THEN 'entregado a dirección' WHEN 'direction_received' THEN 'recibido por dirección' WHEN 'validated' THEN 'validado' WHEN 'confirmed' THEN 'confirmado' WHEN 'draft' THEN 'borrador' WHEN 'signed' THEN 'firmado' WHEN 'delivered' THEN 'entregado' WHEN 'generated' THEN 'generado' WHEN 'workshop_item_assigned' THEN 'ítem de taller asignado' WHEN 'workshop_item_returned' THEN 'ítem de taller devuelto' WHEN 'workshop_item_consumed' THEN 'insumo de taller consumido' WHEN 'llegada_declarada' THEN 'llegada declarada sin validación GPS' WHEN 'assigned' THEN 'asignado' WHEN 'removed' THEN 'retirado' ELSE status END||')' ELSE '' END;
 detail:=LEFT(COALESCE(r->>'description',r#>>'{metadata,summary}',r->>'note',r->>'solution_text',r->>'request_description',''),1200);
 INSERT INTO service_order_activity_history(service_order_id,actor_user_id,action_label,source_table,record_id,operation,changed_fields,detail_text,resulting_status,transaction_id)
 VALUES(order_id,actor,label,TG_TABLE_NAME,COALESCE(r->>'id',r->>'service_order_id'),TG_OP,fields,detail,status,txid_current());
 SELECT created_by INTO creator FROM service_order_intakes WHERE service_order_id=order_id LIMIT 1;
 IF creator IS NOT NULL THEN
  key:='activity:'||order_id::text||':'||COALESCE(actor::text,'system')||':'||txid_current()::text;
  INSERT INTO notificaciones(usuario_id,tipo,titulo,mensaje,link,leido,service_order_id,service_assignment_key)
  VALUES(creator,'revision','Actividad en '||COALESCE(code,'Servicio'),actor_name||': '||label||CASE WHEN detail<>'' THEN '. '||LEFT(detail,300) ELSE '' END,
   '/dashboard/mis-servicios?orden='||order_id::text,false,order_id,key)
  ON CONFLICT(service_assignment_key) DO UPDATE SET mensaje=CASE WHEN position(EXCLUDED.mensaje IN notificaciones.mensaje)>0 THEN notificaciones.mensaje ELSE notificaciones.mensaje||E'\n'||EXCLUDED.mensaje END;
 END IF;
 RETURN NULL;
END $$;

COMMIT;
