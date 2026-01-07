-- SECURITY FOR V_MATERIAL_INFO VIEW
-- -----------------------------------------------------------------------------

-- In PostgreSQL 15+, views can be defined as 'security invoker'.
-- This means that when a user queries the view, the RLS policies
-- of the underlying tables ARE applied.

-- Redefine the view with security_invoker = true
create or replace view public.v_material_info 
with (security_invoker = true)
as
  -- Aluminum Accessories
  select 
    id, 
    'aluminum_accessory' as material_type,
    code,
    description,
    description as display_name
  from public.aluminum_accessories

  union all

  -- Aluminum Profiles
  select 
    id, 
    'aluminum_profile' as material_type,
    code,
    description,
    code || ' - ' || description as display_name
  from public.aluminum_profiles

  union all

  -- Glass Sheets (Join with types to get names)
  select 
    gs.id, 
    'glass_sheet' as material_type,
    gt.code,
    gt.description,
    gt.code || ' (' || gt.thickness_mm || 'mm ' || coalesce(gt.color, '') || ')' as display_name
  from public.glass_sheets gs
  join public.glass_types gt on gs.glass_type_id = gt.id

  union all

  -- Glass Accessories
  select 
    id, 
    'glass_accessory' as material_type,
    code,
    description,
    description as display_name
  from public.glass_accessories;

-- Ensure authenticated users have select access
grant select on public.v_material_info to authenticated;

-- NOTE: If your PostgreSQL version is older than 15, 'security_invoker' is not supported
-- as a parameter in WITH (...). In that case, Supabase/PostgreSQL views created by 
-- 'postgres' user (the default in SQL Editor) bypass RLS. 
-- However, Supabase hosted projects are usually PG15+.
