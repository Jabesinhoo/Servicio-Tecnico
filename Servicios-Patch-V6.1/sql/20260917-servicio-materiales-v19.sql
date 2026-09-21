BEGIN;

CREATE TABLE IF NOT EXISTS servicio_materiales (
  id uuid PRIMARY KEY,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  cantidad_solicitada integer NOT NULL DEFAULT 1,
  cantidad_aprobada integer,
  cantidad_entregada integer NOT NULL DEFAULT 0,
  cantidad_usada integer NOT NULL DEFAULT 0,
  cantidad_devuelta integer NOT NULL DEFAULT 0,
  estado varchar(32) NOT NULL DEFAULT 'solicitado',
  observaciones text,
  motivo_rechazo text,
  solicitado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  solicitado_at timestamptz NOT NULL DEFAULT NOW(),
  aprobado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_at timestamptz,
  entregado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  entregado_at timestamptz,
  usado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  usado_at timestamptz,
  devuelto_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  devuelto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS cantidad_solicitada integer DEFAULT 1;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS cantidad_aprobada integer;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS cantidad_entregada integer DEFAULT 0;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS cantidad_usada integer DEFAULT 0;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS cantidad_devuelta integer DEFAULT 0;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS estado varchar(32) DEFAULT 'solicitado';
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS observaciones text;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS motivo_rechazo text;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS solicitado_por uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS solicitado_at timestamptz DEFAULT NOW();
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS aprobado_por uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS aprobado_at timestamptz;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS entregado_por uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS entregado_at timestamptz;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS usado_por uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS usado_at timestamptz;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS devuelto_por uuid;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS devuelto_at timestamptz;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW();
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_servicio_materiales_os
  ON servicio_materiales(service_order_id);

CREATE INDEX IF NOT EXISTS idx_servicio_materiales_producto
  ON servicio_materiales(product_id);

CREATE INDEX IF NOT EXISTS idx_servicio_materiales_estado
  ON servicio_materiales(estado);

COMMIT;
