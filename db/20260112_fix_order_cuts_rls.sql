-- FIX: Split RLS policies for order_cuts and order_operators to allow visibility
-- -----------------------------------------------------------------------------

-- 1. ORDER CUTS POLICIES
-- Drop existing single strict policy
drop policy if exists "Cuts manageable by permission" on public.order_cuts;
drop policy if exists "Cuts manageable by staff" on public.order_cuts;
drop policy if exists "Cuts manageable by authorized users" on public.order_cuts;

-- Policy for VIEWING cuts
-- Allows access if user has ANY view permission related to orders, cuts, or optimizer
create policy "Cuts viewable by authorized users"
  on public.order_cuts for select
  to authenticated
  using (
    public.has_permission('orders:view') or 
    public.has_permission('orders:write') or
    public.has_permission('cuts:view') or
    public.has_permission('optimizer:view') or
    public.is_admin()
  );

-- Policy for MANAGING cuts (Insert, Update, Delete)
-- Strictly for users with write permission
create policy "Cuts manageable by write permission"
  on public.order_cuts for all
  to authenticated
  using (public.has_permission('orders:write') or public.is_admin())
  with check (public.has_permission('orders:write') or public.is_admin());


-- 2. ORDER OPERATORS POLICIES
-- Drop existing single strict policy
drop policy if exists "Order operators manageable by permission" on public.order_operators;
drop policy if exists "Order operators can be managed by Sales and Admin" on public.order_operators;
drop policy if exists "Order operators can be managed by authorized users" on public.order_operators;

-- Policy for VIEWING operators assigned to orders
create policy "Order operators viewable by authorized users"
  on public.order_operators for select
  to authenticated
  using (
    public.has_permission('orders:view') or 
    public.has_permission('orders:write') or
    public.has_permission('admin:operators:view') or
    public.is_admin()
  );

-- Policy for MANAGING operators assigned to orders
create policy "Order operators manageable by write permission"
  on public.order_operators for all
  to authenticated
  using (public.has_permission('orders:write') or public.is_admin())
  with check (public.has_permission('orders:write') or public.is_admin());
