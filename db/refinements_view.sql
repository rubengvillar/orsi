-- Unified Material Information View
-- -----------------------------------------------------------------------------

create or replace view public.v_material_info as
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

-- Grant access to authenticated users
grant select on public.v_material_info to authenticated;
