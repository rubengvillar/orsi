-- Add INVENTORY_VIEW permission
INSERT INTO public.permissions (code, description)
VALUES ('inventory:view', 'Ver inventario general y estadísticas')
ON CONFLICT (code) DO NOTHING;

-- Grant to Admin role (optional but recommended)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'Admin' AND p.code = 'inventory:view'
ON CONFLICT DO NOTHING;
