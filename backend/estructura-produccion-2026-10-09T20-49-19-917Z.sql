--
-- PostgreSQL database dump
--

\restrict GNslMfpsf8mKltYpDVERSNeczuxk8xd7Y7jn1T9geeC5C4as4xsprtCP8NWKgc9

-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: link_service_signature(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_service_signature() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: notify_service_assignment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_service_assignment(p_order_id uuid, p_user_id uuid, p_role text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: notify_service_assignment_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_service_assignment_row() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status = 'pendiente' THEN
    PERFORM public.notify_service_assignment(NEW.service_order_id, NEW.tecnico_id, 'primary');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_service_team_assignment_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_service_team_assignment_row() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


--
-- Name: prevent_service_technician_overlap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_service_technician_overlap() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM service_order_schedule_blocks b
    WHERE b.technician_id = NEW.technician_id
      AND b.status = 'active'
      AND b.id <> NEW.id
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  ) THEN
    RAISE EXCEPTION 'TECHNICIAN_SCHEDULE_CONFLICT'
      USING ERRCODE = '23P01',
            DETAIL = 'El técnico ya tiene un bloque activo que se solapa con el intervalo solicitado.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: record_service_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_service_activity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
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
END $_$;


--
-- Name: seed_product_workshop_kind(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_product_workshop_kind() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE kind_value text; BEGIN
 kind_value:=COALESCE(workshop_kind_from_text(NEW.tipo_descripcion),workshop_kind_from_text(NEW.tipo::text));
 IF kind_value IS NOT NULL THEN INSERT INTO workshop_catalog(product_id,kind) VALUES(NEW.id,kind_value) ON CONFLICT(product_id) DO NOTHING; END IF;
 RETURN NEW;
END $$;


--
-- Name: workshop_kind_from_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workshop_kind_from_text(value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
 SELECT CASE lower(btrim(value)) WHEN 'herramienta' THEN 'tool' WHEN 'herramientas' THEN 'tool' WHEN 'tool' THEN 'tool' WHEN 'insumo' THEN 'supply' WHEN 'insumos' THEN 'supply' WHEN 'consumible' THEN 'supply' WHEN 'supply' THEN 'supply' ELSE NULL END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: alquiler_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alquiler_items (
    id bigint NOT NULL,
    solicitud_id bigint NOT NULL,
    producto_id bigint NOT NULL,
    serial_id bigint,
    cantidad numeric(14,3) DEFAULT 1 NOT NULL,
    estado_revision character varying(40) DEFAULT 'pendiente'::character varying NOT NULL,
    tecnico_id uuid,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_alquiler_items_cantidad CHECK ((cantidad > (0)::numeric))
);


--
-- Name: alquiler_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alquiler_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alquiler_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alquiler_items_id_seq OWNED BY public.alquiler_items.id;


--
-- Name: categorias_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: client_service_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_service_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    source_table text NOT NULL,
    source_record_id text NOT NULL,
    signature_storage_path text NOT NULL,
    mime_type text NOT NULL,
    signer_name text,
    signer_document text,
    signer_kind text DEFAULT 'client_or_representative'::text NOT NULL,
    captured_at timestamp with time zone NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_persona character varying(20) DEFAULT 'natural'::character varying,
    primer_nombre character varying(180),
    segundo_nombre character varying(180),
    primer_apellido character varying(180),
    segundo_apellido character varying(180),
    razon_social character varying(180),
    tipo_documento character varying(30) DEFAULT 'cedula'::character varying,
    documento character varying(30) NOT NULL,
    digito_verificacion character varying(2),
    telefono character varying(30),
    telefono_2 character varying(30),
    email character varying(150),
    email_2 character varying(150),
    direccion character varying(250),
    direccion_2 character varying(250),
    ciudad character varying(100),
    codigo_postal character varying(20),
    responsable_iva boolean DEFAULT true,
    autoretenedor boolean DEFAULT false,
    gran_contribuyente boolean DEFAULT false,
    clasificacion_dian character varying(50),
    actividad_economica character varying(100),
    codigo_ciiu character varying(20),
    plazo_credito integer DEFAULT 0,
    cupo_credito numeric(15,2) DEFAULT 0,
    fecha_aniversario timestamp with time zone,
    lista_precios character varying(50),
    forma_pago character varying(50),
    codigo_worldoffice character varying(50),
    observacion text,
    activo boolean DEFAULT true,
    notas text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    vendedor_id uuid
);


--
-- Name: despachos_bodega; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despachos_bodega (
    id bigint NOT NULL,
    solicitud_id bigint NOT NULL,
    responsable_id uuid NOT NULL,
    observaciones text,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_despacho timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: despachos_bodega_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.despachos_bodega_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: despachos_bodega_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.despachos_bodega_id_seq OWNED BY public.despachos_bodega.id;


--
-- Name: devoluciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devoluciones (
    id bigint NOT NULL,
    solicitud_id bigint NOT NULL,
    tipo character varying(50) NOT NULL,
    vendedor_id uuid NOT NULL,
    tecnico_id uuid,
    observaciones text,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: devoluciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devoluciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devoluciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devoluciones_id_seq OWNED BY public.devoluciones.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    tipo_movimiento character varying(20) NOT NULL,
    origen_tipo character varying(20) NOT NULL,
    origen_id uuid,
    cantidad integer NOT NULL,
    fecha timestamp with time zone DEFAULT now(),
    usuario_id uuid,
    observaciones text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid,
    descripcion character varying(250) NOT NULL,
    cantidad integer DEFAULT 1,
    precio_unitario numeric(15,2) DEFAULT 0,
    subtotal numeric(15,2) DEFAULT 0,
    porcentaje_iva integer DEFAULT 19,
    valor_iva numeric(15,2) DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_factura character varying(50) NOT NULL,
    prefijo character varying(10) NOT NULL,
    fecha_emision timestamp with time zone DEFAULT now(),
    cliente_id uuid NOT NULL,
    service_order_id uuid,
    sales_order_id uuid,
    tipo_documento character varying(20) DEFAULT 'factura'::character varying,
    estado character varying(20) DEFAULT 'emitida'::character varying,
    total_base numeric(15,2) DEFAULT 0,
    total_iva numeric(15,2) DEFAULT 0,
    total_retencion numeric(15,2) DEFAULT 0,
    total_otros_impuestos numeric(15,2) DEFAULT 0,
    total_general numeric(15,2) DEFAULT 0,
    observaciones text,
    resolution_id uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones (
    id bigint NOT NULL,
    usuario_id uuid,
    tipo character varying(100) NOT NULL,
    titulo character varying(255) NOT NULL,
    mensaje text NOT NULL,
    leido boolean DEFAULT false NOT NULL,
    link text,
    solicitud_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    service_order_id uuid,
    service_assignment_key text
);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    module character varying(60) NOT NULL,
    action character varying(60) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: productos_seriales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos_seriales (
    id bigint NOT NULL,
    producto_id bigint NOT NULL,
    serial character varying(255) NOT NULL,
    estado character varying(50) DEFAULT 'disponible'::character varying NOT NULL,
    ubicacion character varying(120) DEFAULT 'bodega'::character varying NOT NULL,
    observaciones text,
    fecha_ingreso timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_movimiento timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: productos_seriales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productos_seriales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productos_seriales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productos_seriales_id_seq OWNED BY public.productos_seriales.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    tipo character varying(20) NOT NULL,
    precio_venta numeric(12,2) DEFAULT 0,
    costo numeric(12,2) DEFAULT 0,
    stock_actual integer DEFAULT 0,
    stock_minimo integer DEFAULT 0,
    proveedor character varying(150),
    estado boolean DEFAULT true,
    imagenes jsonb DEFAULT '[]'::jsonb,
    categoria_id uuid,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    tipo_descripcion text
);


--
-- Name: resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_resolucion character varying(50) NOT NULL,
    prefijo character varying(10) NOT NULL,
    rango_inicio integer NOT NULL,
    rango_fin integer NOT NULL,
    siguiente_numero integer DEFAULT 1,
    fecha_emision timestamp with time zone NOT NULL,
    fecha_vencimiento timestamp with time zone NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: revisiones_tecnicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revisiones_tecnicas (
    id bigint NOT NULL,
    alquiler_item_id bigint NOT NULL,
    tecnico_id uuid NOT NULL,
    estado_producto character varying(80) NOT NULL,
    observaciones text,
    imagenes text[] DEFAULT '{}'::text[] NOT NULL,
    firma_tecnico text,
    fecha_revision timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: revisiones_tecnicas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revisiones_tecnicas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revisiones_tecnicas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.revisiones_tecnicas_id_seq OWNED BY public.revisiones_tecnicas.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    cantidad integer DEFAULT 1,
    precio_unitario numeric(12,2) DEFAULT 0,
    subtotal numeric(12,2) DEFAULT 0,
    requiere_servicio boolean DEFAULT false,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_ov character varying(30) NOT NULL,
    client_id uuid NOT NULL,
    vendedor_id uuid NOT NULL,
    estado character varying(20) DEFAULT 'borrador'::character varying,
    facturada boolean DEFAULT false,
    total_productos numeric(12,2) DEFAULT 0,
    total_servicios numeric(12,2) DEFAULT 0,
    total_general numeric(12,2) DEFAULT 0,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);


--
-- Name: seriales_historial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seriales_historial (
    id bigint NOT NULL,
    serial_id bigint NOT NULL,
    tipo_movimiento character varying(80) NOT NULL,
    origen character varying(120),
    destino character varying(120),
    usuario_id uuid,
    observaciones text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seriales_historial_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seriales_historial_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seriales_historial_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seriales_historial_id_seq OWNED BY public.seriales_historial.id;


--
-- Name: service_activity_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_activity_settings (
    name text NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_execution_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_execution_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    actor_user_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    CONSTRAINT service_execution_sessions_check CHECK (((ended_at IS NULL) OR (ended_at >= started_at)))
);


--
-- Name: service_intake_acceptance_evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_intake_acceptance_evidences (
    id uuid NOT NULL,
    intake_id uuid NOT NULL,
    created_by uuid NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    byte_size integer NOT NULL,
    storage_name text NOT NULL,
    upload_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_intake_acceptance_evidences_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 26214400)))
);


--
-- Name: service_intake_acceptances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_intake_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    client_id uuid NOT NULL,
    signer_name text NOT NULL,
    signer_document text NOT NULL,
    snapshot jsonb NOT NULL,
    snapshot_hash text NOT NULL,
    signature bytea NOT NULL,
    pdf bytea NOT NULL,
    captured_by uuid NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_intake_creation_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_intake_creation_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    kind text NOT NULL,
    upload_key uuid NOT NULL,
    name text NOT NULL,
    mime text NOT NULL,
    content bytea NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    equipment_id uuid,
    CONSTRAINT service_intake_creation_files_content_check CHECK (((octet_length(content) > 0) AND (octet_length(content) <= 8388608))),
    CONSTRAINT service_intake_creation_files_kind_check CHECK ((kind = ANY (ARRAY['reception_photo'::text, 'invoice_support'::text])))
);


--
-- Name: service_intake_worldoffice_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_intake_worldoffice_invoices (
    intake_id uuid NOT NULL,
    mapping_id uuid NOT NULL,
    invoice_reference text NOT NULL,
    record jsonb NOT NULL,
    linked_by uuid NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_inventory_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_inventory_allocations (
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_notification_outbox (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    event_type character varying(60) NOT NULL,
    idempotency_key character varying(180) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    last_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_notification_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT service_notification_outbox_status_ck CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'sent'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: service_notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_notification_templates (
    id uuid NOT NULL,
    template_key character varying(120) NOT NULL,
    event_type character varying(60) NOT NULL,
    channel character varying(30) NOT NULL,
    name character varying(180) NOT NULL,
    subject_template text,
    body_template text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_notification_templates_channel_ck CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'sms'::character varying, 'webhook'::character varying])::text[]))),
    CONSTRAINT service_notification_templates_version_check CHECK ((version >= 1))
);


--
-- Name: service_order_activity_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_activity_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    actor_user_id uuid,
    action_label text NOT NULL,
    source_table text NOT NULL,
    record_id text,
    operation text NOT NULL,
    changed_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    detail_text text,
    resulting_status text,
    transaction_id bigint,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: service_order_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_assignments (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    tecnico_id uuid NOT NULL,
    assigned_by uuid,
    status character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    impediment_reason text,
    acceptance_note text,
    response_latitude numeric(10,7),
    response_longitude numeric(10,7),
    response_accuracy_m numeric(10,2),
    response_location_captured_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_assignments_response_accuracy_chk CHECK (((response_accuracy_m IS NULL) OR (response_accuracy_m >= (0)::numeric))),
    CONSTRAINT service_order_assignments_response_lat_chk CHECK (((response_latitude IS NULL) OR ((response_latitude >= ('-90'::integer)::numeric) AND (response_latitude <= (90)::numeric)))),
    CONSTRAINT service_order_assignments_response_long_chk CHECK (((response_longitude IS NULL) OR ((response_longitude >= ('-180'::integer)::numeric) AND (response_longitude <= (180)::numeric)))),
    CONSTRAINT service_order_assignments_status_chk CHECK (((status)::text = ANY ((ARRAY['pendiente'::character varying, 'aceptada'::character varying, 'impedimento'::character varying, 'revocada'::character varying])::text[])))
);


