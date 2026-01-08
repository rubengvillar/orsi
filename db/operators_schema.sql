-- 1. OPERATORS TABLE
create table if not exists public.operators (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. ORDER OPERATORS JOIN TABLE (Updated with Role)
create table if not exists public.order_operators (
  order_id uuid references public.orders(id) on delete cascade,
  operator_id uuid references public.operators(id) on delete cascade,
  role text not null check (role in ('Cutter', 'Installer')), -- Role in this specific order
  primary key (order_id, operator_id, role)
);

-- 3. UPDATE ORDERS TABLE
alter table public.orders 
add column if not exists manufactured_at date,
add column if not exists installed_at date,
add column if not exists legacy_order_number text,
add column if not exists address text,
add column if not exists estimated_installation_time text;

-- 4. UPDATE MATERIAL USAGE TABLE
alter table public.material_usage 
add column if not exists operator_id uuid references public.operators(id) on delete set null;

-- Enable RLS
alter table public.operators enable row level security;
alter table public.order_operators enable row level security;

-- Policies for Operators
drop policy if exists "Operators are viewable by authenticated users" on public.operators;
create policy "Operators are viewable by authenticated users"
  on public.operators for select
  to authenticated
  using (true);

drop policy if exists "Operators can be managed by Admin and Storekeeper" on public.operators;
create policy "Operators can be managed by Admin and Storekeeper"
  on public.operators for all
  to authenticated
  using (public.is_admin() or public.has_role('Storekeeper'))
  with check (public.is_admin() or public.has_role('Storekeeper'));

-- Policies for Order Operators
drop policy if exists "Order operators are viewable by authenticated users" on public.order_operators;
create policy "Order operators are viewable by authenticated users"
  on public.order_operators for select
  to authenticated
  using (true);

drop policy if exists "Order operators can be managed by Sales and Admin" on public.order_operators;
create policy "Order operators can be managed by Sales and Admin"
  on public.order_operators for all
  to authenticated
  using (public.is_admin() or public.has_role('Sales'))
  with check (public.is_admin() or public.has_role('Sales'));

-- 5. UPDATE register_material_usage FUNCTION
create or replace function public.register_material_usage(
  p_order_id uuid,
  p_worker_id uuid,
  p_material_type text,
  p_material_id uuid,
  p_quantity numeric,
  p_operator_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_usage_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  if p_material_type = 'aluminum_accessory' then
    update public.aluminum_accessories set quantity = quantity - p_quantity where id = p_material_id;
  elsif p_material_type = 'aluminum_profile' then
    update public.aluminum_profiles set quantity = quantity - p_quantity where id = p_material_id;
  elsif p_material_type = 'glass_sheet' then
    update public.glass_sheets set quantity = quantity - p_quantity where id = p_material_id;
  elsif p_material_type = 'glass_accessory' then
    update public.glass_accessories set quantity = quantity - p_quantity where id = p_material_id;
  else
    raise exception 'Invalid material type: %', p_material_type;
  end if;

  if not found then
    raise exception 'Material not found with ID % in category %', p_material_id, p_material_type;
  end if;

  insert into public.material_usage (
    order_id, worker_id, recorded_by, material_type, material_id, quantity, operator_id
  ) values (
    p_order_id, p_worker_id, auth.uid(), p_material_type, p_material_id, p_quantity, p_operator_id
  )
  returning id into v_usage_id;

  return v_usage_id;
end;
$$;
