-- RLS Policies for Stock Control App

-- Helper Functions to simplify policies
-- ---------------------------------------------------------

-- Check if the current user is an Admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid()
    and r.name = 'Admin'
  );
end;
$$;

-- Check if the current user has a specific role (by name)
create or replace function public.has_role(role_name text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid()
    and r.name = role_name
  );
end;
$$;

-- Check if the current user has a specific permission code (e.g., 'inventory.write')
-- This is more flexible than role checks but requires the permission system to be populated.
create or replace function public.has_permission(permission_code text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on ur.role_id = rp.role_id
    join public.permissions p on rp.permission_id = p.id
    where ur.user_id = auth.uid()
    and p.code = permission_code
  );
end;
$$;

-- Enable RLS on all tables (Safety first)
-- ---------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.aluminum_accessories enable row level security;
alter table public.aluminum_profiles enable row level security;
alter table public.glass_types enable row level security;
alter table public.glass_sheets enable row level security;
alter table public.glass_remnants enable row level security;
alter table public.glass_accessories enable row level security;
-- Profiles already enabled in update_profiles.sql but good to double check
alter table public.profiles enable row level security;

-- DROP existing policies to allow clean re-run
-- ---------------------------------------------------------
drop policy if exists "Allow read access for authenticated users" on public.roles;
drop policy if exists "Allow read access for authenticated users" on public.aluminum_accessories;
-- (Add drops for all other potential previous makeshift policies if necessary)
drop policy if exists "Enable read access for all authenticated users" on public.roles;
drop policy if exists "Enable insert for admins only" on public.roles;
drop policy if exists "Enable update for admins only" on public.roles;
drop policy if exists "Enable delete for admins only" on public.roles;

drop policy if exists "Enable read access for all authenticated users" on public.permissions;
drop policy if exists "Enable write for admins only" on public.permissions;

drop policy if exists "Enable read access for all authenticated users" on public.role_permissions;
drop policy if exists "Enable write for admins only" on public.role_permissions;

drop policy if exists "Enable read for own roles or admins" on public.user_roles;
drop policy if exists "Enable write for admins only" on public.user_roles;

drop policy if exists "Enable read access for all authenticated users" on public.aluminum_accessories;
drop policy if exists "Enable write for authorized roles" on public.aluminum_accessories;

drop policy if exists "Enable read access for all authenticated users" on public.aluminum_profiles;
drop policy if exists "Enable write for authorized roles" on public.aluminum_profiles;

drop policy if exists "Enable read access for all authenticated users" on public.glass_types;
drop policy if exists "Enable write for authorized roles" on public.glass_types;

drop policy if exists "Enable read access for all authenticated users" on public.glass_sheets;
drop policy if exists "Enable write for authorized roles" on public.glass_sheets;

drop policy if exists "Enable read access for all authenticated users" on public.glass_remnants;
drop policy if exists "Enable write for authorized roles" on public.glass_remnants;

drop policy if exists "Enable read access for all authenticated users" on public.glass_accessories;
drop policy if exists "Enable write for authorized roles" on public.glass_accessories;


-- 1. System Tables Policies (roles, permissions, role_permissions)
-- ---------------------------------------------------------
-- Everyone needs to see roles/permissions to know what they can do/assign (or for UI display)
create policy "Enable read access for all authenticated users"
on public.roles for select
to authenticated
using (true);

create policy "Enable insert for admins only"
on public.roles for insert
to authenticated
with check (public.is_admin());

create policy "Enable update for admins only"
on public.roles for update
to authenticated
using (public.is_admin());

create policy "Enable delete for admins only"
on public.roles for delete
to authenticated
using (public.is_admin());

-- Permissions
create policy "Enable read access for all authenticated users"
on public.permissions for select
to authenticated
using (true);

create policy "Enable write for admins only"
on public.permissions for all
to authenticated
using (public.is_admin());

-- Role Permissions
create policy "Enable read access for all authenticated users"
on public.role_permissions for select
to authenticated
using (true);

create policy "Enable write for admins only"
on public.role_permissions for all
to authenticated
using (public.is_admin());


-- 2. User Roles Policies
-- ---------------------------------------------------------
-- Users can see their own roles. Admins can see all.
create policy "Enable read for own roles or admins"
on public.user_roles for select
to authenticated
using (
  user_id = auth.uid() 
  or 
  public.is_admin()
);

-- Only Admins can assign/revoke roles
create policy "Enable write for admins only"
on public.user_roles for all
to authenticated
using (public.is_admin());


-- 3. Inventory Tables Policies
-- Common Pattern: Read for all Authed, Write for Admin/Storekeeper/Developer
-- ---------------------------------------------------------

-- Aluminum Accessories
create policy "Enable read access for all authenticated users"
on public.aluminum_accessories for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.aluminum_accessories for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
);

-- Aluminum Profiles
create policy "Enable read access for all authenticated users"
on public.aluminum_profiles for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.aluminum_profiles for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
);

-- Glass Types
create policy "Enable read access for all authenticated users"
on public.glass_types for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.glass_types for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
  -- Note: Maybe 'Sales' needs write? usually sales just reads stock.
);

-- Glass Sheets
create policy "Enable read access for all authenticated users"
on public.glass_sheets for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.glass_sheets for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
);

-- Glass Remnants
create policy "Enable read access for all authenticated users"
on public.glass_remnants for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.glass_remnants for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
  -- Remnants might be created by Tables (TableChief) when cutting? 
  -- Adding TableChief just in case, or stick to requested strictness.
  -- user didn't ask for TableChief write access yet, so sticking to safe defaults.
);

-- Glass Accessories
create policy "Enable read access for all authenticated users"
on public.glass_accessories for select
to authenticated
using (true);

create policy "Enable write for authorized roles"
on public.glass_accessories for all
to authenticated
using (
  public.is_admin() 
  or public.has_role('Storekeeper') 
  or public.has_role('Developer')
);

-- 4. Profiles (Refining if needed)
-- ---------------------------------------------------------
-- Assuming profiles table exists as per update_profiles.sql
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Public profiles are viewable by everyone"
on public.profiles for select
to authenticated
using (true);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid());

create policy "Admins can update any profile"
on public.profiles for update
to authenticated
using (public.is_admin());
