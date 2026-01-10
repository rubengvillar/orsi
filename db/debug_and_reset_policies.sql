-- DEFINITIVE FIX & DEBUG SCRIPT
-- Run this in Supabase SQL Editor

-- 1. RESET POLICIES on order_cuts
-- We drop ALL known policies to avoid conflicts or "OR" logic confusion if old restrictive ones persist.

DROP POLICY IF EXISTS "Cuts viewable by authenticated" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by staff" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by authorized users" ON public.order_cuts;
DROP POLICY IF EXISTS "Cuts manageable by permission" ON public.order_cuts;

-- 2. CREATE READ POLICY (Permissive)
-- Allow any logged-in user to SEE the cuts. This ensures the table in the UI is not empty due to permissions.
CREATE POLICY "Cuts viewable by authenticated" 
ON public.order_cuts FOR SELECT 
TO authenticated 
USING (true);

-- 3. CREATE WRITE POLICY (Strict)
-- Only allow modification if they have 'orders:write' (Admin, Storekeeper, Sales, Developer etc)
CREATE POLICY "Cuts manageable by permission"
ON public.order_cuts FOR INSERT 
TO authenticated 
WITH CHECK (public.has_permission('orders:write'));

-- Duplicate for UPDATE/DELETE as logical separation or use ALL
CREATE POLICY "Cuts modifiable by permission"
ON public.order_cuts FOR UPDATE
TO authenticated 
USING (public.has_permission('orders:write'));

CREATE POLICY "Cuts deletable by permission"
ON public.order_cuts FOR DELETE
TO authenticated 
USING (public.has_permission('orders:write'));


-- 4. DIAGNOSTIC: Check your current user's setup
-- This returns what the database "thinks" your user is.
-- LOOK AT THE OUTPUT OF THIS QUERY IN THE 'RESULTS' TAB
SELECT 
  auth.uid() as my_user_id,
  (SELECT string_agg(r.name, ', ') 
   FROM public.user_roles ur 
   JOIN public.roles r ON ur.role_id = r.id 
   WHERE ur.user_id = auth.uid()) as my_roles,
   
  public.has_permission('orders:write') as can_write_orders,
  
  (SELECT count(*) FROM public.order_cuts) as total_cuts_in_db;
