-- GLASS CUTTING OPTIMIZATION SCHEMA
-- -----------------------------------------------------------------------------

-- 1. Updates to Glass Types
alter table public.glass_types 
add column if not exists std_width_mm integer default 2400,
add column if not exists std_height_mm integer default 3210;

-- 2. Order Cuts Table
create table if not exists public.order_cuts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  glass_type_id uuid references public.glass_types(id) on delete cascade,
  width_mm integer not null,
  height_mm integer not null,
  quantity integer not null default 1,
  notes text,
  status text default 'pending' check (status in ('pending', 'cut', 'cancelled')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.order_cuts enable row level security;

create policy "Cuts viewable by authenticated" 
  on public.order_cuts for select to authenticated using (true);

create policy "Cuts manageable by staff"
  on public.order_cuts for all to authenticated
  using (public.has_role('Admin') or public.has_role('Storekeeper') or public.has_role('Sales'))
  with check (public.has_role('Admin') or public.has_role('Storekeeper') or public.has_role('Sales'));

-- 3. Optimization Execution Function
-- This function handles the "Commit" of a cutting operation
create or replace function public.execute_cut_confirmation(
  p_glass_type_id uuid,
  p_source_type text, -- 'sheet' or 'remnant'
  p_source_id uuid,   -- ID of glass_sheets record (if we tracked individual sheets) or glass_remnants
  p_cuts_ids uuid[],  -- IDs of order_cuts to mark as 'cut'
  p_new_remnants jsonb -- Array of {width, height, qty, location}
)
returns void
language plpgsql
security definer
as $$
declare
  rem_record record;
begin
  -- 1. Consume Source
  if p_source_type = 'sheet' then
    -- Deduct 1 from sheets count for this type
    update public.glass_sheets 
    set quantity = quantity - 1 
    where glass_type_id = p_glass_type_id;
  elsif p_source_type = 'remnant' then
    -- Deduct 1 from remnant quantity or delete if 1
    update public.glass_remnants
    set quantity = quantity - 1
    where id = p_source_id;
    
    delete from public.glass_remnants where id = p_source_id and quantity <= 0;
  end if;

  -- 2. Mark Cuts as Done
  update public.order_cuts
  set status = 'cut'
  where id = any(p_cuts_ids);

  -- 3. Create New Remnants
  for rem_record in select * from jsonb_to_recordset(p_new_remnants) as x(width_mm int, height_mm int, quantity int, location text)
  loop
    insert into public.glass_remnants (glass_type_id, width_mm, height_mm, quantity, location)
    values (p_glass_type_id, rem_record.width_mm, rem_record.height_mm, rem_record.quantity, coalesce(rem_record.location, 'Optimizer'));
  end loop;

  -- 4. Record Usage for Audit
  -- (Optionally record in material_usage, though this is more granular)
end;
$$;
