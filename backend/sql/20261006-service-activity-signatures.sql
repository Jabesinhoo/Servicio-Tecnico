BEGIN;
CREATE TABLE IF NOT EXISTS service_activity_settings(name TEXT PRIMARY KEY,installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO service_activity_settings(name) VALUES('history') ON CONFLICT(name) DO NOTHING;
CREATE TABLE IF NOT EXISTS service_order_activity_history(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
 actor_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,action_label TEXT NOT NULL,
 source_table TEXT NOT NULL,record_id TEXT,operation TEXT NOT NULL,changed_fields JSONB NOT NULL DEFAULT '[]',
 detail_text TEXT,resulting_status TEXT,transaction_id BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE service_order_activity_history ADD COLUMN IF NOT EXISTS detail_text TEXT;
CREATE INDEX IF NOT EXISTS service_activity_order_date ON service_order_activity_history(service_order_id,created_at DESC);
CREATE TABLE IF NOT EXISTS client_service_signatures(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),client_id UUID NOT NULL REFERENCES clients(id),
 service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
 source_table TEXT NOT NULL,source_record_id TEXT NOT NULL,signature_storage_path TEXT NOT NULL,
 mime_type TEXT NOT NULL,signer_name TEXT,signer_document TEXT,signer_kind TEXT NOT NULL DEFAULT 'client_or_representative',
 captured_at TIMESTAMPTZ NOT NULL,UNIQUE(source_table,source_record_id,signature_storage_path)
);
CREATE INDEX IF NOT EXISTS client_signature_client_date ON client_service_signatures(client_id,captured_at DESC);
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
 IF raw_actor IS NULL THEN raw_actor:=COALESCE(r->>'actor_user_id',r->>'performed_by'); END IF;
 IF raw_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  SELECT u.id,COALESCE(NULLIF(concat_ws(' ',to_jsonb(u)->>'nombre1',to_jsonb(u)->>'nombre2',to_jsonb(u)->>'apellidos'),''),to_jsonb(u)->>'usuario','Usuario') INTO actor,actor_name FROM usuarios u WHERE u.id=raw_actor::uuid;
 END IF;
 actor_name:=COALESCE(actor_name,'Sistema');
 status:=COALESCE(r->>'status',r->>'estado',r->>'member_status',r->>'event_type',r->>'action');
 label:=TG_ARGV[0]||CASE WHEN TG_OP='DELETE' THEN ' eliminado' WHEN TG_OP='INSERT' THEN ' registrado' ELSE ' actualizado' END||CASE WHEN status IS NOT NULL THEN ' ('||CASE status WHEN 'technical_closed' THEN 'cierre técnico confirmado' WHEN 'handed_to_direction' THEN 'entregado a dirección' WHEN 'direction_received' THEN 'recibido por dirección' WHEN 'validated' THEN 'validado' WHEN 'confirmed' THEN 'confirmado' WHEN 'draft' THEN 'borrador' WHEN 'signed' THEN 'firmado' WHEN 'delivered' THEN 'entregado' WHEN 'generated' THEN 'generado' WHEN 'workshop_item_assigned' THEN 'ítem de taller asignado' WHEN 'workshop_item_returned' THEN 'ítem de taller devuelto' WHEN 'assigned' THEN 'asignado' WHEN 'removed' THEN 'retirado' ELSE status END||')' ELSE '' END;
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
DO $$ DECLARE entry RECORD; BEGIN
 FOR entry IN SELECT * FROM (VALUES
 ('service_orders','Orden'),('service_order_intakes','Solicitud'),('service_order_assignments','Asignación'),
 ('service_order_team_members','Equipo técnico'),('service_order_current_custody','Custodia'),('service_order_visit_events','Visita'),
 ('service_order_reception_checklists','Checklist de recepción'),('service_order_reception_acts','Firma de recepción'),
 ('service_order_evidences','Evidencia'),('service_order_diagnostics','Diagnóstico'),('service_order_work_logs','Actividad técnica'),
 ('service_order_closures','Cierre técnico'),('service_order_final_evidences','Evidencia de cierre'),
 ('service_order_authorizations','Autorización'),('service_order_authorization_evidences','Evidencia de autorización'),('service_order_financial_controls','Control financiero'),
 ('service_order_financial_verifications','Verificación financiera'),('service_order_documents','Documento PDF'),
 ('service_order_document_events','Gestión de documento'),('service_order_deliveries','Entrega final'),
 ('service_order_delivery_evidences','Evidencia de entrega'),('service_order_client_notifications','Aviso al cliente'),
 ('service_order_satisfaction','Satisfacción')) AS entries(tab,label)
 LOOP
  IF to_regclass('public.'||entry.tab) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS service_activity_record ON %I',entry.tab);
   EXECUTE format('CREATE TRIGGER service_activity_record AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION record_service_activity(%L)',entry.tab,entry.label);
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION link_service_signature() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r JSONB;customer UUID;record_id TEXT;is_delivery BOOLEAN;
BEGIN
 r:=to_jsonb(NEW);is_delivery:=TG_TABLE_NAME='service_order_deliveries';
 IF NULLIF(r->>'signature_storage_path','') IS NULL THEN RETURN NEW; END IF;
 IF is_delivery AND r->>'status'<>'delivered' THEN RETURN NEW; END IF;
 IF NOT is_delivery AND r->>'signed_at' IS NULL THEN RETURN NEW; END IF;
 SELECT client_id INTO customer FROM service_orders WHERE id=(r->>'service_order_id')::uuid;
 IF customer IS NULL THEN RETURN NEW; END IF;
 record_id:=COALESCE(r->>'id',r->>'service_order_id');
 INSERT INTO client_service_signatures(client_id,service_order_id,source_table,source_record_id,signature_storage_path,mime_type,signer_name,signer_document,signer_kind,captured_at)
 VALUES(customer,(r->>'service_order_id')::uuid,TG_TABLE_NAME,record_id,r->>'signature_storage_path',COALESCE(r->>'signature_mime_type','image/png'),
 COALESCE(r->>'signed_by_name',r->>'receiver_name'),COALESCE(r->>'signed_by_document',r->>'receiver_document'),
 CASE WHEN r->>'receiver_type'='third_party' THEN 'third_party' ELSE 'client_or_representative' END,
 COALESCE(r->>'signed_at',r->>'signature_captured_at',r->>'delivered_at')::timestamptz)
 ON CONFLICT(source_table,source_record_id,signature_storage_path) DO NOTHING;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['service_order_reception_acts','service_order_deliveries'] LOOP
  IF to_regclass('public.'||tab) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS client_signature_link ON %I',tab);
   EXECUTE format('CREATE TRIGGER client_signature_link AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION link_service_signature()',tab);
   -- Link existing confirmed signatures without creating notification noise.
   EXECUTE format('UPDATE %I SET updated_at=updated_at WHERE signature_storage_path IS NOT NULL',tab);
  END IF;
 END LOOP;
END $$;
DO $$ DECLARE tab TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['service_order_events','service_order_custody_events','service_order_closure_events','service_order_delivery_events','service_order_document_events','service_order_financial_events','service_order_work_logs'] LOOP
  IF to_regclass('public.'||tab) IS NOT NULL THEN
   EXECUTE format($q$INSERT INTO service_order_activity_history(service_order_id,actor_user_id,action_label,source_table,record_id,operation,changed_fields,created_at)
    SELECT (to_jsonb(e)->>'service_order_id')::uuid,COALESCE(to_jsonb(e)->>'actor_user_id',to_jsonb(e)->>'performed_by',to_jsonb(e)->>'technician_id')::uuid,
     COALESCE(to_jsonb(e)->>'event_type',to_jsonb(e)->>'action',to_jsonb(e)->>'activity_type','Acción histórica'),%L,to_jsonb(e)->>'id','LEGACY','[]',(to_jsonb(e)->>'created_at')::timestamptz
    FROM %I e WHERE NULLIF(to_jsonb(e)->>'service_order_id','') IS NOT NULL AND (to_jsonb(e)->>'created_at')::timestamptz < (SELECT installed_at FROM service_activity_settings WHERE name='history') AND NOT EXISTS(SELECT 1 FROM service_order_activity_history h WHERE h.source_table=%L AND h.record_id=to_jsonb(e)->>'id' AND h.operation='LEGACY')$q$,tab,tab,tab);
  END IF;
 END LOOP;
END $$;
COMMIT;
