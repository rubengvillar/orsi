-- 1. Create the new permission
INSERT INTO public.permissions (code, description)
VALUES ('cuts:update_status', 'Allows changing the status of order cuts')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign the permission to roles
-- Variables for permission IDs would be nice, but simple subqueries work
WITH perm AS (SELECT id FROM public.permissions WHERE code = 'cuts:update_status')
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, perm p
WHERE r.name IN ('Admin', 'Storekeeper', 'Sales', 'TableChief')
ON CONFLICT DO NOTHING;

-- 3. Update RLS on order_cuts
-- We add a specific policy for UPDATE that allows users with this permission.
-- Note: Requires that "Cuts viewable by authenticated" exists for SELECT (which it does).

DROP POLICY IF EXISTS "Cuts updateable by status permission" ON public.order_cuts;

CREATE POLICY "Cuts updateable by status permission"
ON public.order_cuts
FOR UPDATE
TO authenticated
USING (public.has_permission('cuts:update_status'))
WITH CHECK (public.has_permission('cuts:update_status'));

-- Note: The existing "Cuts manageable by permission" (orders:write) also allows UPDATE.
-- This new policy adds to it (OR condition), allowing those who ONLY have cuts:update_status to also update.
