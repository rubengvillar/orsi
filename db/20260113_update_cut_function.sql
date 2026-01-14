-- Update function to handle specific sheet ID deduction
create or replace function public.execute_cut_confirmation(
  p_glass_type_id uuid,
  p_source_type text, -- 'sheet' or 'remnant'
  p_source_id uuid,   -- ID of glass_sheets OR glass_remnants
  p_cuts_ids uuid[],  
  p_new_remnants jsonb 
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
    -- Deduct 1 from SPECIFIC sheet record
    update public.glass_sheets 
    set quantity = quantity - 1 
    where id = p_source_id;
    
    -- Optional: Delete if 0? Or keep for re-stocking? Usually keep sheets even if 0.
  elsif p_source_type = 'remnant' then
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
end;
$$;