--
-- Name: service_order_authorization_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_authorization_events (
    id uuid NOT NULL,
    authorization_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    actor_user_id uuid,
    previous_status character varying(30),
    new_status character varying(30),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_authorization_evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_authorization_evidences (
    id uuid NOT NULL,
    authorization_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    original_name character varying(255),
    mime_type character varying(120) NOT NULL,
    size_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_authorization_evidences_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: service_order_authorizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_authorizations (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    diagnosis_id uuid,
    requested_by uuid NOT NULL,
    request_type character varying(40) NOT NULL,
    subject character varying(180) NOT NULL,
    description text NOT NULL,
    estimated_amount numeric(14,2),
    requested_components text,
    diagnosis_snapshot jsonb,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    client_name character varying(180),
    client_document character varying(80),
    decision_channel character varying(40),
    decision_reference text,
    decision_note text,
    decided_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_authorizations_estimated_amount_check CHECK (((estimated_amount IS NULL) OR (estimated_amount >= (0)::numeric))),
    CONSTRAINT service_order_authorizations_status_ck CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT service_order_authorizations_type_ck CHECK (((request_type)::text = ANY ((ARRAY['repair'::character varying, 'materials'::character varying, 'additional_work'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: service_order_client_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_client_notifications (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    channel character varying(30) NOT NULL,
    recipient_name character varying(180),
    recipient_contact character varying(180),
    reference text,
    note text,
    notified_by uuid NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_client_notifications_channel_check CHECK (((channel)::text = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'phone'::character varying, 'sms'::character varying, 'in_person'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: service_order_closure_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_closure_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_user_id uuid,
    previous_status character varying(30),
    new_status character varying(30),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_closures (
    service_order_id uuid NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    final_result text,
    final_notes text,
    last_checklist_saved_at timestamp with time zone,
    technical_closed_by uuid,
    technical_closed_at timestamp with time zone,
    handed_to_direction_by uuid,
    handed_to_direction_at timestamp with time zone,
    direction_received_by uuid,
    direction_received_at timestamp with time zone,
    direction_validated_by uuid,
    direction_validated_at timestamp with time zone,
    direction_validation_note text,
    rework_reason text,
    rework_started_at timestamp with time zone,
    rework_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_minutes numeric(12,2),
    estimated_minutes integer,
    duration_note text,
    CONSTRAINT service_order_closures_rework_count_check CHECK ((rework_count >= 0)),
    CONSTRAINT service_order_closures_status_ck CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'technical_closed'::character varying, 'handed_to_direction'::character varying, 'direction_received'::character varying, 'validated'::character varying, 'rework_required'::character varying])::text[])))
);


--
-- Name: service_order_current_custody; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_current_custody (
    service_order_id uuid NOT NULL,
    holder_user_id uuid NOT NULL,
    custody_since timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    location_captured_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_current_custody_accuracy_chk CHECK (((accuracy_m IS NULL) OR (accuracy_m >= (0)::numeric))),
    CONSTRAINT service_order_current_custody_lat_chk CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
    CONSTRAINT service_order_current_custody_long_chk CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))
);


--
-- Name: service_order_custody_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_custody_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    action character varying(30) NOT NULL,
    from_user_id uuid,
    to_user_id uuid,
    performed_by uuid,
    note text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    location_captured_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_custody_events_accuracy_chk CHECK (((accuracy_m IS NULL) OR (accuracy_m >= (0)::numeric))),
    CONSTRAINT service_order_custody_events_action_chk CHECK (((action)::text = ANY ((ARRAY['tomada'::character varying, 'transferida'::character varying, 'liberada'::character varying])::text[]))),
    CONSTRAINT service_order_custody_events_lat_chk CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
    CONSTRAINT service_order_custody_events_long_chk CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))
);


--
-- Name: service_order_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_deliveries (
    service_order_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    receiver_type character varying(20),
    receiver_name character varying(180),
    receiver_document character varying(80),
    receiver_phone character varying(80),
    receiver_relationship character varying(120),
    identity_verified boolean DEFAULT false NOT NULL,
    final_condition_verified boolean DEFAULT false NOT NULL,
    accessories_verified boolean DEFAULT false NOT NULL,
    financial_clearance boolean DEFAULT false NOT NULL,
    financial_note text,
    third_party_authorization_note text,
    signature_mime_type character varying(120),
    signature_storage_path text,
    signature_captured_at timestamp with time zone,
    delivery_note text,
    delivered_by uuid,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_deliveries_receiver_type_check CHECK (((receiver_type IS NULL) OR ((receiver_type)::text = ANY ((ARRAY['client'::character varying, 'third_party'::character varying])::text[])))),
    CONSTRAINT service_order_deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'delivered'::character varying])::text[])))
);


