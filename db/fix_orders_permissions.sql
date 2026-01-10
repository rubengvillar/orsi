-- FIX: Update RLS policies for 'orders' table to use permissions
-- -----------------------------------------------------------------------------

-- 1. Enable RLS (just in case)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Orders can be created by authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Orders can be updated by authorized roles" ON public.orders;

-- 3. Create NEW Policies

-- READ: Allow all authenticated users to see orders (necessary for the Optimizer to join data)
CREATE POLICY "Orders viewable by authenticated"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Allow creating orders if user has 'orders:write' permission
CREATE POLICY "Orders insertable by permission"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('orders:write'));

-- UPDATE: Allow updating if user has 'orders:write' permission
CREATE POLICY "Orders updatable by permission"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_permission('orders:write'))
  WITH CHECK (public.has_permission('orders:write'));

-- DELETE: Allow delete if user has 'orders:write' permission
CREATE POLICY "Orders deletable by permission"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.has_permission('orders:write'));

-- 4. DIAGNOSTIC (Optional check)
SELECT count(*) as visible_orders FROM public.orders;
