-- 1. Create new permissions
INSERT INTO permissions (code, description)
VALUES 
    ('orders:material:edit', 'Editar registros de uso de materiales'),
    ('orders:material:delete', 'Eliminar registros de uso de materiales')
ON CONFLICT (code) 
DO UPDATE SET description = EXCLUDED.description;

-- 2. Function to delete material usage and return to stock
create or replace function public.delete_material_usage(
  p_usage_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_usage record;
begin
  -- Get usage record
  select * into v_usage from public.material_usage where id = p_usage_id;
  
  if not found then
    raise exception 'Usage record not found';
  end if;

  -- Return to stock based on material type
  if v_usage.material_type = 'aluminum_accessory' then
    update public.aluminum_accessories set quantity = quantity + v_usage.quantity where id = v_usage.material_id;
  elsif v_usage.material_type = 'aluminum_profile' then
    update public.aluminum_profiles set quantity = quantity + v_usage.quantity where id = v_usage.material_id;
  elsif v_usage.material_type = 'glass_sheet' then
    update public.glass_sheets set quantity = quantity + v_usage.quantity where id = v_usage.material_id;
  elsif v_usage.material_type = 'glass_accessory' then
    update public.glass_accessories set quantity = quantity + v_usage.quantity where id = v_usage.material_id;
  end if;

  -- Delete the record
  delete from public.material_usage where id = p_usage_id;
end;
$$;

-- 3. Function to update material usage quantity and adjust stock
create or replace function public.update_material_usage_quantity(
  p_usage_id uuid,
  p_new_quantity numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_usage record;
  v_diff numeric;
  v_current_stock numeric;
begin
  if p_new_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  -- Get usage record
  select * into v_usage from public.material_usage where id = p_usage_id;
  
  if not found then
    raise exception 'Usage record not found';
  end if;

  v_diff := p_new_quantity - v_usage.quantity;
  
  -- If no change, exit
  if v_diff = 0 then
    return;
  end if;

  -- Adjust stock
  if v_usage.material_type = 'aluminum_accessory' then
    -- Check stock if consuming more
    if v_diff > 0 then
        select quantity into v_current_stock from public.aluminum_accessories where id = v_usage.material_id;
        if v_current_stock < v_diff then
            raise exception 'Insufficient stock to increase usage. Available: %, Needed: %', v_current_stock, v_diff;
        end if;
    end if;
    update public.aluminum_accessories set quantity = quantity - v_diff where id = v_usage.material_id;

  elsif v_usage.material_type = 'aluminum_profile' then
    if v_diff > 0 then
        select quantity into v_current_stock from public.aluminum_profiles where id = v_usage.material_id;
        if v_current_stock < v_diff then
            raise exception 'Insufficient stock to increase usage';
        end if;
    end if;
    update public.aluminum_profiles set quantity = quantity - v_diff where id = v_usage.material_id;

  elsif v_usage.material_type = 'glass_sheet' then
    if v_diff > 0 then
        select quantity into v_current_stock from public.glass_sheets where id = v_usage.material_id;
        if v_current_stock < v_diff then
            raise exception 'Insufficient stock to increase usage';
        end if;
    end if;
    update public.glass_sheets set quantity = quantity - v_diff where id = v_usage.material_id;

  elsif v_usage.material_type = 'glass_accessory' then
    if v_diff > 0 then
        select quantity into v_current_stock from public.glass_accessories where id = v_usage.material_id;
        if v_current_stock < v_diff then
            raise exception 'Insufficient stock to increase usage';
        end if;
    end if;
    update public.glass_accessories set quantity = quantity - v_diff where id = v_usage.material_id;
  end if;

  -- Update usage record
  update public.material_usage set quantity = p_new_quantity where id = p_usage_id;
end;
$$;

-- 4. Function to update usage details (operator)
create or replace function public.update_material_usage_details(
  p_usage_id uuid,
  p_operator_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.material_usage 
  set operator_id = p_operator_id 
  where id = p_usage_id;
end;
$$;
