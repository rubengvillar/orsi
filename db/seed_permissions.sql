-- Permissions for Stock Control System
-- Use this script in Supabase SQL Editor to populate the permissions table.

INSERT INTO permissions (code, description)
VALUES 
    ('dashboard:view', 'Ver el tablero de indicadores generales'),
    
    ('inventory:accessories:view', 'Ver inventario de accesorios'),
    ('inventory:accessories:write', 'Crear, editar y eliminar accesorios'),
    
    ('inventory:profiles:view', 'Ver inventario de perfiles de aluminio'),
    ('inventory:profiles:write', 'Crear, editar y eliminar perfiles'),
    
    ('inventory:glass:view', 'Ver inventario de vidrios (hojas y rezagos)'),
    ('inventory:glass:write', 'Crear, editar y eliminar vidrios'),
    
    ('inventory:glass-accessories:view', 'Ver inventario de insumos de vidrio'),
    ('inventory:glass-accessories:write', 'Crear, editar y eliminar insumos de vidrio'),
    
    ('optimizer:view', 'Ver el optimizador de cortes'),
    ('optimizer:run', 'Ejecutar optimizaciones y confirmar cortes (descontar stock)'),
    
    ('cuts:view', 'Ver historial de cortes y remitos'),
    
    ('orders:view', 'Ver listado y detalles de pedidos'),
    ('orders:write', 'Crear, editar y gestionar estados de pedidos'),
    
    ('admin:users:view', 'Ver listado de usuarios del sistema'),
    ('admin:users:write', 'Gestionar usuarios (crear, editar, reset password)'),
    
    ('admin:operators:view', 'Ver listado de operarios'),
    ('admin:operators:write', 'Gestionar operarios'),
    
    ('admin:roles:view', 'Ver y gestionar roles de usuario'),
    ('admin:roles:write', 'Crear y editar roles y sus permisos'),
    
    ('admin:permissions:view', 'Ver listado de permisos del sistema'),
    ('admin:permissions:write', 'Gestionar la lista maestra de permisos'),
    
    ('admin:audit:view', 'Ver registros de auditoría y logs del sistema')
ON CONFLICT (code) 
DO UPDATE SET description = EXCLUDED.description;

-- Optional: List synchronized permissions
SELECT * FROM permissions ORDER BY code;
