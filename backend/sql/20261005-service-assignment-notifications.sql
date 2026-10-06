BEGIN;

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS service_order_id UUID NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_assignment_key TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_service_assignment_key_uq
  ON public.notificaciones(service_assignment_key);

-- Un aviso por orden/técnico/transacción, incluso cuando ambos registros cambian.
CREATE OR REPLACE FUNCTION public.notify_service_assignment(p_order_id UUID, p_user_id UUID, p_role TEXT)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  order_code TEXT;
  issue TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  SELECT codigo_os, descripcion_inicial INTO order_code, issue
    FROM public.service_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.notificaciones
    (usuario_id, tipo, titulo, mensaje, link, leido, service_order_id, service_assignment_key)
  VALUES
    (p_user_id, 'revision', 'Servicio asignado: ' || COALESCE(order_code, 'Orden de servicio'),
     'Te asignaron la orden ' || COALESCE(order_code, p_order_id::text) ||
       CASE WHEN p_role = 'support' THEN ' como técnico de apoyo.' ELSE ' como técnico principal.' END ||
       CASE WHEN COALESCE(issue, '') <> '' THEN ' Solicitud: ' || LEFT(issue, 240) ELSE '' END ||
       ' Revisa Mis servicios para continuar.',
     '/dashboard/mis-servicios?orden=' || p_order_id::text, false, p_order_id,
     p_order_id::text || ':' || p_user_id::text || ':' || txid_current()::text)
  ON CONFLICT (service_assignment_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_service_assignment_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'pendiente' THEN
    PERFORM public.notify_service_assignment(NEW.service_order_id, NEW.tecnico_id, 'primary');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS service_assignment_notice ON public.service_order_assignments;
CREATE TRIGGER service_assignment_notice AFTER INSERT ON public.service_order_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_assignment_row();

CREATE OR REPLACE FUNCTION public.notify_service_team_assignment_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.member_status <> 'assigned' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.member_status IS NOT DISTINCT FROM NEW.member_status
       AND OLD.technician_id IS NOT DISTINCT FROM NEW.technician_id
       AND OLD.member_role IS NOT DISTINCT FROM NEW.member_role
       AND OLD.assigned_at IS NOT DISTINCT FROM NEW.assigned_at THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM public.notify_service_assignment(NEW.service_order_id, NEW.technician_id, NEW.member_role);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS service_team_assignment_notice ON public.service_order_team_members;
CREATE TRIGGER service_team_assignment_notice AFTER INSERT OR UPDATE ON public.service_order_team_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_team_assignment_row();

COMMIT;
