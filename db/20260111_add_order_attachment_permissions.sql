-- Add permissions for Order Attachments
-- 1. Insert new permissions
INSERT INTO permissions (code, description)
VALUES 
    ('orders:attachments:view', 'Ver archivos adjuntos en las órdenes'),
    ('orders:attachments:upload', 'Subir archivos adjuntos a las órdenes'),
    ('orders:attachments:delete', 'Eliminar archivos adjuntos de las órdenes')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign permissions to Admin role (default)
WITH admin_role AS (SELECT id FROM roles WHERE name = 'Admin'),
     new_perms AS (SELECT id FROM permissions WHERE code IN ('orders:attachments:view', 'orders:attachments:upload', 'orders:attachments:delete'))
INSERT INTO role_permissions (role_id, permission_id)
SELECT admin_role.id, new_perms.id FROM admin_role, new_perms
ON CONFLICT DO NOTHING;

-- 3. Update RLS Policies for order_attachments table

-- Drop existing lenient policies if they exist (naming convention from previous file)
DROP POLICY IF EXISTS "Attachments viewable by authenticated users" ON public.order_attachments;
DROP POLICY IF EXISTS "Attachments insertable by authenticated users" ON public.order_attachments;
DROP POLICY IF EXISTS "Attachments deletable by authenticated users" ON public.order_attachments;

-- Create new strict policies
CREATE POLICY "Attachments viewable by authorized users"
  ON public.order_attachments FOR SELECT
  TO authenticated
  USING (
    public.has_permission('orders:attachments:view') OR 
    -- Allow users to see attachments if they can view orders generally? 
    -- Strict adherence to new permission:
    public.has_permission('orders:attachments:view') OR
    public.is_admin()
  );

CREATE POLICY "Attachments insertable by authorized users"
  ON public.order_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('orders:attachments:upload') OR 
    public.is_admin()
  );

CREATE POLICY "Attachments deletable by authorized users"
  ON public.order_attachments FOR DELETE
  TO authenticated
  USING (
    public.has_permission('orders:attachments:delete') OR 
    public.is_admin()
  );

-- 4. Update RLS Policies for storage.objects (order_attachments bucket)

-- Drop existing policies
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_0" ON storage.objects; -- select
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_1" ON storage.objects; -- insert
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_2" ON storage.objects; -- update
DROP POLICY IF EXISTS "Give users access to own folder 1oj01k_3" ON storage.objects; -- delete

-- Create new policies
-- Note: storage.objects policies apply to ALL buckets, so we MUST filter by bucket_id
CREATE POLICY "View order attachments with permission"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order_attachments' AND (
      public.has_permission('orders:attachments:view') OR 
      public.is_admin()
    )
  );

CREATE POLICY "Upload order attachments with permission"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order_attachments' AND (
      public.has_permission('orders:attachments:upload') OR 
      public.is_admin()
    )
  );

-- Generally we don't allow UPDATE on storage objects for simple attachments (immutable usually), but if needed:
CREATE POLICY "Update order attachments with permission"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'order_attachments' AND (
      public.has_permission('orders:attachments:upload') OR -- treats upload/update similarly
      public.is_admin()
    )
  );

CREATE POLICY "Delete order attachments with permission"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order_attachments' AND (
      public.has_permission('orders:attachments:delete') OR 
      public.is_admin()
    )
  );
