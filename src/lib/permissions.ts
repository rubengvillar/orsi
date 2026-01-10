export const PERMISSIONS = {
    DASHBOARD: 'dashboard:view',

    INVENTORY_ACCESSORIES_VIEW: 'inventory:accessories:view',
    INVENTORY_ACCESSORIES_WRITE: 'inventory:accessories:write',

    INVENTORY_PROFILES_VIEW: 'inventory:profiles:view',
    INVENTORY_PROFILES_WRITE: 'inventory:profiles:write',

    INVENTORY_GLASS_VIEW: 'inventory:glass:view',
    INVENTORY_GLASS_WRITE: 'inventory:glass:write',

    INVENTORY_GLASS_ACCESSORIES_VIEW: 'inventory:glass-accessories:view',
    INVENTORY_GLASS_ACCESSORIES_WRITE: 'inventory:glass-accessories:write',

    OPTIMIZER_VIEW: 'optimizer:view',
    OPTIMIZER_RUN: 'optimizer:run',

    CUTS_VIEW: 'cuts:view',

    ORDERS_VIEW: 'orders:view',
    ORDERS_WRITE: 'orders:write',

    ADMIN_USERS_VIEW: 'admin:users:view',
    ADMIN_USERS_WRITE: 'admin:users:write',

    ADMIN_OPERATORS_VIEW: 'admin:operators:view',
    ADMIN_OPERATORS_WRITE: 'admin:operators:write',

    ADMIN_ROLES_VIEW: 'admin:roles:view',
    ADMIN_ROLES_WRITE: 'admin:roles:write',

    ADMIN_PERMISSIONS_VIEW: 'admin:permissions:view',
    ADMIN_PERMISSIONS_WRITE: 'admin:permissions:write',

    ADMIN_AUDIT_VIEW: 'admin:audit:view',

    ADMIN_ORDER_STATUSES_VIEW: 'admin:order-statuses:view',
    ADMIN_ORDER_STATUSES_WRITE: 'admin:order-statuses:write',

    ADMIN_VEHICLES_VIEW: 'vehicles:view',
    ADMIN_VEHICLES_WRITE: 'vehicles:manage',
};

export const PATH_PERMISSIONS: Record<string, string> = {
    '/dashboard': PERMISSIONS.DASHBOARD,
    '/orders': PERMISSIONS.ORDERS_VIEW,
    '/inventory/accessories': PERMISSIONS.INVENTORY_ACCESSORIES_VIEW,
    '/inventory/profiles': PERMISSIONS.INVENTORY_PROFILES_VIEW,
    '/inventory/glass': PERMISSIONS.INVENTORY_GLASS_VIEW,
    '/inventory/glass-accessories': PERMISSIONS.INVENTORY_GLASS_ACCESSORIES_VIEW,
    '/inventory/optimizer': PERMISSIONS.OPTIMIZER_VIEW,
    '/inventory/cuts': PERMISSIONS.CUTS_VIEW,
    '/admin/users': PERMISSIONS.ADMIN_USERS_VIEW,
    '/admin/operators': PERMISSIONS.ADMIN_OPERATORS_VIEW,
    '/admin/roles': PERMISSIONS.ADMIN_ROLES_VIEW,
    '/admin/permissions': PERMISSIONS.ADMIN_PERMISSIONS_VIEW,
    '/admin/audit': PERMISSIONS.ADMIN_AUDIT_VIEW,
    '/admin/order-statuses': PERMISSIONS.ADMIN_ORDER_STATUSES_VIEW,
    '/admin/vehicles': PERMISSIONS.ADMIN_VEHICLES_VIEW,
    '/orders/': PERMISSIONS.ORDERS_VIEW, // Prefix match for dynamic order IDs
};
