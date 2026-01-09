-- Script to assign permissions to roles
-- This script assumes roles already exist in the 'roles' table
-- Run this AFTER running seed_permissions.sql

-- ============================================
-- ADMIN ROLE - Full access to everything
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- DEVELOPER ROLE - Full access for development
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Developer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- DIRECTOR ROLE - Full access except permissions management
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Director'
AND p.code NOT IN ('admin:permissions:write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- JEFE ALUMINIO - Full aluminum inventory + orders
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'JefeAluminio'
AND p.code IN (
    'dashboard:view',
    'inventory:accessories:view',
    'inventory:accessories:write',
    'inventory:profiles:view',
    'inventory:profiles:write',
    'orders:view',
    'orders:write',
    'admin:operators:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- JEFE MESA (Glass Department Head) - Full glass inventory + optimizer
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'JefeMesa'
AND p.code IN (
    'dashboard:view',
    'inventory:glass:view',
    'inventory:glass:write',
    'inventory:glass-accessories:view',
    'inventory:glass-accessories:write',
    'optimizer:view',
    'optimizer:run',
    'cuts:view',
    'orders:view',
    'orders:write',
    'admin:operators:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- PAÑOLERO (Warehouse Manager) - Full inventory management
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Pañolero'
AND p.code IN (
    'dashboard:view',
    'inventory:accessories:view',
    'inventory:accessories:write',
    'inventory:profiles:view',
    'inventory:profiles:write',
    'inventory:glass:view',
    'inventory:glass:write',
    'inventory:glass-accessories:view',
    'inventory:glass-accessories:write',
    'optimizer:view',
    'cuts:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- VENTAS (Sales) - Orders + view inventory
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Ventas'
AND p.code IN (
    'dashboard:view',
    'inventory:accessories:view',
    'inventory:profiles:view',
    'inventory:glass:view',
    'inventory:glass-accessories:view',
    'orders:view',
    'orders:write'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- COMPRAS (Purchasing) - View inventory + manage suppliers/operators
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id as role_id,
    p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Compras'
AND p.code IN (
    'dashboard:view',
    'inventory:accessories:view',
    'inventory:profiles:view',
    'inventory:glass:view',
    'inventory:glass-accessories:view',
    'admin:operators:view',
    'admin:operators:write'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- Verification: Show role permissions count
-- ============================================
SELECT 
    r.name as role_name,
    COUNT(rp.permission_id) as permissions_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name
ORDER BY r.name;

-- ============================================
-- Optional: Show detailed permissions per role
-- ============================================
-- Uncomment to see full details:
/*
SELECT 
    r.name as role_name,
    p.code as permission_code,
    p.description as permission_description
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.name, p.code;
*/
