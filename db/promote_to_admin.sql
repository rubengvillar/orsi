-- Function to promote a user to Admin by email
create or replace function public.promote_to_admin(user_email text)
returns text
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
  admin_role_id uuid;
begin
  -- Get User ID
  select id into target_user_id from auth.users where email = user_email;
  if target_user_id is null then
    return 'Error: User not found';
  end if;

  -- Get Admin Role ID
  select id into admin_role_id from public.roles where name = 'Admin';
  if admin_role_id is null then
    return 'Error: Admin role not found';
  end if;

  -- Assign Role (Upsert to handle existing)
  insert into public.user_roles (user_id, role_id)
  values (target_user_id, admin_role_id)
  on conflict (user_id, role_id) do nothing;

  return 'Success: User ' || user_email || ' is now an Admin';
end;
$$;
