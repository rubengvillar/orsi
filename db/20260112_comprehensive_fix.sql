-- COMPREHENSIVE FIX & DIAGNOSTIC SCRIPT (v2)
-- -----------------------------------------------------------------------------
-- This script ensures all necessary permissions exist, are assigned to Admin,
-- and that RLS policies allow viewing for authorized users.
-- UPDATED: Now strictly drops existing policies to avoid "already exists" errors.

BEGIN;

-- 1. Ensure Permissions Exist
INSERT INTO public.permissions (code, description)
VALUES 
    ('orders:view', 'Ver pedidos'),
    ('orders:write', 'Gestionar pedidos'),
    ('cuts:view', 'Ver cortes'),
    ('optimizer:view', 'Ver optimizador')
ON CONFLICT (code) DO NOTHING;

-- 2. Ensure Admin Role has these Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Admin', 'Administrador', 'SuperAdmin')
AND p.code IN ('orders:view', 'orders:write', 'cuts:view', 'optimizer:view')
ON CONFLICT DO NOTHING;

-- 3. RESET RLS on ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders viewable by authenticated" ON public.orders;
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Orders can be created by authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Orders can be updated by authorized roles" ON public.orders;

CREATE POLICY "Orders viewable by authenticated"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

-- 4. RESET RLS on GLASS TYPES
ALTER TABLE public.glass_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.glass_types;
DROP POLICY IF EXISTS "Glass types viewable by authenticated" ON public.glass_types;

CREATE POLICY "Glass types viewable by authenticated"
  ON public.glass_types FOR SELECT
  TO authenticated
  USING (true);

-- 5. RESET RLS on ORDER_CUTS
ALTER TABLE public.order_cuts ENABLE ROW LEVEL SECURITY;

-- Drop ALL potential variants of policy names to be safe
DROP POLICY IF EXISTS "Cuts viewable by authorized users" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by write permission" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by permission" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by staff" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts viewable by authenticated" ON public.order_cuts;

-- Allow viewing if user has ANY relevant permission
CREATE POLICY "Cuts viewable by authorized users"
  ON public.order_cuts FOR SELECT
  TO authenticated
  USING (
    public.has_permission('orders:view') OR 
    public.has_permission('cuts:view') OR
    public.has_permission('optimizer:view') OR
    public.is_admin()
  );

-- Allow managing if user has write permission
CREATE POLICY "Cuts manageable by write permission"
  ON public.order_cuts FOR ALL
  TO authenticated
  USING (public.has_permission('orders:write') OR public.is_admin())
  WITH CHECK (public.has_permission('orders:write') OR public.is_admin());

COMMIT;

-- 6. DIAGNOSTICS (These run after commit)
DO $$
DECLARE
    v_count_cuts integer;
    v_count_orders integer;
    v_pending_cuts integer;
BEGIN
    SELECT count(*) INTO v_count_cuts FROM public.order_cuts;
    SELECT count(*) INTO v_count_orders FROM public.orders;
    SELECT count(*) INTO v_pending_cuts FROM public.order_cuts WHERE status = 'pending';
    
    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'DIAGNOSTIC RESULTS';
    RAISE NOTICE 'Total Orders: %', v_count_orders;
    RAISE NOTICE 'Total Cuts found in DB: %', v_count_cuts;
    RAISE NOTICE 'Pending Cuts: %', v_pending_cuts;
    
    IF v_count_cuts = 0 THEN
        RAISE NOTICE 'WARNING: The table is empty. Data was likely not saved.';
    ELSE
        RAISE NOTICE 'SUCCESS: Data exists. Check UI "Requerimientos de Corte".';
    END IF;
    RAISE NOTICE '------------------------------------------------';
END $$;
