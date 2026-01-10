-- FIX: Use permissions instead of roles for order_cuts policies
-- -----------------------------------------------------------------------------

-- 1. Drop existing policies (including the one we might have just made)
drop policy if exists "Cuts manageable by staff" on public.order_cuts;
drop policy if exists "Cuts manageable by authorized users" on public.order_cuts;

-- 2. Create new permission-based policy
-- This checks if the user has the 'orders:write' permission.
-- This is much more flexible: you can simply assign 'orders:write' to the 'TableChief' or 'Developer' role
-- via the UI or SQL, and they will instantly gain access without changing code here.
create policy "Cuts manageable by permission"
  on public.order_cuts for all 
  to authenticated
  using (public.has_permission('orders:write'))
  with check (public.has_permission('orders:write'));

-- 3. Verify RLS is enabled
alter table public.order_cuts enable row level security;

-- 4. Also fix order_operators to use permissions
drop policy if exists "Order operators can be managed by Sales and Admin" on public.order_operators;
drop policy if exists "Order operators can be managed by authorized users" on public.order_operators;

create policy "Order operators manageable by permission"
  on public.order_operators for all
  to authenticated
  using (public.has_permission('orders:write'))
  with check (public.has_permission('orders:write'));
