-- SCRIPT: Ensure 'orders:write' permission is mapped to roles
-- Run this in your Supabase SQL Editor

-- 1. Ensure the permission code exists in the PERMISSIONS table
INSERT INTO public.permissions (code, description)
VALUES ('orders:write', 'Crear, editar y gestionar estados de pedidos')
ON CONFLICT (code) DO UPDATE 
SET description = EXCLUDED.description;

-- 2. Assign this permission to all relevant ROLES
-- We use a DO block to look up IDs dynamically

DO $$
DECLARE
  v_perm_id uuid;
  v_role_id uuid;
  v_role_name text;
  v_roles text[] := ARRAY['Admin', 'Storekeeper', 'Sales', 'Developer', 'TableChief'];
BEGIN
  -- Get Permission ID
  SELECT id INTO v_perm_id FROM public.permissions WHERE code = 'orders:write';
  
  IF v_perm_id IS NULL THEN
    RAISE EXCEPTION 'Permission orders:write not found even after insert!';
  END IF;

  -- Loop through roles and assign permission
  FOREACH v_role_name IN ARRAY v_roles
  LOOP
    -- Get Role ID
    SELECT id INTO v_role_id FROM public.roles WHERE name = v_role_name;
    
    -- If role exists, insert mapping
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
      
      RAISE NOTICE 'Assigned orders:write to role: %', v_role_name;
    ELSE
      RAISE NOTICE 'Role % does not exist, skipping.', v_role_name;
    END IF;
  END LOOP;
END $$;

-- 3. VERIFICATION QUERY (Optional - Run to see results)
SELECT 
    r.name as role_name, 
    p.code as permission_code
FROM public.role_permissions rp
JOIN public.roles r ON rp.role_id = r.id
JOIN public.permissions p ON rp.permission_id = p.id
WHERE p.code = 'orders:write';
