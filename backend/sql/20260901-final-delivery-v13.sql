BEGIN;

CREATE TABLE IF NOT EXISTS service_order_client_notifications (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('whatsapp','email','phone','sms','in_person','other')),
  recipient_name VARCHAR(180),
  recipient_contact VARCHAR(180),
  reference TEXT,
  note TEXT,
  notified_by UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_client_notifications_order
  ON service_order_client_notifications (service_order_id, notified_at DESC);

CREATE TABLE IF NOT EXISTS service_order_deliveries (
  service_order_id UUID PRIMARY KEY REFERENCES service_orders(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','delivered')),
  receiver_type VARCHAR(20) CHECK (receiver_type IS NULL OR receiver_type IN ('client','third_party')),
  receiver_name VARCHAR(180),
  receiver_document VARCHAR(80),
  receiver_phone VARCHAR(80),
  receiver_relationship VARCHAR(120),
  identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  final_condition_verified BOOLEAN NOT NULL DEFAULT FALSE,
  accessories_verified BOOLEAN NOT NULL DEFAULT FALSE,
  financial_clearance BOOLEAN NOT NULL DEFAULT FALSE,
  financial_note TEXT,
  third_party_authorization_note TEXT,
  signature_mime_type VARCHAR(120),
  signature_storage_path TEXT,
  signature_captured_at TIMESTAMPTZ,
  delivery_note TEXT,
  delivered_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_deliveries_status
  ON service_order_deliveries (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS service_order_delivery_evidences (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL CHECK (category IN ('third_party_authorization','identity','other')),
  uploaded_by UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  original_name VARCHAR(255),
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  storage_path TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_delivery_evidences_order
  ON service_order_delivery_evidences (service_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS service_order_satisfaction (
  service_order_id UUID PRIMARY KEY REFERENCES service_orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  comment TEXT,
  captured_by UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_order_delivery_events (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  actor_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_delivery_events_order
  ON service_order_delivery_events (service_order_id, created_at ASC);

COMMIT;
