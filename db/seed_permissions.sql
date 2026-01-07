-- Seed Permissions and Role Assignments
-- -----------------------------------------------------------------------------

-- 1. DEFINE PERMISSIONS
-- Insert permissions if they don't exist.
-- Using ON CONFLICT logic or just clear and re-insert for the seed script.
-- For safety in dev, we will DELETE existing standard permissions and re-insert to ensure clean state.
-- BE CAREFUL running this in production if you have custom permissions.

-- List of known default permissions to track
-- Using a temporary table or CTE to insert nicely

INSERT INTO public.permissions (code, description) VALUES
  -- Dashboard
  ('dashboard.view', 'View the main dashboard'),

  -- Inventory: Aluminum Accessories
  ('inventory.aluminum.view', 'View aluminum accessories stock'),
  ('inventory.aluminum.manage', 'Create, update, delete aluminum accessories'),

  -- Inventory: Aluminum Profiles
  ('inventory.profiles.view', 'View aluminum profiles stock'),
  ('inventory.profiles.manage', 'Create, update, delete aluminum profiles'),

  -- Inventory: Glass (Sheets & Types)
  ('inventory.glass.view', 'View glass sheets and types'),
  ('inventory.glass.manage', 'Create, update, delete glass types and sheets'),

  -- Inventory: Glass Operations (Remnants & Accessories)
  ('inventory.glass_ops.view', 'View glass remnants and accessories'),
  ('inventory.glass_ops.manage', 'Manage glass remnants and accessories (daily operations)'),

  -- User Management
  ('users.view', 'View list of users'),
  ('users.manage', 'Create users, assign roles, promote to admin'),

  -- Role Management
  ('roles.view', 'View available roles and permissions'),
  ('roles.manage', 'Create and modify roles and permission assignments'),

  -- Order Management
  ('orders.view', 'View list of orders and details'),
  ('orders.manage', 'Create, update, cancel orders')
ON CONFLICT (code) DO UPDATE 
SET description = EXCLUDED.description;


-- 2. ASSIGN PERMISSIONS TO ROLES
-- We'll use a helper block to assign these based on Role definitions.

DO $$
DECLARE
  -- Role IDs
  r_admin uuid;
  r_dev uuid;
  r_store uuid;
  r_sales uuid;
  r_purch uuid;
  r_dir uuid;
  r_chief uuid;
BEGIN
  -- Get Role IDs
  SELECT id INTO r_admin FROM public.roles WHERE name = 'Admin';
  SELECT id INTO r_dev FROM public.roles WHERE name = 'Developer';
  SELECT id INTO r_store FROM public.roles WHERE name = 'Storekeeper';
  SELECT id INTO r_sales FROM public.roles WHERE name = 'Sales';
  SELECT id INTO r_purch FROM public.roles WHERE name = 'Purchasing';
  SELECT id INTO r_dir FROM public.roles WHERE name = 'Director';
  SELECT id INTO r_chief FROM public.roles WHERE name = 'TableChief';

  -- Clear existing assignments for these standard roles to prevent duplicates/stale data
  -- Only clearing entries that match our known roles
  DELETE FROM public.role_permissions WHERE role_id IN (r_admin, r_dev, r_store, r_sales, r_purch, r_dir, r_chief);

  -- A. ADMIN & DEVELOPER (ALL PERMISSIONS)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_admin, id FROM public.permissions
  UNION ALL
  SELECT r_dev, id FROM public.permissions;

  -- B. STOREKEEPER (Dashboard + All Inventory View/Manage + Order View/Manage)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_store, id FROM public.permissions 
  WHERE code LIKE 'inventory.%' 
     OR code IN ('dashboard.view', 'orders.view', 'orders.manage');

  -- C. SALES & PURCHASING & DIRECTOR (Dashboard + All Inventory View + Order View)
  -- Sales also needs Order Manage
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_sales, id FROM public.permissions 
  WHERE (code LIKE 'inventory.%.view' OR code IN ('dashboard.view', 'orders.view', 'orders.manage'))
  UNION ALL
  SELECT r_purch, id FROM public.permissions 
  WHERE (code LIKE 'inventory.%.view' OR code IN ('dashboard.view', 'orders.view'))
  UNION ALL
  SELECT r_dir, id FROM public.permissions 
  WHERE (code LIKE 'inventory.%.view' OR code IN ('dashboard.view', 'orders.view'));

  -- D. TABLE CHIEF (Glass specific operations)
  -- Can View/Manage Glass & Glass Ops. Maybe View other stuff?
  -- Let's give View All Inventory, but only Manage Glass.
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_chief, id FROM public.permissions 
  WHERE 
    -- View all inventory
    (code LIKE 'inventory.%.view')
    OR 
    -- Manage only glass related
    (code IN ('inventory.glass.manage', 'inventory.glass_ops.manage'));

END $$;
