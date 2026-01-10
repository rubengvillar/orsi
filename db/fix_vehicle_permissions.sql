-- 1. Ensure permissions exist (idempotent)
INSERT INTO public.permissions (code, description) VALUES
    ('vehicles:view', 'Can view vehicle list'),
    ('vehicles:manage', 'Can create, update, and delete vehicles')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign these permissions to the 'Admin' role
WITH admin_role AS (
    SELECT id FROM public.roles WHERE name = 'Admin' LIMIT 1
),
vehicle_perms AS (
    SELECT id FROM public.permissions WHERE code IN ('vehicles:view', 'vehicles:manage')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT admin_role.id, vehicle_perms.id
FROM admin_role, vehicle_perms
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Also assign to 'Developer' if exists, just in case
WITH dev_role AS (
    SELECT id FROM public.roles WHERE name = 'Developer' LIMIT 1
),
vehicle_perms AS (
    SELECT id FROM public.permissions WHERE code IN ('vehicles:view', 'vehicles:manage')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT dev_role.id, vehicle_perms.id
FROM dev_role, vehicle_perms
ON CONFLICT (role_id, permission_id) DO NOTHING;
