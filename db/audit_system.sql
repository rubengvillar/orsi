-- AUDIT SYSTEM
-- -----------------------------------------------------------------------------

-- 1. Create Audit Logs Table
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id uuid, -- Can be null if composite key, but usually our tables have uuid PK
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);

-- Enable RLS (Admins only)
alter table public.audit_logs enable row level security;

create policy "Audit logs viewable by admins only"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- 2. Generic Audit Trigger Function
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
as $$
declare
  v_old_data jsonb;
  v_new_data jsonb;
  v_record_id uuid;
begin
  -- Determine operation type and data
  if (TG_OP = 'INSERT') then
    v_old_data := null;
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
  elsif (TG_OP = 'UPDATE') then
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := NEW.id;
  elsif (TG_OP = 'DELETE') then
    v_old_data := to_jsonb(OLD);
    v_new_data := null;
    v_record_id := OLD.id;
  end if;

  -- Insert log
  insert into public.audit_logs (
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    changed_by
  ) values (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_data,
    v_new_data,
    auth.uid() -- Requires Supabase Auth context
  );

  return null; -- Result is ignored for AFTER triggers
end;
$$;

-- 3. Apply Triggers to Tables
-- Drop first if exists to allow re-running script
drop trigger if exists audit_aluminum_accessories on public.aluminum_accessories;
create trigger audit_aluminum_accessories
after insert or update or delete on public.aluminum_accessories
for each row execute function public.log_audit_event();

drop trigger if exists audit_aluminum_profiles on public.aluminum_profiles;
create trigger audit_aluminum_profiles
after insert or update or delete on public.aluminum_profiles
for each row execute function public.log_audit_event();

drop trigger if exists audit_glass_types on public.glass_types;
create trigger audit_glass_types
after insert or update or delete on public.glass_types
for each row execute function public.log_audit_event();

drop trigger if exists audit_glass_sheets on public.glass_sheets;
create trigger audit_glass_sheets
after insert or update or delete on public.glass_sheets
for each row execute function public.log_audit_event();

drop trigger if exists audit_glass_remnants on public.glass_remnants;
create trigger audit_glass_remnants
after insert or update or delete on public.glass_remnants
for each row execute function public.log_audit_event();

drop trigger if exists audit_glass_accessories on public.glass_accessories;
create trigger audit_glass_accessories
after insert or update or delete on public.glass_accessories
for each row execute function public.log_audit_event();

-- Order System Audit
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders
after insert or update or delete on public.orders
for each row execute function public.log_audit_event();

drop trigger if exists audit_material_usage on public.material_usage;
create trigger audit_material_usage
after insert or update or delete on public.material_usage
for each row execute function public.log_audit_event();

-- Roles/Permissions (Optional, good for security)
drop trigger if exists audit_roles on public.roles;
create trigger audit_roles
after insert or update or delete on public.roles
for each row execute function public.log_audit_event();

drop trigger if exists audit_user_roles on public.user_roles;
create trigger audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function public.log_audit_event();
