-- 1. Create the new permission
-- We ONLY create the permission here. The user will assign it to roles via the "Gestión de Roles" UI.
INSERT INTO public.permissions (code, description)
VALUES ('cuts:update_status', 'Allows changing the status of order cuts')
ON CONFLICT (code) DO NOTHING;

-- 2. Update RLS on order_cuts
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
-- You must assign 'cuts:update_status' to the relevant roles in the Admin > Roles page.
