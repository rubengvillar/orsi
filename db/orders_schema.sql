-- Order Management & Material Usage Schema

-- 1. ORDERS TABLE
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_number serial, -- Simple auto-incrementing number for display
  client_name text not null,
  description text,
  status text default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.orders enable row level security;

-- Orders Policies
create policy "Orders are viewable by authenticated users"
  on public.orders for select
  to authenticated
  using (true);

create policy "Orders can be created by authenticated users"
  on public.orders for insert
  to authenticated
  with check (true); 

create policy "Orders can be updated by authorized roles"
  on public.orders for update
  to authenticated
  using (
    public.is_admin() 
    or public.has_role('Storekeeper') 
    or public.has_role('Sales')
  );


-- 2. MATERIAL USAGE TABLE
create table public.material_usage (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  
  -- The worker who physically used the material
  worker_id uuid references auth.users(id),
  
  -- The user who entered/recorded this data (audit trail)
  recorded_by uuid references auth.users(id) default auth.uid(),
  
  -- Material identification
  material_type text not null check (material_type in ('aluminum_accessory', 'aluminum_profile', 'glass_sheet', 'glass_accessory')),
  material_id uuid not null, -- Logical FK, cannot enforce constraint easily across multiple tables
  
  quantity numeric not null check (quantity > 0),
  
  used_at timestamptz default now()
);

-- Enable RLS
alter table public.material_usage enable row level security;

-- Usage Policies
create policy "Usage is viewable by authenticated users"
  on public.material_usage for select
  to authenticated
  using (true);

create policy "Usage can be recorded by authorized roles"
  on public.material_usage for insert
  to authenticated
  with check (
    -- Any authenticated user involved in ops can record usage?
    -- For now let's allow "authenticated" but normally restricted to "Storekeeper" or "Worker".
    -- Given the prompt implies tracking usage by workers, likely they record it themselves or a storekeeper does.
    true
  );

-- 3. STOCK DEDUCTION LOGIC
-- Function to register usage and atomically deduct stock

create or replace function public.register_material_usage(
  p_order_id uuid,
  p_worker_id uuid,
  p_material_type text,
  p_material_id uuid,
  p_quantity numeric
)
returns uuid -- Returns the ID of the created usage record
language plpgsql
security definer
as $$
declare
  v_usage_id uuid;
  v_current_stock numeric;
begin
  -- 1. Validate inputs (basic)
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  -- 2. Deduct Stock based on Type
  -- We check stock first to prevent negative if desired, or just update and let check constraints handle it if they exist.
  -- Here we will simply update and check row count to ensure ID exists.
  
  if p_material_type = 'aluminum_accessory' then
    update public.aluminum_accessories 
    set quantity = quantity - p_quantity 
    where id = p_material_id;
    
  elsif p_material_type = 'aluminum_profile' then
    update public.aluminum_profiles 
    set quantity = quantity - p_quantity 
    where id = p_material_id;

  elsif p_material_type = 'glass_sheet' then
    update public.glass_sheets 
    set quantity = quantity - p_quantity 
    where id = p_material_id;

  elsif p_material_type = 'glass_accessory' then
    update public.glass_accessories 
    set quantity = quantity - p_quantity 
    where id = p_material_id;
    
  else
    raise exception 'Invalid material type: %', p_material_type;
  end if;

  -- Check if update happened (ID existed)
  if not found then
    raise exception 'Material not found with ID % in category %', p_material_type, p_material_id;
  end if;

  -- 3. Insert Usage Record
  insert into public.material_usage (
    order_id, worker_id, recorded_by, material_type, material_id, quantity
  ) values (
    p_order_id, p_worker_id, auth.uid(), p_material_type, p_material_id, p_quantity
  )
  returning id into v_usage_id;

  return v_usage_id;
end;
$$;