--
-- Name: service_order_delivery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_delivery_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    event_type character varying(60) NOT NULL,
    actor_user_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_delivery_evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_delivery_evidences (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    category character varying(40) NOT NULL,
    uploaded_by uuid NOT NULL,
    original_name character varying(255),
    mime_type character varying(120) NOT NULL,
    size_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_delivery_evidences_category_check CHECK (((category)::text = ANY ((ARRAY['third_party_authorization'::character varying, 'identity'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT service_order_delivery_evidences_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: service_order_diagnostics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_diagnostics (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    work_type character varying(40) DEFAULT 'diagnostico'::character varying NOT NULL,
    result_status character varying(30),
    description text,
    solution_available boolean,
    approximate_cost numeric(14,2),
    required_components text,
    functional_result text,
    activities_performed text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    CONSTRAINT service_order_diagnostics_approximate_cost_check CHECK (((approximate_cost IS NULL) OR (approximate_cost >= (0)::numeric)))
);


--
-- Name: service_order_document_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_document_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    document_id uuid,
    event_type character varying(60) NOT NULL,
    actor_user_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_documents (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    document_type character varying(40) NOT NULL,
    version integer NOT NULL,
    status character varying(20) DEFAULT 'generated'::character varying NOT NULL,
    original_name character varying(255) NOT NULL,
    mime_type character varying(120) DEFAULT 'application/pdf'::character varying NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 character varying(64) NOT NULL,
    storage_path text NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_documents_size_bytes_check CHECK ((size_bytes > 0)),
    CONSTRAINT service_order_documents_status_ck CHECK (((status)::text = ANY ((ARRAY['generated'::character varying, 'superseded'::character varying])::text[]))),
    CONSTRAINT service_order_documents_type_ck CHECK (((document_type)::text = ANY ((ARRAY['reception_act'::character varying, 'technical_closure'::character varying, 'final_delivery'::character varying])::text[]))),
    CONSTRAINT service_order_documents_version_check CHECK ((version >= 1))
);


--
-- Name: service_order_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_equipment (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid,
    intake_id uuid,
    event_type character varying(50) NOT NULL,
    actor_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_order_evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_evidences (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid,
    stage character varying(40) NOT NULL,
    category character varying(80),
    original_name character varying(255),
    mime_type character varying(120) NOT NULL,
    size_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    note text,
    captured_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    equipment_id uuid,
    CONSTRAINT service_order_evidences_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: service_order_final_evidences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_final_evidences (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    original_name character varying(255),
    mime_type character varying(120) NOT NULL,
    size_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_final_evidences_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: service_order_financial_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_financial_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    intake_id uuid,
    billing_mode character varying(20) DEFAULT 'prepaid'::character varying,
    verification_required boolean DEFAULT true,
    clearance_status character varying(20) DEFAULT 'pending'::character varying,
    invoice_reference character varying(180),
    payment_reference character varying(220),
    expected_amount numeric(15,2),
    last_verified_at timestamp with time zone,
    last_verified_by uuid,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_order_financial_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_financial_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    actor_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_order_financial_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_financial_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    verification_source character varying(50) DEFAULT 'manual'::character varying,
    verification_kind character varying(50) DEFAULT 'payment_confirmed'::character varying,
    result_status character varying(20) DEFAULT 'cleared'::character varying,
    invoice_reference character varying(180),
    payment_reference character varying(220),
    balance_amount numeric(15,2) DEFAULT 0,
    paid_amount numeric(15,2) DEFAULT 0,
    evidence_note text,
    source_snapshot jsonb DEFAULT '{}'::jsonb,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_order_financial_verifications_source_ck CHECK (((verification_source)::text = ANY ((ARRAY['intake'::character varying, 'manual'::character varying, 'worldoffice_mirror'::character varying, 'worldoffice_live'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: service_order_geofences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_geofences (
    service_order_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    radius_m numeric(10,2) DEFAULT 150 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_geofence_lat_chk CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT service_order_geofence_lon_chk CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT service_order_geofence_radius_chk CHECK (((radius_m >= (25)::numeric) AND (radius_m <= (2000)::numeric)))
);


--
-- Name: service_order_intake_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_intake_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    member_role character varying(20) DEFAULT 'support'::character varying,
    added_by uuid,
    added_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_order_intakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_intakes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    created_by uuid,
    source_type character varying(30) DEFAULT 'customer'::character varying,
    source_reference character varying(180),
    request_description text,
    classification character varying(30),
    service_type_id uuid,
    service_type_name character varying(180),
    service_type_category character varying(120),
    base_value numeric(15,2),
    estimated_minutes integer,
    scope_text text,
    conditions_text text,
    additional_costs_notice text,
    client_acceptance boolean DEFAULT false,
    client_acceptance_name character varying(180),
    client_acceptance_document character varying(80),
    client_acceptance_channel character varying(40),
    client_acceptance_reference text,
    client_accepted_at timestamp with time zone,
    billing_mode character varying(20) DEFAULT 'prepaid'::character varying,
    invoice_reference character varying(180),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(60),
    payment_reference character varying(220),
    payment_verified_by uuid,
    payment_verified_at timestamp with time zone,
    postpaid_reason text,
    priority character varying(20) DEFAULT 'normal'::character varying,
    scheduled_date date,
    scheduled_time time without time zone,
    estimated_duration integer,
    scheduling_mode character varying(20) DEFAULT 'auto'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying,
    service_order_id uuid,
    cancelled_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    client_acceptance_client_id uuid,
    equipment_intake jsonb,
    client_snapshot jsonb,
    service_site jsonb,
    acceptance_signature_required boolean DEFAULT false NOT NULL,
    service_types jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: service_order_number_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_number_counters (
    year integer NOT NULL,
    last_number integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_order_reception_acts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_reception_acts (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    checklist_id uuid,
    status character varying(30) DEFAULT 'signed'::character varying NOT NULL,
    signed_by_name character varying(180) NOT NULL,
    signed_by_document character varying(80),
    signature_mime_type character varying(80) DEFAULT 'image/png'::character varying NOT NULL,
    signature_storage_path text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    location_captured_at timestamp with time zone,
    location_integrity_status character varying(30),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_order_reception_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_reception_checklists (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    equipment_type character varying(150),
    brand character varying(120),
    model character varying(120),
    serial_number character varying(160),
    received_from_name character varying(180),
    received_from_document character varying(80),
    condition_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    accessories jsonb DEFAULT '{}'::jsonb NOT NULL,
    accessories_other text,
    observations text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    location_captured_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    equipment_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT service_order_reception_checklists_accessories_object_chk CHECK ((jsonb_typeof(accessories) = 'object'::text)),
    CONSTRAINT service_order_reception_checklists_accuracy_chk CHECK (((accuracy_m IS NULL) OR (accuracy_m >= (0)::numeric))),
    CONSTRAINT service_order_reception_checklists_condition_object_chk CHECK ((jsonb_typeof(condition_flags) = 'object'::text)),
    CONSTRAINT service_order_reception_checklists_lat_chk CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
    CONSTRAINT service_order_reception_checklists_long_chk CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))),
    CONSTRAINT service_order_reception_checklists_status_chk CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'confirmed'::character varying])::text[])))
);


--
-- Name: service_order_satisfaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_satisfaction (
    service_order_id uuid NOT NULL,
    rating integer NOT NULL,
    would_recommend boolean,
    comment text,
    captured_by uuid NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_satisfaction_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: service_order_schedule_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_schedule_blocks (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    block_role character varying(20) DEFAULT 'support'::character varying NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    source character varying(30) DEFAULT 'auto'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_schedule_blocks_role_ck CHECK (((block_role)::text = ANY ((ARRAY['primary'::character varying, 'support'::character varying])::text[]))),
    CONSTRAINT service_order_schedule_blocks_source_ck CHECK (((source)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying, 'legacy'::character varying])::text[]))),
    CONSTRAINT service_order_schedule_blocks_status_ck CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT service_order_schedule_blocks_time_ck CHECK ((end_at > start_at))
);


--
-- Name: service_order_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    tipo_servicio_id uuid,
    tipo_servicio_nombre character varying(180),
    descripcion_problema text,
    observaciones text,
    precio_estimado numeric(14,2),
    equipo_relacionado text,
    requiere_diagnostico boolean DEFAULT false NOT NULL,
    requiere_repuestos boolean DEFAULT false NOT NULL,
    repuestos_necesarios text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    inventory_requirements jsonb DEFAULT '[]'::jsonb NOT NULL,
    estimated_minutes integer,
    CONSTRAINT ck_service_order_services_precio CHECK (((precio_estimado IS NULL) OR (precio_estimado >= (0)::numeric))),
    CONSTRAINT service_order_services_estimated_minutes_check CHECK ((estimated_minutes > 0))
);


--
-- Name: service_order_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    member_role character varying(20) DEFAULT 'support'::character varying,
    member_status character varying(20) DEFAULT 'planned'::character varying,
    added_by uuid,
    added_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    assigned_at timestamp with time zone,
    removed_at timestamp with time zone,
    removal_note text
);


--
-- Name: service_order_visit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_visit_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    tecnico_id uuid NOT NULL,
    event_type character varying(30) NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    distance_to_target_m numeric(12,2),
    network_trust_status character varying(20),
    device_trust_status character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_visit_event_type_chk CHECK (((event_type)::text = ANY ((ARRAY['en_camino'::character varying, 'llegada_validada'::character varying, 'llegada_declarada'::character varying])::text[])))
);


--
-- Name: service_order_work_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_work_logs (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    activity_type character varying(30) DEFAULT 'work'::character varying NOT NULL,
    description text NOT NULL,
    duration_minutes integer,
    result_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_order_work_logs_duration_minutes_check CHECK (((duration_minutes IS NULL) OR ((duration_minutes >= 1) AND (duration_minutes <= 1440)))),
    CONSTRAINT service_order_work_logs_type_ck CHECK (((activity_type)::text = ANY ((ARRAY['work'::character varying, 'diagnostic'::character varying, 'installation'::character varying, 'test'::character varying, 'support'::character varying, 'note'::character varying])::text[])))
);


--
-- Name: service_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_os character varying(30) NOT NULL,
    client_id uuid NOT NULL,
    origen_tipo character varying(20) DEFAULT 'otro'::character varying NOT NULL,
    origen_id uuid,
    tecnico_id uuid,
    descripcion_inicial text,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    facturada boolean DEFAULT false,
    fecha_asignacion timestamp with time zone,
    fecha_inicio timestamp with time zone,
    fecha_fin timestamp with time zone,
    diagnostico_final text,
    observaciones text,
    fecha_agendada date,
    hora_inicio_agendada time without time zone,
    duracion_estimada integer,
    creado_por uuid,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    aprobado_por uuid,
    fecha_aprobacion timestamp with time zone,
    service_site jsonb
);


--
-- Name: service_sla_alert_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_sla_alert_events (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    alert_key character varying(220) NOT NULL,
    alert_type character varying(30) NOT NULL,
    priority character varying(20) NOT NULL,
    elapsed_hours numeric(14,4) NOT NULL,
    target_hours integer NOT NULL,
    warning_percent integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_sla_alert_events_type_ck CHECK (((alert_type)::text = ANY ((ARRAY['warning'::character varying, 'breached'::character varying])::text[])))
);


--
-- Name: service_sla_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_sla_policies (
    id uuid NOT NULL,
    priority character varying(20) NOT NULL,
    target_hours integer,
    warning_percent integer DEFAULT 80 NOT NULL,
    active boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_sla_policies_priority_ck CHECK (((priority)::text = ANY ((ARRAY['baja'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[]))),
    CONSTRAINT service_sla_policies_target_hours_check CHECK (((target_hours IS NULL) OR (target_hours > 0))),
    CONSTRAINT service_sla_policies_warning_percent_check CHECK (((warning_percent >= 50) AND (warning_percent <= 100)))
);


--
-- Name: service_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_times (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    tecnico_id uuid NOT NULL,
    fecha_inicio timestamp with time zone NOT NULL,
    fecha_fin timestamp with time zone,
    horas_trabajadas numeric(10,2),
    descripcion_trabajo text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: service_type_inventory_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_type_inventory_requirements (
    service_type_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT service_type_inventory_requirements_quantity_check CHECK (((quantity > 0) AND (quantity <= 100000)))
);


--
-- Name: service_worker_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_worker_heartbeats (
    worker_name character varying(100) NOT NULL,
    host_name character varying(180),
    process_id integer,
    started_at timestamp with time zone,
    heartbeat_at timestamp with time zone,
    last_run_at timestamp with time zone,
    last_status character varying(30),
    last_result jsonb,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: servicio_materiales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio_materiales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_order_id uuid NOT NULL,
    product_id uuid,
    cantidad_solicitada integer NOT NULL,
    cantidad_entregada integer DEFAULT 0 NOT NULL,
    cantidad_usada integer DEFAULT 0 NOT NULL,
    cantidad_devuelta integer DEFAULT 0 NOT NULL,
    cantidad_desperdiciada integer DEFAULT 0 NOT NULL,
    tecnico_id uuid NOT NULL,
    observaciones text,
    fecha_entrega timestamp with time zone,
    fecha_devolucion timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    cantidad_aprobada integer,
    estado character varying(32) DEFAULT 'solicitado'::character varying,
    motivo_rechazo text,
    solicitado_por uuid,
    solicitado_at timestamp with time zone DEFAULT now(),
    aprobado_por uuid,
    aprobado_at timestamp with time zone,
    entregado_por uuid,
    entregado_at timestamp with time zone,
    usado_por uuid,
    usado_at timestamp with time zone,
    devuelto_por uuid,
    devuelto_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    external_name text,
    external_description text,
    external_unit text,
    CONSTRAINT ck_servicio_materiales_desperdiciada CHECK ((cantidad_desperdiciada >= 0)),
    CONSTRAINT ck_servicio_materiales_devuelta CHECK ((cantidad_devuelta >= 0)),
    CONSTRAINT ck_servicio_materiales_entregada CHECK ((cantidad_entregada >= 0)),
    CONSTRAINT ck_servicio_materiales_solicitada CHECK ((cantidad_solicitada > 0)),
    CONSTRAINT ck_servicio_materiales_usada CHECK ((cantidad_usada >= 0)),
    CONSTRAINT material_product_or_external_ck CHECK ((((product_id IS NOT NULL) AND (external_name IS NULL)) OR ((product_id IS NULL) AND (external_name IS NOT NULL) AND (length(btrim(external_name)) > 0))))
);


--
-- Name: solicitudes_alquiler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_alquiler (
    id bigint NOT NULL,
    numero_solicitud character varying(20) NOT NULL,
    cliente_id bigint NOT NULL,
    vendedor_id uuid NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    fecha_solicitud timestamp with time zone DEFAULT now() NOT NULL,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    documentacion_aprobada boolean DEFAULT false NOT NULL,
    estudio_credito_aprobado boolean DEFAULT false NOT NULL,
    pago_realizado boolean DEFAULT false NOT NULL,
    deposito_realizado boolean DEFAULT false NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_solicitudes_alquiler_fechas CHECK ((fecha_fin >= fecha_inicio))
);


--
-- Name: solicitudes_alquiler_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_alquiler_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_alquiler_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_alquiler_id_seq OWNED BY public.solicitudes_alquiler.id;


--
-- Name: sync_alquileres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_alquileres (
    id_externo bigint NOT NULL,
    id_cliente_externo bigint,
    id_producto_externo bigint,
    cantidad numeric(14,3) DEFAULT 0 NOT NULL,
    datos_completos jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha_sincronizacion timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_clientes (
    id_externo bigint NOT NULL,
    documento character varying(30),
    razon_social character varying(180),
    primer_nombre character varying(180),
    segundo_nombre character varying(180),
    primer_apellido character varying(180),
    segundo_apellido character varying(180),
    activo boolean DEFAULT true,
    datos_completos jsonb DEFAULT '{}'::jsonb,
    fecha_sincronizacion timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tipo_documento character varying(50),
    client_profile jsonb,
    profile_relations jsonb DEFAULT '{}'::jsonb NOT NULL,
    profile_schema jsonb
);


--
-- Name: sync_control; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_control (
    tabla character varying(80) NOT NULL,
    ultima_sincronizacion timestamp with time zone DEFAULT now() NOT NULL,
    total_registros integer DEFAULT 0 NOT NULL,
    estado character varying(30) DEFAULT 'ok'::character varying NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_logs (
    id bigint NOT NULL,
    tabla character varying(100) NOT NULL,
    tipo character varying(20) NOT NULL,
    mensaje text,
    registros_afectados integer DEFAULT 0 NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_logs_id_seq OWNED BY public.sync_logs.id;


--
-- Name: sync_productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_productos (
    id_externo bigint NOT NULL,
    codigo character varying(120),
    nombre character varying(255),
    precio_venta numeric(18,2) DEFAULT 0 NOT NULL,
    iva numeric(8,4) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    datos_completos jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha_sincronizacion timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_seriales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_seriales (
    id_externo bigint NOT NULL,
    serial character varying(255),
    id_producto_externo bigint,
    datos_completos jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha_sincronizacion timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tecnicos_horarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tecnicos_horarios (
    id bigint NOT NULL,
    tecnico_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_tecnicos_horarios_dia CHECK (((dia_semana >= 0) AND (dia_semana <= 6))),
    CONSTRAINT ck_tecnicos_horarios_horas CHECK ((hora_fin > hora_inicio))
);


--
-- Name: tecnicos_horarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tecnicos_horarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tecnicos_horarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tecnicos_horarios_id_seq OWNED BY public.tecnicos_horarios.id;


--
-- Name: tipos_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_servicio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    valor_base numeric(15,2) DEFAULT 0,
    duracion_estimada integer DEFAULT 60,
    requiere_diagnostico boolean DEFAULT false,
    requiere_repuestos boolean DEFAULT false,
    requiere_aprobacion boolean DEFAULT false,
    categoria character varying(50),
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: user_current_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_current_locations (
    user_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    accuracy_m numeric(10,2) NOT NULL,
    altitude_m numeric(10,2),
    altitude_accuracy_m numeric(10,2),
    heading_deg numeric(6,2),
    speed_mps numeric(10,3),
    source character varying(40) DEFAULT 'browser_geolocation'::character varying NOT NULL,
    ip_address character varying(64),
    user_agent text,
    captured_at timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    integrity_status character varying(20) DEFAULT 'unverified'::character varying NOT NULL,
    integrity_score integer DEFAULT 0 NOT NULL,
    integrity_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    movement_speed_kmh numeric(10,2),
    network_changed boolean DEFAULT false NOT NULL,
    client_timezone character varying(100),
    client_platform character varying(100),
    client_language character varying(40),
    client_connection_type character varying(40),
    precision_tier character varying(20) DEFAULT 'precise'::character varying NOT NULL,
    network_trust_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    network_provider character varying(30),
    network_proxy boolean DEFAULT false NOT NULL,
    network_vpn boolean DEFAULT false NOT NULL,
    network_tor boolean DEFAULT false NOT NULL,
    network_hosting boolean DEFAULT false NOT NULL,
    network_fraud_score numeric(6,2),
    device_id character varying(100),
    device_trust_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    CONSTRAINT user_current_locations_accuracy_chk CHECK ((accuracy_m >= (0)::numeric)),
    CONSTRAINT user_current_locations_latitude_chk CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT user_current_locations_longitude_chk CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))
);


--
-- Name: user_location_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_devices (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    device_id character varying(100) NOT NULL,
    trust_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    platform character varying(100),
    user_agent text,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    revoked_at timestamp with time zone,
    CONSTRAINT user_location_devices_status_chk CHECK (((trust_status)::text = ANY ((ARRAY['trusted'::character varying, 'pending'::character varying, 'revoked'::character varying])::text[])))
);


--
-- Name: user_location_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_history (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    accuracy_m numeric(10,2) NOT NULL,
    altitude_m numeric(10,2),
    altitude_accuracy_m numeric(10,2),
    heading_deg numeric(6,2),
    speed_mps numeric(10,3),
    source character varying(40) DEFAULT 'browser_geolocation'::character varying NOT NULL,
    ip_address character varying(64),
    user_agent text,
    captured_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    integrity_status character varying(20) DEFAULT 'unverified'::character varying NOT NULL,
    integrity_score integer DEFAULT 0 NOT NULL,
    integrity_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    movement_speed_kmh numeric(10,2),
    network_changed boolean DEFAULT false NOT NULL,
    client_timezone character varying(100),
    client_platform character varying(100),
    client_language character varying(40),
    client_connection_type character varying(40),
    precision_tier character varying(20) DEFAULT 'precise'::character varying NOT NULL,
    network_trust_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    network_provider character varying(30),
    network_proxy boolean DEFAULT false NOT NULL,
    network_vpn boolean DEFAULT false NOT NULL,
    network_tor boolean DEFAULT false NOT NULL,
    network_hosting boolean DEFAULT false NOT NULL,
    network_fraud_score numeric(6,2),
    device_id character varying(100),
    device_trust_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    CONSTRAINT user_location_history_accuracy_chk CHECK ((accuracy_m >= (0)::numeric)),
    CONSTRAINT user_location_history_latitude_chk CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT user_location_history_longitude_chk CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))
);


--
-- Name: user_location_integrity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_integrity_events (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    risk_score integer DEFAULT 0 NOT NULL,
    flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    accuracy_m numeric(10,2),
    movement_speed_kmh numeric(10,2),
    ip_address character varying(64),
    user_agent text,
    captured_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_location_integrity_events_score_chk CHECK (((risk_score >= 0) AND (risk_score <= 100)))
);


--
-- Name: user_login_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_login_events (
    id uuid NOT NULL,
    user_id uuid,
    identifier character varying(255),
    success boolean DEFAULT false NOT NULL,
    ip_address character varying(64),
    user_agent text,
    failure_reason character varying(120),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre1 character varying(100),
    nombre2 character varying(100),
    apellidos character varying(100),
    usuario character varying(50),
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    cedula character varying(20),
    celular character varying(20),
    role_id integer,
    rol character varying(20) DEFAULT 'usuario'::character varying,
    activo boolean DEFAULT true,
    last_login timestamp with time zone,
    password_changed_at timestamp with time zone,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: usuarios_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_roles (
    usuario_id uuid NOT NULL,
    rol_id integer NOT NULL,
    asignado_por uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workshop_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    quantity integer NOT NULL,
    returned_quantity integer DEFAULT 0 NOT NULL,
    note text,
    assigned_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    item_kind text DEFAULT 'tool'::text NOT NULL,
    consumed_quantity integer DEFAULT 0 NOT NULL,
    CONSTRAINT workshop_assignment_balance_ck CHECK (((returned_quantity + consumed_quantity) <= quantity)),
    CONSTRAINT workshop_assignments_check CHECK (((returned_quantity >= 0) AND (returned_quantity <= quantity))),
    CONSTRAINT workshop_assignments_consumed_quantity_check CHECK ((consumed_quantity >= 0)),
    CONSTRAINT workshop_assignments_item_kind_check CHECK ((item_kind = ANY (ARRAY['tool'::text, 'supply'::text]))),
    CONSTRAINT workshop_assignments_quantity_check CHECK ((quantity > 0))
);


--
-- Name: workshop_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_catalog (
    product_id uuid NOT NULL,
    kind text NOT NULL,
    CONSTRAINT workshop_catalog_kind_check CHECK ((kind = ANY (ARRAY['tool'::text, 'supply'::text])))
);


--
-- Name: workshop_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    action text NOT NULL,
    quantity integer NOT NULL,
    actor_user_id uuid NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT workshop_events_action_check CHECK ((action = ANY (ARRAY['assigned'::text, 'returned'::text, 'consumed'::text]))),
    CONSTRAINT workshop_events_quantity_check CHECK ((quantity > 0))
);


--
-- Name: workshop_return_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshop_return_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    original_name text NOT NULL,
    size_bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workshop_return_photos_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: worldoffice_financial_discovery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worldoffice_financial_discovery_runs (
    id uuid NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    database_name character varying(180),
    object_count integer DEFAULT 0 NOT NULL,
    candidate_count integer DEFAULT 0 NOT NULL,
    candidate_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    started_by uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worldoffice_financial_discovery_runs_candidate_count_check CHECK ((candidate_count >= 0)),
    CONSTRAINT worldoffice_financial_discovery_runs_object_count_check CHECK ((object_count >= 0)),
    CONSTRAINT worldoffice_financial_discovery_runs_status_ck CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: worldoffice_financial_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worldoffice_financial_mappings (
    id uuid NOT NULL,
    profile_name character varying(120) NOT NULL,
    source_schema character varying(128) NOT NULL,
    source_object character varying(128) NOT NULL,
    source_object_type character varying(20) DEFAULT 'TABLE'::character varying NOT NULL,
    invoice_reference_column character varying(128) NOT NULL,
    client_document_column character varying(128),
    client_external_id_column character varying(128),
    total_amount_column character varying(128),
    paid_amount_column character varying(128),
    balance_amount_column character varying(128),
    status_column character varying(128),
    due_date_column character varying(128),
    currency_column character varying(128),
    balance_tolerance numeric(14,2) DEFAULT 0 NOT NULL,
    active boolean DEFAULT false NOT NULL,
    observation_only boolean DEFAULT true NOT NULL,
    note text,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worldoffice_financial_mappings_amount_columns_ck CHECK (((balance_amount_column IS NOT NULL) OR ((total_amount_column IS NOT NULL) AND (paid_amount_column IS NOT NULL)))),
    CONSTRAINT worldoffice_financial_mappings_balance_tolerance_check CHECK ((balance_tolerance >= (0)::numeric)),
    CONSTRAINT worldoffice_financial_mappings_type_ck CHECK (((source_object_type)::text = ANY ((ARRAY['TABLE'::character varying, 'VIEW'::character varying])::text[])))
);


--
-- Name: worldoffice_financial_read_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worldoffice_financial_read_events (
    id uuid NOT NULL,
    service_order_id uuid,
    mapping_id uuid,
    event_type character varying(50) NOT NULL,
    invoice_reference character varying(180),
    matched_rows integer DEFAULT 0 NOT NULL,
    result_status character varying(30) DEFAULT 'unknown'::character varying NOT NULL,
    normalized_result jsonb,
    performed_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worldoffice_financial_read_events_matched_rows_check CHECK ((matched_rows >= 0)),
    CONSTRAINT worldoffice_financial_read_events_status_ck CHECK (((result_status)::text = ANY ((ARRAY['unknown'::character varying, 'not_found'::character varying, 'ambiguous'::character varying, 'client_mismatch'::character varying, 'pending'::character varying, 'eligible_zero_balance'::character varying, 'registered'::character varying])::text[]))),
    CONSTRAINT worldoffice_financial_read_events_type_ck CHECK (((event_type)::text = ANY ((ARRAY['live_check'::character varying, 'balance_zero_registered'::character varying, 'preview'::character varying, 'discovery'::character varying])::text[])))
);


--
-- Name: alquiler_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alquiler_items ALTER COLUMN id SET DEFAULT nextval('public.alquiler_items_id_seq'::regclass);


--
-- Name: despachos_bodega id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despachos_bodega ALTER COLUMN id SET DEFAULT nextval('public.despachos_bodega_id_seq'::regclass);


--
-- Name: devoluciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones ALTER COLUMN id SET DEFAULT nextval('public.devoluciones_id_seq'::regclass);


--
-- Name: notificaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: productos_seriales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_seriales ALTER COLUMN id SET DEFAULT nextval('public.productos_seriales_id_seq'::regclass);


--
-- Name: revisiones_tecnicas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_tecnicas ALTER COLUMN id SET DEFAULT nextval('public.revisiones_tecnicas_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: seriales_historial id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seriales_historial ALTER COLUMN id SET DEFAULT nextval('public.seriales_historial_id_seq'::regclass);


--
-- Name: solicitudes_alquiler id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_alquiler ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_alquiler_id_seq'::regclass);


--
-- Name: sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs ALTER COLUMN id SET DEFAULT nextval('public.sync_logs_id_seq'::regclass);


--
-- Name: tecnicos_horarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnicos_horarios ALTER COLUMN id SET DEFAULT nextval('public.tecnicos_horarios_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: alquiler_items alquiler_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alquiler_items
    ADD CONSTRAINT alquiler_items_pkey PRIMARY KEY (id);


--
-- Name: categorias_productos categorias_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_productos
    ADD CONSTRAINT categorias_productos_pkey PRIMARY KEY (id);


--
-- Name: client_service_signatures client_service_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_service_signatures
    ADD CONSTRAINT client_service_signatures_pkey PRIMARY KEY (id);


--
-- Name: client_service_signatures client_service_signatures_source_table_source_record_id_sig_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_service_signatures
    ADD CONSTRAINT client_service_signatures_source_table_source_record_id_sig_key UNIQUE (source_table, source_record_id, signature_storage_path);


--
-- Name: clients clients_documento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_documento_key UNIQUE (documento);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: despachos_bodega despachos_bodega_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despachos_bodega
    ADD CONSTRAINT despachos_bodega_pkey PRIMARY KEY (id);


--
-- Name: devoluciones devoluciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT devoluciones_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_numero_factura_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_numero_factura_key UNIQUE (numero_factura);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: productos_seriales productos_seriales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_seriales
    ADD CONSTRAINT productos_seriales_pkey PRIMARY KEY (id);


--
-- Name: products products_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_codigo_key UNIQUE (codigo);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: resolutions resolutions_numero_resolucion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolutions
    ADD CONSTRAINT resolutions_numero_resolucion_key UNIQUE (numero_resolucion);


--
-- Name: resolutions resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolutions
    ADD CONSTRAINT resolutions_pkey PRIMARY KEY (id);


--
-- Name: revisiones_tecnicas revisiones_tecnicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_tecnicas
    ADD CONSTRAINT revisiones_tecnicas_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_numero_ov_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_numero_ov_key UNIQUE (numero_ov);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: seriales_historial seriales_historial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seriales_historial
    ADD CONSTRAINT seriales_historial_pkey PRIMARY KEY (id);


--
-- Name: service_activity_settings service_activity_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_activity_settings
    ADD CONSTRAINT service_activity_settings_pkey PRIMARY KEY (name);


--
-- Name: service_execution_sessions service_execution_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution_sessions
    ADD CONSTRAINT service_execution_sessions_pkey PRIMARY KEY (id);


--
-- Name: service_intake_acceptance_evidences service_intake_acceptance_evidences_intake_id_upload_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptance_evidences
    ADD CONSTRAINT service_intake_acceptance_evidences_intake_id_upload_key_key UNIQUE (intake_id, upload_key);


--
-- Name: service_intake_acceptance_evidences service_intake_acceptance_evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptance_evidences
    ADD CONSTRAINT service_intake_acceptance_evidences_pkey PRIMARY KEY (id);


--
-- Name: service_intake_acceptance_evidences service_intake_acceptance_evidences_storage_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptance_evidences
    ADD CONSTRAINT service_intake_acceptance_evidences_storage_name_key UNIQUE (storage_name);


--
-- Name: service_intake_acceptances service_intake_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptances
    ADD CONSTRAINT service_intake_acceptances_pkey PRIMARY KEY (id);


--
-- Name: service_intake_creation_files service_intake_creation_files_intake_id_upload_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_creation_files
    ADD CONSTRAINT service_intake_creation_files_intake_id_upload_key_key UNIQUE (intake_id, upload_key);


--
-- Name: service_intake_creation_files service_intake_creation_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_creation_files
    ADD CONSTRAINT service_intake_creation_files_pkey PRIMARY KEY (id);


--
-- Name: service_intake_worldoffice_invoices service_intake_worldoffice_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_worldoffice_invoices
    ADD CONSTRAINT service_intake_worldoffice_invoices_pkey PRIMARY KEY (intake_id);


--
-- Name: service_inventory_allocations service_inventory_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_allocations
    ADD CONSTRAINT service_inventory_allocations_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_notification_outbox service_notification_outbox_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_outbox
    ADD CONSTRAINT service_notification_outbox_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: service_notification_outbox service_notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_outbox
    ADD CONSTRAINT service_notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: service_notification_templates service_notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_templates
    ADD CONSTRAINT service_notification_templates_pkey PRIMARY KEY (id);


--
-- Name: service_notification_templates service_notification_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_templates
    ADD CONSTRAINT service_notification_templates_template_key_key UNIQUE (template_key);


--
-- Name: service_order_activity_history service_order_activity_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_activity_history
    ADD CONSTRAINT service_order_activity_history_pkey PRIMARY KEY (id);


--
-- Name: service_order_assignments service_order_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_assignments
    ADD CONSTRAINT service_order_assignments_pkey PRIMARY KEY (id);


--
-- Name: service_order_authorization_events service_order_authorization_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_events
    ADD CONSTRAINT service_order_authorization_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_authorization_evidences service_order_authorization_evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_evidences
    ADD CONSTRAINT service_order_authorization_evidences_pkey PRIMARY KEY (id);


--
-- Name: service_order_authorizations service_order_authorizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_pkey PRIMARY KEY (id);


--
-- Name: service_order_client_notifications service_order_client_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_client_notifications
    ADD CONSTRAINT service_order_client_notifications_pkey PRIMARY KEY (id);


--
-- Name: service_order_closure_events service_order_closure_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closure_events
    ADD CONSTRAINT service_order_closure_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_closures service_order_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_order_current_custody service_order_current_custody_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_current_custody
    ADD CONSTRAINT service_order_current_custody_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_order_custody_events service_order_custody_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_custody_events
    ADD CONSTRAINT service_order_custody_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_deliveries service_order_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_deliveries
    ADD CONSTRAINT service_order_deliveries_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_order_delivery_events service_order_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_events
    ADD CONSTRAINT service_order_delivery_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_delivery_evidences service_order_delivery_evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_evidences
    ADD CONSTRAINT service_order_delivery_evidences_pkey PRIMARY KEY (id);


--
-- Name: service_order_diagnostics service_order_diagnostics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_diagnostics
    ADD CONSTRAINT service_order_diagnostics_pkey PRIMARY KEY (id);


--
-- Name: service_order_diagnostics service_order_diagnostics_service_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_diagnostics
    ADD CONSTRAINT service_order_diagnostics_service_order_id_key UNIQUE (service_order_id);


--
-- Name: service_order_document_events service_order_document_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_document_events
    ADD CONSTRAINT service_order_document_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_documents service_order_documents_order_type_version_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_documents
    ADD CONSTRAINT service_order_documents_order_type_version_uk UNIQUE (service_order_id, document_type, version);


--
-- Name: service_order_documents service_order_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_documents
    ADD CONSTRAINT service_order_documents_pkey PRIMARY KEY (id);


--
-- Name: service_order_equipment service_order_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_equipment
    ADD CONSTRAINT service_order_equipment_pkey PRIMARY KEY (id);


--
-- Name: service_order_events service_order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_events
    ADD CONSTRAINT service_order_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_evidences service_order_evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_evidences
    ADD CONSTRAINT service_order_evidences_pkey PRIMARY KEY (id);


--
-- Name: service_order_final_evidences service_order_final_evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_final_evidences
    ADD CONSTRAINT service_order_final_evidences_pkey PRIMARY KEY (id);


--
-- Name: service_order_financial_controls service_order_financial_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_controls
    ADD CONSTRAINT service_order_financial_controls_pkey PRIMARY KEY (id);


--
-- Name: service_order_financial_controls service_order_financial_controls_service_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_controls
    ADD CONSTRAINT service_order_financial_controls_service_order_id_key UNIQUE (service_order_id);


--
-- Name: service_order_financial_events service_order_financial_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_events
    ADD CONSTRAINT service_order_financial_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_financial_verifications service_order_financial_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_verifications
    ADD CONSTRAINT service_order_financial_verifications_pkey PRIMARY KEY (id);


--
-- Name: service_order_geofences service_order_geofences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_geofences
    ADD CONSTRAINT service_order_geofences_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_order_intake_team_members service_order_intake_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intake_team_members
    ADD CONSTRAINT service_order_intake_team_members_pkey PRIMARY KEY (id);


--
-- Name: service_order_intakes service_order_intakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_pkey PRIMARY KEY (id);


--
-- Name: service_order_number_counters service_order_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_number_counters
    ADD CONSTRAINT service_order_number_counters_pkey PRIMARY KEY (year);


--
-- Name: service_order_reception_acts service_order_reception_acts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_acts
    ADD CONSTRAINT service_order_reception_acts_pkey PRIMARY KEY (id);


--
-- Name: service_order_reception_acts service_order_reception_acts_service_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_acts
    ADD CONSTRAINT service_order_reception_acts_service_order_id_key UNIQUE (service_order_id);


--
-- Name: service_order_reception_checklists service_order_reception_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_checklists
    ADD CONSTRAINT service_order_reception_checklists_pkey PRIMARY KEY (id);


--
-- Name: service_order_reception_checklists service_order_reception_checklists_service_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_checklists
    ADD CONSTRAINT service_order_reception_checklists_service_order_id_key UNIQUE (service_order_id);


--
-- Name: service_order_satisfaction service_order_satisfaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_satisfaction
    ADD CONSTRAINT service_order_satisfaction_pkey PRIMARY KEY (service_order_id);


--
-- Name: service_order_schedule_blocks service_order_schedule_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_schedule_blocks
    ADD CONSTRAINT service_order_schedule_blocks_pkey PRIMARY KEY (id);


--
-- Name: service_order_services service_order_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_services
    ADD CONSTRAINT service_order_services_pkey PRIMARY KEY (id);


--
-- Name: service_order_team_members service_order_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_team_members
    ADD CONSTRAINT service_order_team_members_pkey PRIMARY KEY (id);


--
-- Name: service_order_visit_events service_order_visit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_visit_events
    ADD CONSTRAINT service_order_visit_events_pkey PRIMARY KEY (id);


--
-- Name: service_order_work_logs service_order_work_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_work_logs
    ADD CONSTRAINT service_order_work_logs_pkey PRIMARY KEY (id);


--
-- Name: service_orders service_orders_codigo_os_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_codigo_os_key UNIQUE (codigo_os);


--
-- Name: service_orders service_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_pkey PRIMARY KEY (id);


--
-- Name: service_sla_alert_events service_sla_alert_events_alert_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_alert_events
    ADD CONSTRAINT service_sla_alert_events_alert_key_key UNIQUE (alert_key);


--
-- Name: service_sla_alert_events service_sla_alert_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_alert_events
    ADD CONSTRAINT service_sla_alert_events_pkey PRIMARY KEY (id);


--
-- Name: service_sla_policies service_sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_policies
    ADD CONSTRAINT service_sla_policies_pkey PRIMARY KEY (id);


--
-- Name: service_sla_policies service_sla_policies_priority_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_policies
    ADD CONSTRAINT service_sla_policies_priority_key UNIQUE (priority);


--
-- Name: service_times service_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_times
    ADD CONSTRAINT service_times_pkey PRIMARY KEY (id);


--
-- Name: service_type_inventory_requirements service_type_inventory_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type_inventory_requirements
    ADD CONSTRAINT service_type_inventory_requirements_pkey PRIMARY KEY (service_type_id, product_id);


--
-- Name: service_worker_heartbeats service_worker_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_worker_heartbeats
    ADD CONSTRAINT service_worker_heartbeats_pkey PRIMARY KEY (worker_name);


--
-- Name: servicio_materiales servicio_materiales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_materiales
    ADD CONSTRAINT servicio_materiales_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_alquiler solicitudes_alquiler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_alquiler
    ADD CONSTRAINT solicitudes_alquiler_pkey PRIMARY KEY (id);


--
-- Name: sync_alquileres sync_alquileres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_alquileres
    ADD CONSTRAINT sync_alquileres_pkey PRIMARY KEY (id_externo);


--
-- Name: sync_clientes sync_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_clientes
    ADD CONSTRAINT sync_clientes_pkey PRIMARY KEY (id_externo);


--
-- Name: sync_control sync_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_control
    ADD CONSTRAINT sync_control_pkey PRIMARY KEY (tabla);


--
-- Name: sync_logs sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_logs
    ADD CONSTRAINT sync_logs_pkey PRIMARY KEY (id);


--
-- Name: sync_productos sync_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_productos
    ADD CONSTRAINT sync_productos_pkey PRIMARY KEY (id_externo);


--
-- Name: sync_seriales sync_seriales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_seriales
    ADD CONSTRAINT sync_seriales_pkey PRIMARY KEY (id_externo);


--
-- Name: tecnicos_horarios tecnicos_horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnicos_horarios
    ADD CONSTRAINT tecnicos_horarios_pkey PRIMARY KEY (id);


--
-- Name: tipos_servicio tipos_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_servicio
    ADD CONSTRAINT tipos_servicio_pkey PRIMARY KEY (id);


--
-- Name: productos_seriales uq_productos_seriales_serial; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos_seriales
    ADD CONSTRAINT uq_productos_seriales_serial UNIQUE (serial);


--
-- Name: solicitudes_alquiler uq_solicitudes_alquiler_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_alquiler
    ADD CONSTRAINT uq_solicitudes_alquiler_numero UNIQUE (numero_solicitud);


--
-- Name: user_current_locations user_current_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_current_locations
    ADD CONSTRAINT user_current_locations_pkey PRIMARY KEY (user_id);


--
-- Name: user_location_devices user_location_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_devices
    ADD CONSTRAINT user_location_devices_pkey PRIMARY KEY (id);


--
-- Name: user_location_devices user_location_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_devices
    ADD CONSTRAINT user_location_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: user_location_history user_location_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_history
    ADD CONSTRAINT user_location_history_pkey PRIMARY KEY (id);


--
-- Name: user_location_integrity_events user_location_integrity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_integrity_events
    ADD CONSTRAINT user_location_integrity_events_pkey PRIMARY KEY (id);


--
-- Name: user_login_events user_login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_login_events
    ADD CONSTRAINT user_login_events_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_cedula_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_cedula_key UNIQUE (cedula);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios_roles usuarios_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_roles
    ADD CONSTRAINT usuarios_roles_pkey PRIMARY KEY (usuario_id, rol_id);


--
-- Name: usuarios usuarios_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);


--
-- Name: workshop_assignments workshop_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_assignments
    ADD CONSTRAINT workshop_assignments_pkey PRIMARY KEY (id);


--
-- Name: workshop_catalog workshop_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_catalog
    ADD CONSTRAINT workshop_catalog_pkey PRIMARY KEY (product_id);


--
-- Name: workshop_events workshop_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_events
    ADD CONSTRAINT workshop_events_pkey PRIMARY KEY (id);


--
-- Name: workshop_return_photos workshop_return_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_return_photos
    ADD CONSTRAINT workshop_return_photos_pkey PRIMARY KEY (id);


--
-- Name: worldoffice_financial_discovery_runs worldoffice_financial_discovery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_discovery_runs
    ADD CONSTRAINT worldoffice_financial_discovery_runs_pkey PRIMARY KEY (id);


--
-- Name: worldoffice_financial_mappings worldoffice_financial_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_mappings
    ADD CONSTRAINT worldoffice_financial_mappings_pkey PRIMARY KEY (id);


--
-- Name: worldoffice_financial_read_events worldoffice_financial_read_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_read_events
    ADD CONSTRAINT worldoffice_financial_read_events_pkey PRIMARY KEY (id);


--
-- Name: client_active_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_active_name ON public.clients USING btree (activo, razon_social, documento);


--
-- Name: client_signature_client_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_signature_client_date ON public.client_service_signatures USING btree (client_id, captured_at DESC);


--
-- Name: dashboard_invoice_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dashboard_invoice_service ON public.invoices USING btree (service_order_id);


--
-- Name: dashboard_service_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dashboard_service_dates ON public.service_orders USING btree ("createdAt", tecnico_id);


--
-- Name: dashboard_team_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dashboard_team_actor ON public.service_order_team_members USING btree (technician_id, service_order_id);


--
-- Name: idx_alquiler_items_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alquiler_items_producto ON public.alquiler_items USING btree (producto_id);


--
-- Name: idx_alquiler_items_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alquiler_items_serial ON public.alquiler_items USING btree (serial_id);


--
-- Name: idx_alquiler_items_solicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alquiler_items_solicitud ON public.alquiler_items USING btree (solicitud_id);


--
-- Name: idx_alquiler_items_tecnico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alquiler_items_tecnico ON public.alquiler_items USING btree (tecnico_id);


--
-- Name: idx_clients_documento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_documento ON public.clients USING btree (documento);


--
-- Name: idx_despachos_bodega_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_despachos_bodega_estado ON public.despachos_bodega USING btree (estado);


--
-- Name: idx_despachos_bodega_solicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_despachos_bodega_solicitud ON public.despachos_bodega USING btree (solicitud_id);


--
-- Name: idx_devoluciones_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devoluciones_estado ON public.devoluciones USING btree (estado);


--
-- Name: idx_devoluciones_solicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devoluciones_solicitud ON public.devoluciones USING btree (solicitud_id);


--
-- Name: idx_devoluciones_tecnico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devoluciones_tecnico ON public.devoluciones USING btree (tecnico_id);


--
-- Name: idx_intakes_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intakes_client_id ON public.service_order_intakes USING btree (client_id);


--
-- Name: idx_intakes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intakes_status ON public.service_order_intakes USING btree (status);


--
-- Name: idx_notificaciones_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_created_at ON public.notificaciones USING btree (created_at DESC);


--
-- Name: idx_notificaciones_solicitud_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_solicitud_id ON public.notificaciones USING btree (solicitud_id);


--
-- Name: idx_notificaciones_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_usuario_id ON public.notificaciones USING btree (usuario_id);


--
-- Name: idx_notificaciones_usuario_leido; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificaciones_usuario_leido ON public.notificaciones USING btree (usuario_id, leido);


--
-- Name: idx_orders_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_client_id ON public.service_orders USING btree (client_id);


--
-- Name: idx_orders_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_estado ON public.service_orders USING btree (estado);


--
-- Name: idx_permissions_module_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_module_action ON public.permissions USING btree (module, action);


--
-- Name: idx_productos_seriales_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_seriales_estado ON public.productos_seriales USING btree (estado);


--
-- Name: idx_productos_seriales_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productos_seriales_producto ON public.productos_seriales USING btree (producto_id);


--
-- Name: idx_reception_checklists_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reception_checklists_status ON public.service_order_reception_checklists USING btree (status, updated_at DESC);


--
-- Name: idx_reception_checklists_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reception_checklists_technician ON public.service_order_reception_checklists USING btree (technician_id, updated_at DESC);


--
-- Name: idx_revisiones_tecnicas_item_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revisiones_tecnicas_item_fecha ON public.revisiones_tecnicas USING btree (alquiler_item_id, fecha_revision DESC);


--
-- Name: idx_revisiones_tecnicas_tecnico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revisiones_tecnicas_tecnico ON public.revisiones_tecnicas USING btree (tecnico_id);


--
-- Name: idx_role_permissions_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions USING btree (permission_id);


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


--
-- Name: idx_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_active ON public.roles USING btree (active);


--
-- Name: idx_seriales_historial_serial_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seriales_historial_serial_fecha ON public.seriales_historial USING btree (serial_id, fecha DESC);


--
-- Name: idx_seriales_historial_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seriales_historial_usuario ON public.seriales_historial USING btree (usuario_id);


--
-- Name: idx_service_intakes_acceptance_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_intakes_acceptance_client ON public.service_order_intakes USING btree (client_acceptance_client_id);


--
-- Name: idx_service_notification_outbox_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_notification_outbox_order ON public.service_notification_outbox USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_notification_outbox_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_notification_outbox_pending ON public.service_notification_outbox USING btree (status, next_attempt_at, created_at);


--
-- Name: idx_service_notification_templates_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_notification_templates_event ON public.service_notification_templates USING btree (event_type, active, channel);


--
-- Name: idx_service_order_assignments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_assignments_order ON public.service_order_assignments USING btree (service_order_id, assigned_at DESC);


--
-- Name: idx_service_order_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_assignments_status ON public.service_order_assignments USING btree (status, assigned_at DESC);


--
-- Name: idx_service_order_assignments_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_assignments_tech ON public.service_order_assignments USING btree (tecnico_id, assigned_at DESC);


--
-- Name: idx_service_order_authorization_events_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_authorization_events_auth ON public.service_order_authorization_events USING btree (authorization_id, created_at);


--
-- Name: idx_service_order_authorization_evidences_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_authorization_evidences_auth ON public.service_order_authorization_evidences USING btree (authorization_id, created_at DESC);


--
-- Name: idx_service_order_authorizations_order_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_authorizations_order_created ON public.service_order_authorizations USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_authorizations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_authorizations_status ON public.service_order_authorizations USING btree (status, created_at DESC);


--
-- Name: idx_service_order_client_notifications_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_client_notifications_order ON public.service_order_client_notifications USING btree (service_order_id, notified_at DESC);


--
-- Name: idx_service_order_closure_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_closure_events_order ON public.service_order_closure_events USING btree (service_order_id, created_at);


--
-- Name: idx_service_order_closures_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_closures_status ON public.service_order_closures USING btree (status, updated_at DESC);


--
-- Name: idx_service_order_current_custody_holder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_current_custody_holder ON public.service_order_current_custody USING btree (holder_user_id, custody_since DESC);


--
-- Name: idx_service_order_custody_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_custody_events_order ON public.service_order_custody_events USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_custody_events_to_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_custody_events_to_user ON public.service_order_custody_events USING btree (to_user_id, created_at DESC);


--
-- Name: idx_service_order_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_deliveries_status ON public.service_order_deliveries USING btree (status, updated_at DESC);


--
-- Name: idx_service_order_delivery_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_delivery_events_order ON public.service_order_delivery_events USING btree (service_order_id, created_at);


--
-- Name: idx_service_order_delivery_evidences_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_delivery_evidences_order ON public.service_order_delivery_evidences USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_diagnostics_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_diagnostics_status ON public.service_order_diagnostics USING btree (status, confirmed_at DESC);


--
-- Name: idx_service_order_document_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_document_events_order ON public.service_order_document_events USING btree (service_order_id, created_at);


--
-- Name: idx_service_order_documents_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_documents_generated ON public.service_order_documents USING btree (generated_at DESC);


--
-- Name: idx_service_order_documents_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_documents_order ON public.service_order_documents USING btree (service_order_id, document_type, version DESC);


--
-- Name: idx_service_order_evidences_order_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_evidences_order_stage ON public.service_order_evidences USING btree (service_order_id, stage, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_service_order_evidences_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_evidences_technician ON public.service_order_evidences USING btree (technician_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_service_order_final_evidences_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_final_evidences_order ON public.service_order_final_evidences USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_intake_team_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_intake_team_technician ON public.service_order_intake_team_members USING btree (technician_id, added_at DESC);


--
-- Name: idx_service_order_reception_acts_signed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_reception_acts_signed_at ON public.service_order_reception_acts USING btree (signed_at DESC);


--
-- Name: idx_service_order_services_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_services_order ON public.service_order_services USING btree (service_order_id);


--
-- Name: idx_service_order_services_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_services_tipo ON public.service_order_services USING btree (tipo_servicio_id);


--
-- Name: idx_service_order_team_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_team_order ON public.service_order_team_members USING btree (service_order_id, member_status, member_role);


--
-- Name: idx_service_order_team_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_team_technician ON public.service_order_team_members USING btree (technician_id, member_status, added_at DESC);


--
-- Name: idx_service_order_visit_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_visit_events_order ON public.service_order_visit_events USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_visit_events_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_visit_events_tech ON public.service_order_visit_events USING btree (tecnico_id, created_at DESC);


--
-- Name: idx_service_order_work_logs_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_work_logs_order ON public.service_order_work_logs USING btree (service_order_id, created_at DESC);


--
-- Name: idx_service_order_work_logs_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_order_work_logs_technician ON public.service_order_work_logs USING btree (technician_id, created_at DESC);


--
-- Name: idx_service_schedule_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_schedule_order ON public.service_order_schedule_blocks USING btree (service_order_id, status);


--
-- Name: idx_service_schedule_tech_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_schedule_tech_time ON public.service_order_schedule_blocks USING btree (technician_id, start_at, end_at) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_service_sla_alert_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_sla_alert_events_created ON public.service_sla_alert_events USING btree (created_at DESC, alert_type);


--
-- Name: idx_service_sla_alert_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_sla_alert_events_order ON public.service_sla_alert_events USING btree (service_order_id, created_at DESC);


--
-- Name: idx_servicio_materiales_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_estado ON public.servicio_materiales USING btree (estado);


--
-- Name: idx_servicio_materiales_fecha_entrega; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_fecha_entrega ON public.servicio_materiales USING btree (fecha_entrega);


--
-- Name: idx_servicio_materiales_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_order ON public.servicio_materiales USING btree (service_order_id);


--
-- Name: idx_servicio_materiales_os; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_os ON public.servicio_materiales USING btree (service_order_id);


--
-- Name: idx_servicio_materiales_os_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_os_estado ON public.servicio_materiales USING btree (service_order_id, estado);


--
-- Name: idx_servicio_materiales_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_product ON public.servicio_materiales USING btree (product_id);


--
-- Name: idx_servicio_materiales_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_producto ON public.servicio_materiales USING btree (product_id);


--
-- Name: idx_servicio_materiales_tecnico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_materiales_tecnico ON public.servicio_materiales USING btree (tecnico_id);


--
-- Name: idx_solicitudes_alquiler_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_alquiler_cliente ON public.solicitudes_alquiler USING btree (cliente_id);


--
-- Name: idx_solicitudes_alquiler_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_alquiler_created ON public.solicitudes_alquiler USING btree (created_at DESC);


--
-- Name: idx_solicitudes_alquiler_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_alquiler_estado ON public.solicitudes_alquiler USING btree (estado);


--
-- Name: idx_solicitudes_alquiler_vendedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_alquiler_vendedor ON public.solicitudes_alquiler USING btree (vendedor_id);


--
-- Name: idx_sosb_order_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sosb_order_active ON public.service_order_schedule_blocks USING btree (service_order_id, start_at) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_sosb_technician_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sosb_technician_active ON public.service_order_schedule_blocks USING btree (technician_id, start_at, end_at) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_sync_alquileres_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_alquileres_cliente ON public.sync_alquileres USING btree (id_cliente_externo);


--
-- Name: idx_sync_alquileres_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_alquileres_producto ON public.sync_alquileres USING btree (id_producto_externo);


--
-- Name: idx_sync_clientes_documento_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_clientes_documento_profile ON public.sync_clientes USING btree (documento);


--
-- Name: idx_sync_logs_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_logs_fecha ON public.sync_logs USING btree (fecha);


--
-- Name: idx_sync_logs_tabla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_logs_tabla ON public.sync_logs USING btree (tabla);


--
-- Name: idx_sync_logs_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_logs_tipo ON public.sync_logs USING btree (tipo);


--
-- Name: idx_sync_productos_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_productos_activo ON public.sync_productos USING btree (activo);


--
-- Name: idx_sync_productos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_productos_codigo ON public.sync_productos USING btree (codigo);


--
-- Name: idx_sync_productos_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_productos_nombre ON public.sync_productos USING btree (nombre);


--
-- Name: idx_sync_seriales_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_seriales_producto ON public.sync_seriales USING btree (id_producto_externo);


--
-- Name: idx_sync_seriales_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_seriales_serial ON public.sync_seriales USING btree (serial);


--
-- Name: idx_tecnicos_horarios_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tecnicos_horarios_activo ON public.tecnicos_horarios USING btree (tecnico_id, activo);


--
-- Name: idx_tecnicos_horarios_tecnico_dia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tecnicos_horarios_tecnico_dia ON public.tecnicos_horarios USING btree (tecnico_id, dia_semana);


--
-- Name: idx_user_current_locations_integrity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_current_locations_integrity ON public.user_current_locations USING btree (integrity_status, integrity_score, received_at DESC);


--
-- Name: idx_user_current_locations_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_current_locations_received_at ON public.user_current_locations USING btree (received_at DESC);


--
-- Name: idx_user_location_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_devices_user ON public.user_location_devices USING btree (user_id, trust_status, last_seen_at DESC);


--
-- Name: idx_user_location_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_history_created_at ON public.user_location_history USING btree (created_at DESC);


--
-- Name: idx_user_location_history_user_captured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_history_user_captured ON public.user_location_history USING btree (user_id, captured_at DESC);


--
-- Name: idx_user_location_integrity_events_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_integrity_events_risk ON public.user_location_integrity_events USING btree (risk_score DESC, created_at DESC);


--
-- Name: idx_user_location_integrity_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_integrity_events_user_created ON public.user_location_integrity_events USING btree (user_id, created_at DESC);


--
-- Name: idx_user_login_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_login_events_created ON public.user_login_events USING btree (created_at DESC);


--
-- Name: idx_user_login_events_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_login_events_success ON public.user_login_events USING btree (success);


--
-- Name: idx_user_login_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_login_events_user_created ON public.user_login_events USING btree (user_id, created_at DESC);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: idx_usuarios_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_role_id ON public.usuarios USING btree (role_id);


--
-- Name: idx_worldoffice_financial_discovery_runs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worldoffice_financial_discovery_runs_created ON public.worldoffice_financial_discovery_runs USING btree (completed_at DESC);


--
-- Name: idx_worldoffice_financial_mappings_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_worldoffice_financial_mappings_one_active ON public.worldoffice_financial_mappings USING btree (active) WHERE (active = true);


--
-- Name: idx_worldoffice_financial_mappings_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_worldoffice_financial_mappings_profile ON public.worldoffice_financial_mappings USING btree (lower((profile_name)::text));


--
-- Name: idx_worldoffice_financial_read_events_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worldoffice_financial_read_events_mapping ON public.worldoffice_financial_read_events USING btree (mapping_id, created_at DESC);


--
-- Name: idx_worldoffice_financial_read_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worldoffice_financial_read_events_order ON public.worldoffice_financial_read_events USING btree (service_order_id, created_at DESC);


--
-- Name: intake_acceptance_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_acceptance_client ON public.service_intake_acceptances USING btree (client_id, captured_at DESC);


--
-- Name: intake_acceptance_versions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_acceptance_versions ON public.service_intake_acceptances USING btree (intake_id, captured_at DESC);


--
-- Name: intake_files_by_intake; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_files_by_intake ON public.service_intake_creation_files USING btree (intake_id, kind);


--
-- Name: intake_photos_by_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intake_photos_by_equipment ON public.service_intake_creation_files USING btree (intake_id, equipment_id, kind);


--
-- Name: mirror_active_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mirror_active_name ON public.sync_clientes USING btree (activo, razon_social, documento);


--
-- Name: notificaciones_service_assignment_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notificaciones_service_assignment_key_uq ON public.notificaciones USING btree (service_assignment_key);


--
-- Name: order_equipment_by_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_equipment_by_order ON public.service_order_equipment USING btree (service_order_id);


--
-- Name: service_activity_order_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_activity_order_date ON public.service_order_activity_history USING btree (service_order_id, created_at DESC);


--
-- Name: service_execution_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_execution_one_open ON public.service_execution_sessions USING btree (service_order_id) WHERE (ended_at IS NULL);


--
-- Name: service_execution_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_execution_order ON public.service_execution_sessions USING btree (service_order_id, started_at);


--
-- Name: sync_client_document_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_client_document_lookup ON public.sync_clientes USING btree (documento);


--
-- Name: sync_client_external_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sync_client_external_lookup ON public.sync_clientes USING btree (id_externo);


--
-- Name: uq_service_order_assignments_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_assignments_pending ON public.service_order_assignments USING btree (service_order_id) WHERE ((status)::text = 'pendiente'::text);


--
-- Name: uq_service_order_authorization_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_authorization_pending ON public.service_order_authorizations USING btree (service_order_id) WHERE ((status)::text = 'pending'::text);


--
-- Name: uq_service_order_intake_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_intake_primary ON public.service_order_intake_team_members USING btree (intake_id) WHERE ((member_role)::text = 'primary'::text);


--
-- Name: uq_service_order_intake_team_member; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_intake_team_member ON public.service_order_intake_team_members USING btree (intake_id, technician_id);


--
-- Name: uq_service_order_team_active_member; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_team_active_member ON public.service_order_team_members USING btree (service_order_id, technician_id) WHERE ((member_status)::text <> 'removed'::text);


--
-- Name: uq_service_order_team_active_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_team_active_primary ON public.service_order_team_members USING btree (service_order_id) WHERE (((member_role)::text = 'primary'::text) AND ((member_status)::text <> 'removed'::text));


--
-- Name: uq_service_schedule_active_order_tech; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_schedule_active_order_tech ON public.service_order_schedule_blocks USING btree (service_order_id, technician_id) WHERE ((status)::text = 'active'::text);


--
-- Name: workshop_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workshop_history ON public.workshop_events USING btree (assignment_id, created_at);


--
-- Name: workshop_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workshop_open ON public.workshop_assignments USING btree (technician_id, service_order_id) WHERE (returned_quantity < quantity);


--
-- Name: workshop_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workshop_product ON public.workshop_assignments USING btree (product_id, created_at);


--
-- Name: workshop_return_photos_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workshop_return_photos_assignment ON public.workshop_return_photos USING btree (assignment_id, created_at);


--
-- Name: service_order_deliveries client_signature_link; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER client_signature_link AFTER INSERT OR UPDATE ON public.service_order_deliveries FOR EACH ROW EXECUTE FUNCTION public.link_service_signature();


--
-- Name: service_order_reception_acts client_signature_link; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER client_signature_link AFTER INSERT OR UPDATE ON public.service_order_reception_acts FOR EACH ROW EXECUTE FUNCTION public.link_service_signature();


--
-- Name: products seed_workshop_kind; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seed_workshop_kind AFTER INSERT OR UPDATE OF tipo, tipo_descripcion ON public.products FOR EACH ROW EXECUTE FUNCTION public.seed_product_workshop_kind();


--
-- Name: service_order_assignments service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Asignación');


--
-- Name: service_order_authorization_evidences service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_authorization_evidences FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Evidencia de autorización');


--
-- Name: service_order_authorizations service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_authorizations FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Autorización');


--
-- Name: service_order_client_notifications service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_client_notifications FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Aviso al cliente');


--
-- Name: service_order_closures service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_closures FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Cierre técnico');


--
-- Name: service_order_current_custody service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_current_custody FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Custodia');


--
-- Name: service_order_deliveries service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_deliveries FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Entrega final');


--
-- Name: service_order_delivery_evidences service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_delivery_evidences FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Evidencia de entrega');


--
-- Name: service_order_diagnostics service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_diagnostics FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Diagnóstico');


--
-- Name: service_order_document_events service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_document_events FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Gestión de documento');


--
-- Name: service_order_documents service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_documents FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Documento PDF');


--
-- Name: service_order_evidences service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_evidences FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Evidencia');


--
-- Name: service_order_final_evidences service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_final_evidences FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Evidencia de cierre');


--
-- Name: service_order_financial_controls service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_financial_controls FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Control financiero');


--
-- Name: service_order_financial_verifications service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_financial_verifications FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Verificación financiera');


--
-- Name: service_order_intakes service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_intakes FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Solicitud');


--
-- Name: service_order_reception_acts service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_reception_acts FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Firma de recepción');


--
-- Name: service_order_reception_checklists service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_reception_checklists FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Checklist de recepción');


--
-- Name: service_order_satisfaction service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_satisfaction FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Satisfacción');


--
-- Name: service_order_team_members service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_team_members FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Equipo técnico');


--
-- Name: service_order_visit_events service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_visit_events FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Visita');


--
-- Name: service_order_work_logs service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_order_work_logs FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Actividad técnica');


--
-- Name: service_orders service_activity_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_activity_record AFTER INSERT OR DELETE OR UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.record_service_activity('Orden');


--
-- Name: service_order_assignments service_assignment_notice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_assignment_notice AFTER INSERT ON public.service_order_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_service_assignment_row();


--
-- Name: service_order_events service_material_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_material_activity AFTER INSERT ON public.service_order_events FOR EACH ROW WHEN (((new.event_type)::text = ANY ((ARRAY['material_requested'::character varying, 'material_approved'::character varying, 'material_rejected'::character varying, 'material_delivered'::character varying, 'material_consumed'::character varying, 'material_returned'::character varying])::text[]))) EXECUTE FUNCTION public.record_service_activity('Material del servicio');


--
-- Name: service_order_team_members service_team_assignment_notice; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_team_assignment_notice AFTER INSERT OR UPDATE ON public.service_order_team_members FOR EACH ROW EXECUTE FUNCTION public.notify_service_team_assignment_row();


--
-- Name: service_order_schedule_blocks trg_service_technician_overlap; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_service_technician_overlap BEFORE INSERT OR UPDATE OF technician_id, start_at, end_at, status ON public.service_order_schedule_blocks FOR EACH ROW EXECUTE FUNCTION public.prevent_service_technician_overlap();


--
-- Name: client_service_signatures client_service_signatures_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_service_signatures
    ADD CONSTRAINT client_service_signatures_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: client_service_signatures client_service_signatures_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_service_signatures
    ADD CONSTRAINT client_service_signatures_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: alquiler_items fk_alquiler_items_serial; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alquiler_items
    ADD CONSTRAINT fk_alquiler_items_serial FOREIGN KEY (serial_id) REFERENCES public.productos_seriales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: alquiler_items fk_alquiler_items_solicitud; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alquiler_items
    ADD CONSTRAINT fk_alquiler_items_solicitud FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_alquiler(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alquiler_items fk_alquiler_items_tecnico; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alquiler_items
    ADD CONSTRAINT fk_alquiler_items_tecnico FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: clients fk_clients_vendedor_id_usuarios_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_vendedor_id_usuarios_id FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: despachos_bodega fk_despachos_bodega_responsable; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despachos_bodega
    ADD CONSTRAINT fk_despachos_bodega_responsable FOREIGN KEY (responsable_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: despachos_bodega fk_despachos_bodega_solicitud; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despachos_bodega
    ADD CONSTRAINT fk_despachos_bodega_solicitud FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_alquiler(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: devoluciones fk_devoluciones_solicitud; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT fk_devoluciones_solicitud FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_alquiler(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: devoluciones fk_devoluciones_tecnico; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT fk_devoluciones_tecnico FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: devoluciones fk_devoluciones_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devoluciones
    ADD CONSTRAINT fk_devoluciones_vendedor FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notificaciones fk_notificaciones_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: revisiones_tecnicas fk_revisiones_tecnicas_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_tecnicas
    ADD CONSTRAINT fk_revisiones_tecnicas_item FOREIGN KEY (alquiler_item_id) REFERENCES public.alquiler_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: revisiones_tecnicas fk_revisiones_tecnicas_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_tecnicas
    ADD CONSTRAINT fk_revisiones_tecnicas_usuario FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: seriales_historial fk_seriales_historial_serial; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seriales_historial
    ADD CONSTRAINT fk_seriales_historial_serial FOREIGN KEY (serial_id) REFERENCES public.productos_seriales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seriales_historial fk_seriales_historial_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seriales_historial
    ADD CONSTRAINT fk_seriales_historial_usuario FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_intakes fk_service_intakes_acceptance_client; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT fk_service_intakes_acceptance_client FOREIGN KEY (client_acceptance_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: service_order_services fk_service_order_services_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_services
    ADD CONSTRAINT fk_service_order_services_order FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_services fk_service_order_services_tipo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_services
    ADD CONSTRAINT fk_service_order_services_tipo FOREIGN KEY (tipo_servicio_id) REFERENCES public.tipos_servicio(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_orders fk_service_orders_aprobado_por; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT fk_service_orders_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: servicio_materiales fk_servicio_materiales_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_materiales
    ADD CONSTRAINT fk_servicio_materiales_order FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: servicio_materiales fk_servicio_materiales_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_materiales
    ADD CONSTRAINT fk_servicio_materiales_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: servicio_materiales fk_servicio_materiales_tecnico; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio_materiales
    ADD CONSTRAINT fk_servicio_materiales_tecnico FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: solicitudes_alquiler fk_solicitudes_alquiler_vendedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_alquiler
    ADD CONSTRAINT fk_solicitudes_alquiler_vendedor FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tecnicos_horarios fk_tecnicos_horarios_tecnico; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tecnicos_horarios
    ADD CONSTRAINT fk_tecnicos_horarios_tecnico FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoices invoices_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoices invoices_resolution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.resolutions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoices invoices_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invoices invoices_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notificaciones notificaciones_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: products products_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_productos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_execution_sessions service_execution_sessions_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution_sessions
    ADD CONSTRAINT service_execution_sessions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id);


--
-- Name: service_execution_sessions service_execution_sessions_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution_sessions
    ADD CONSTRAINT service_execution_sessions_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id);


--
-- Name: service_intake_acceptance_evidences service_intake_acceptance_evidences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptance_evidences
    ADD CONSTRAINT service_intake_acceptance_evidences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id);


--
-- Name: service_intake_acceptance_evidences service_intake_acceptance_evidences_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptance_evidences
    ADD CONSTRAINT service_intake_acceptance_evidences_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id) ON DELETE CASCADE;


--
-- Name: service_intake_acceptances service_intake_acceptances_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptances
    ADD CONSTRAINT service_intake_acceptances_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.usuarios(id);


--
-- Name: service_intake_acceptances service_intake_acceptances_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptances
    ADD CONSTRAINT service_intake_acceptances_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: service_intake_acceptances service_intake_acceptances_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_acceptances
    ADD CONSTRAINT service_intake_acceptances_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id);


--
-- Name: service_intake_creation_files service_intake_creation_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_creation_files
    ADD CONSTRAINT service_intake_creation_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id);


--
-- Name: service_intake_creation_files service_intake_creation_files_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_creation_files
    ADD CONSTRAINT service_intake_creation_files_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id) ON DELETE CASCADE;


--
-- Name: service_intake_worldoffice_invoices service_intake_worldoffice_invoices_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_worldoffice_invoices
    ADD CONSTRAINT service_intake_worldoffice_invoices_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id);


--
-- Name: service_intake_worldoffice_invoices service_intake_worldoffice_invoices_linked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_intake_worldoffice_invoices
    ADD CONSTRAINT service_intake_worldoffice_invoices_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES public.usuarios(id);


--
-- Name: service_inventory_allocations service_inventory_allocations_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_allocations
    ADD CONSTRAINT service_inventory_allocations_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id);


--
-- Name: service_inventory_allocations service_inventory_allocations_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_inventory_allocations
    ADD CONSTRAINT service_inventory_allocations_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id);


--
-- Name: service_notification_outbox service_notification_outbox_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_outbox
    ADD CONSTRAINT service_notification_outbox_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_notification_templates service_notification_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_notification_templates
    ADD CONSTRAINT service_notification_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_activity_history service_order_activity_history_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_activity_history
    ADD CONSTRAINT service_order_activity_history_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_activity_history service_order_activity_history_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_activity_history
    ADD CONSTRAINT service_order_activity_history_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_assignments service_order_assignments_assigned_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_assignments
    ADD CONSTRAINT service_order_assignments_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_assignments service_order_assignments_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_assignments
    ADD CONSTRAINT service_order_assignments_order_fk FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_assignments service_order_assignments_tech_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_assignments
    ADD CONSTRAINT service_order_assignments_tech_fk FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_authorization_events service_order_authorization_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_events
    ADD CONSTRAINT service_order_authorization_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_authorization_events service_order_authorization_events_authorization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_events
    ADD CONSTRAINT service_order_authorization_events_authorization_id_fkey FOREIGN KEY (authorization_id) REFERENCES public.service_order_authorizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_authorization_evidences service_order_authorization_evidences_authorization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_evidences
    ADD CONSTRAINT service_order_authorization_evidences_authorization_id_fkey FOREIGN KEY (authorization_id) REFERENCES public.service_order_authorizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_authorization_evidences service_order_authorization_evidences_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorization_evidences
    ADD CONSTRAINT service_order_authorization_evidences_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_authorizations service_order_authorizations_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_authorizations service_order_authorizations_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_authorizations service_order_authorizations_diagnosis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_diagnosis_id_fkey FOREIGN KEY (diagnosis_id) REFERENCES public.service_order_diagnostics(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_authorizations service_order_authorizations_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_authorizations service_order_authorizations_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_authorizations
    ADD CONSTRAINT service_order_authorizations_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_client_notifications service_order_client_notifications_notified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_client_notifications
    ADD CONSTRAINT service_order_client_notifications_notified_by_fkey FOREIGN KEY (notified_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_client_notifications service_order_client_notifications_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_client_notifications
    ADD CONSTRAINT service_order_client_notifications_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_closure_events service_order_closure_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closure_events
    ADD CONSTRAINT service_order_closure_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_closure_events service_order_closure_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closure_events
    ADD CONSTRAINT service_order_closure_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_closures service_order_closures_direction_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_direction_received_by_fkey FOREIGN KEY (direction_received_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_closures service_order_closures_direction_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_direction_validated_by_fkey FOREIGN KEY (direction_validated_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_closures service_order_closures_handed_to_direction_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_handed_to_direction_by_fkey FOREIGN KEY (handed_to_direction_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_closures service_order_closures_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_closures service_order_closures_technical_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_closures
    ADD CONSTRAINT service_order_closures_technical_closed_by_fkey FOREIGN KEY (technical_closed_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_current_custody service_order_current_custody_holder_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_current_custody
    ADD CONSTRAINT service_order_current_custody_holder_fk FOREIGN KEY (holder_user_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_current_custody service_order_current_custody_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_current_custody
    ADD CONSTRAINT service_order_current_custody_order_fk FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_current_custody service_order_current_custody_updated_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_current_custody
    ADD CONSTRAINT service_order_current_custody_updated_by_fk FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_custody_events service_order_custody_events_from_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_custody_events
    ADD CONSTRAINT service_order_custody_events_from_fk FOREIGN KEY (from_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_custody_events service_order_custody_events_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_custody_events
    ADD CONSTRAINT service_order_custody_events_order_fk FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_custody_events service_order_custody_events_performed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_custody_events
    ADD CONSTRAINT service_order_custody_events_performed_by_fk FOREIGN KEY (performed_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_custody_events service_order_custody_events_to_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_custody_events
    ADD CONSTRAINT service_order_custody_events_to_fk FOREIGN KEY (to_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_deliveries service_order_deliveries_delivered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_deliveries
    ADD CONSTRAINT service_order_deliveries_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_deliveries service_order_deliveries_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_deliveries
    ADD CONSTRAINT service_order_deliveries_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_delivery_events service_order_delivery_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_events
    ADD CONSTRAINT service_order_delivery_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_delivery_events service_order_delivery_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_events
    ADD CONSTRAINT service_order_delivery_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_delivery_evidences service_order_delivery_evidences_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_evidences
    ADD CONSTRAINT service_order_delivery_evidences_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_delivery_evidences service_order_delivery_evidences_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_delivery_evidences
    ADD CONSTRAINT service_order_delivery_evidences_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_diagnostics service_order_diagnostics_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_diagnostics
    ADD CONSTRAINT service_order_diagnostics_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_diagnostics service_order_diagnostics_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_diagnostics
    ADD CONSTRAINT service_order_diagnostics_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_document_events service_order_document_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_document_events
    ADD CONSTRAINT service_order_document_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_document_events service_order_document_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_document_events
    ADD CONSTRAINT service_order_document_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.service_order_documents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_document_events service_order_document_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_document_events
    ADD CONSTRAINT service_order_document_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_documents service_order_documents_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_documents
    ADD CONSTRAINT service_order_documents_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_documents service_order_documents_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_documents
    ADD CONSTRAINT service_order_documents_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_equipment service_order_equipment_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_equipment
    ADD CONSTRAINT service_order_equipment_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id);


--
-- Name: service_order_events service_order_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_events
    ADD CONSTRAINT service_order_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_events service_order_events_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_events
    ADD CONSTRAINT service_order_events_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_events service_order_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_events
    ADD CONSTRAINT service_order_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_evidences service_order_evidences_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_evidences
    ADD CONSTRAINT service_order_evidences_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.service_order_equipment(id);


--
-- Name: service_order_evidences service_order_evidences_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_evidences
    ADD CONSTRAINT service_order_evidences_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_evidences service_order_evidences_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_evidences
    ADD CONSTRAINT service_order_evidences_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_final_evidences service_order_final_evidences_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_final_evidences
    ADD CONSTRAINT service_order_final_evidences_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_final_evidences service_order_final_evidences_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_final_evidences
    ADD CONSTRAINT service_order_final_evidences_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_financial_controls service_order_financial_controls_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_controls
    ADD CONSTRAINT service_order_financial_controls_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_financial_controls service_order_financial_controls_last_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_controls
    ADD CONSTRAINT service_order_financial_controls_last_verified_by_fkey FOREIGN KEY (last_verified_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_financial_controls service_order_financial_controls_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_controls
    ADD CONSTRAINT service_order_financial_controls_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_financial_events service_order_financial_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_events
    ADD CONSTRAINT service_order_financial_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_financial_events service_order_financial_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_events
    ADD CONSTRAINT service_order_financial_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_financial_verifications service_order_financial_verifications_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_verifications
    ADD CONSTRAINT service_order_financial_verifications_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_financial_verifications service_order_financial_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_financial_verifications
    ADD CONSTRAINT service_order_financial_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_geofences service_order_geofences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_geofences
    ADD CONSTRAINT service_order_geofences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_geofences service_order_geofences_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_geofences
    ADD CONSTRAINT service_order_geofences_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_geofences service_order_geofences_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_geofences
    ADD CONSTRAINT service_order_geofences_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: service_order_intake_team_members service_order_intake_team_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intake_team_members
    ADD CONSTRAINT service_order_intake_team_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_intake_team_members service_order_intake_team_members_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intake_team_members
    ADD CONSTRAINT service_order_intake_team_members_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.service_order_intakes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_intake_team_members service_order_intake_team_members_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intake_team_members
    ADD CONSTRAINT service_order_intake_team_members_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_intakes service_order_intakes_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_intakes service_order_intakes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_intakes service_order_intakes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_intakes service_order_intakes_payment_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_payment_verified_by_fkey FOREIGN KEY (payment_verified_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_intakes service_order_intakes_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_intakes
    ADD CONSTRAINT service_order_intakes_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_reception_acts service_order_reception_acts_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_acts
    ADD CONSTRAINT service_order_reception_acts_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.service_order_reception_checklists(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_reception_acts service_order_reception_acts_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_acts
    ADD CONSTRAINT service_order_reception_acts_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_reception_acts service_order_reception_acts_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_acts
    ADD CONSTRAINT service_order_reception_acts_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_reception_checklists service_order_reception_checklists_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_checklists
    ADD CONSTRAINT service_order_reception_checklists_order_fk FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_reception_checklists service_order_reception_checklists_tech_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_reception_checklists
    ADD CONSTRAINT service_order_reception_checklists_tech_fk FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_satisfaction service_order_satisfaction_captured_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_satisfaction
    ADD CONSTRAINT service_order_satisfaction_captured_by_fkey FOREIGN KEY (captured_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;


--
-- Name: service_order_satisfaction service_order_satisfaction_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_satisfaction
    ADD CONSTRAINT service_order_satisfaction_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_schedule_blocks service_order_schedule_blocks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_schedule_blocks
    ADD CONSTRAINT service_order_schedule_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_schedule_blocks service_order_schedule_blocks_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_schedule_blocks
    ADD CONSTRAINT service_order_schedule_blocks_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_schedule_blocks service_order_schedule_blocks_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_schedule_blocks
    ADD CONSTRAINT service_order_schedule_blocks_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_team_members service_order_team_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_team_members
    ADD CONSTRAINT service_order_team_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_order_team_members service_order_team_members_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_team_members
    ADD CONSTRAINT service_order_team_members_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_team_members service_order_team_members_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_team_members
    ADD CONSTRAINT service_order_team_members_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_visit_events service_order_visit_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_visit_events
    ADD CONSTRAINT service_order_visit_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: service_order_visit_events service_order_visit_events_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_visit_events
    ADD CONSTRAINT service_order_visit_events_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: service_order_work_logs service_order_work_logs_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_work_logs
    ADD CONSTRAINT service_order_work_logs_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_order_work_logs service_order_work_logs_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_work_logs
    ADD CONSTRAINT service_order_work_logs_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_orders service_orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_orders service_orders_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_orders service_orders_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_sla_alert_events service_sla_alert_events_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_alert_events
    ADD CONSTRAINT service_sla_alert_events_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.service_sla_policies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_sla_alert_events service_sla_alert_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_alert_events
    ADD CONSTRAINT service_sla_alert_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_sla_policies service_sla_policies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sla_policies
    ADD CONSTRAINT service_sla_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: service_times service_times_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_times
    ADD CONSTRAINT service_times_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_times service_times_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_times
    ADD CONSTRAINT service_times_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_type_inventory_requirements service_type_inventory_requirements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type_inventory_requirements
    ADD CONSTRAINT service_type_inventory_requirements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: service_type_inventory_requirements service_type_inventory_requirements_service_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type_inventory_requirements
    ADD CONSTRAINT service_type_inventory_requirements_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.tipos_servicio(id) ON DELETE CASCADE;


--
-- Name: user_current_locations user_current_locations_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_current_locations
    ADD CONSTRAINT user_current_locations_user_fk FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: user_location_devices user_location_devices_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_devices
    ADD CONSTRAINT user_location_devices_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: user_location_devices user_location_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_devices
    ADD CONSTRAINT user_location_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: user_location_history user_location_history_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_history
    ADD CONSTRAINT user_location_history_user_fk FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: user_location_integrity_events user_location_integrity_events_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_integrity_events
    ADD CONSTRAINT user_location_integrity_events_user_fk FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: user_login_events user_login_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_login_events
    ADD CONSTRAINT user_login_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuarios usuarios_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuarios_roles usuarios_roles_asignado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_roles
    ADD CONSTRAINT usuarios_roles_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuarios_roles usuarios_roles_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_roles
    ADD CONSTRAINT usuarios_roles_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios_roles usuarios_roles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_roles
    ADD CONSTRAINT usuarios_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workshop_assignments workshop_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_assignments
    ADD CONSTRAINT workshop_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.usuarios(id);


--
-- Name: workshop_assignments workshop_assignments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_assignments
    ADD CONSTRAINT workshop_assignments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: workshop_assignments workshop_assignments_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_assignments
    ADD CONSTRAINT workshop_assignments_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id);


--
-- Name: workshop_assignments workshop_assignments_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_assignments
    ADD CONSTRAINT workshop_assignments_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.usuarios(id);


--
-- Name: workshop_catalog workshop_catalog_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_catalog
    ADD CONSTRAINT workshop_catalog_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: workshop_events workshop_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_events
    ADD CONSTRAINT workshop_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.usuarios(id);


--
-- Name: workshop_events workshop_events_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_events
    ADD CONSTRAINT workshop_events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.workshop_assignments(id);


--
-- Name: workshop_return_photos workshop_return_photos_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_return_photos
    ADD CONSTRAINT workshop_return_photos_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.workshop_assignments(id);


--
-- Name: workshop_return_photos workshop_return_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshop_return_photos
    ADD CONSTRAINT workshop_return_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.usuarios(id);


--
-- Name: worldoffice_financial_discovery_runs worldoffice_financial_discovery_runs_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_discovery_runs
    ADD CONSTRAINT worldoffice_financial_discovery_runs_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: worldoffice_financial_mappings worldoffice_financial_mappings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_mappings
    ADD CONSTRAINT worldoffice_financial_mappings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: worldoffice_financial_mappings worldoffice_financial_mappings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_mappings
    ADD CONSTRAINT worldoffice_financial_mappings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: worldoffice_financial_read_events worldoffice_financial_read_events_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_read_events
    ADD CONSTRAINT worldoffice_financial_read_events_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.worldoffice_financial_mappings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: worldoffice_financial_read_events worldoffice_financial_read_events_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_read_events
    ADD CONSTRAINT worldoffice_financial_read_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: worldoffice_financial_read_events worldoffice_financial_read_events_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worldoffice_financial_read_events
    ADD CONSTRAINT worldoffice_financial_read_events_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict GNslMfpsf8mKltYpDVERSNeczuxk8xd7Y7jn1T9geeC5C4as4xsprtCP8NWKgc9

