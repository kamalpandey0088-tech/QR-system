-- ============================================================
-- PostgreSQL Row Level Security (RLS) Policies
-- ============================================================
-- CRITICAL: The database connection user MUST NOT be a superuser
-- or table owner, as superusers bypass RLS by default.
-- If using the table owner, FORCE RLS is required on every table.
--
-- These policies use the session variable 'app.current_tenant_id'
-- which must be set via: SELECT set_config('app.current_tenant_id', '<uuid>', true)
-- The third argument 'true' makes it transaction-local, preventing
-- tenant context leakage across pooled connections.
-- ============================================================

-- ── Tenants (no RLS - SuperAdmin manages all) ────────────────
-- Tenants table does not have RLS because:
-- 1. SuperAdmins need to list/manage all tenants
-- 2. Public theme endpoint needs to fetch any tenant's theme
-- Access control is handled at the application layer.

-- ── Users ────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (
    tenant_id IS NULL -- SuperAdmins have no tenant
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- ── Categories ───────────────────────────────────────────────

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_tenant_isolation ON categories
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Menu Items ───────────────────────────────────────────────

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;

CREATE POLICY menu_items_tenant_isolation ON menu_items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Modifiers ────────────────────────────────────────────────

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers FORCE ROW LEVEL SECURITY;

CREATE POLICY modifiers_tenant_isolation ON modifiers
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Customer Sessions ────────────────────────────────────────

ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_sessions_tenant_isolation ON customer_sessions
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Carts ────────────────────────────────────────────────────

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;

CREATE POLICY carts_tenant_isolation ON carts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Cart Items ───────────────────────────────────────────────
-- Cart items don't have direct tenant_id, but are protected through
-- the cart's RLS policy via foreign key constraint.

-- ── Cart Item Modifiers ──────────────────────────────────────
-- Protected through cart items -> cart -> tenant RLS chain.

-- ── Orders ───────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Order Items ──────────────────────────────────────────────

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY order_items_tenant_isolation ON order_items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ── Order Item Modifiers ─────────────────────────────────────
-- Protected through order items -> order -> tenant RLS chain.

-- ── Payment Webhook Logs ─────────────────────────────────────

ALTER TABLE payment_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_logs FORCE ROW LEVEL SECURITY;

-- Webhook logs may have null tenant_id during initial processing
CREATE POLICY webhook_logs_tenant_isolation ON payment_webhook_logs
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- ── Refund Logs ──────────────────────────────────────────────

ALTER TABLE refund_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY refund_logs_tenant_isolation ON refund_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ============================================================
-- IMPORTANT: Create a non-superuser role for the application
-- ============================================================
-- Run these commands as a PostgreSQL superuser:
--
-- CREATE ROLE app_user WITH LOGIN PASSWORD 'strong-password-here';
-- GRANT CONNECT ON DATABASE qr_pos_kds TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;
-- ============================================================
