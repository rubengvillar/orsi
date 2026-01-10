export interface Role {
    id: string;
    name: string;
    description: string | null;
}

export interface Permission {
    id: string;
    code: string;
    description: string | null;
}

export interface RolePermission {
    role_id: string;
    permission_id: string;
}

export interface UserRole {
    user_id: string;
    role_id: string;
}

export interface AluminumAccessory {
    id: string;
    code: string;
    description: string;
    quantity: number;
    min_stock: number;
    created_at: string;
}

export interface AluminumProfile {
    id: string;
    code: string;
    typology: string | null;
    color: string | null;
    description: string | null;
    quantity: number;
    length_mm: number;
    min_stock: number;
    created_at: string;
}

export interface GlassType {
    id: string;
    code: string;
    thickness_mm: string;
    color: string | null;
    description: string | null;
    min_stock_sheets: number;
    std_width_mm: number;
    std_height_mm: number;
    created_at: string;
}

export interface GlassSheet {
    id: string;
    glass_type_id: string;
    quantity: number;
    created_at: string;
}

export interface GlassRemnant {
    id: string;
    glass_type_id: string;
    width_mm: number;
    height_mm: number;
    quantity: number;
    location: string | null;
    created_at: string;
}

export interface GlassAccessory {
    id: string;
    code: string;
    description: string;
    quantity: number;
    min_stock: number;
    created_at: string;
}

export type Database = {
    public: {
        Tables: {
            roles: { Row: Role; Insert: Omit<Role, 'id'>; Update: Partial<Role> };
            permissions: { Row: Permission; Insert: Omit<Permission, 'id'>; Update: Partial<Permission> };
            role_permissions: { Row: RolePermission; Insert: RolePermission; Update: RolePermission };
            user_roles: { Row: UserRole; Insert: UserRole; Update: UserRole };
            aluminum_accessories: { Row: AluminumAccessory; Insert: Omit<AluminumAccessory, 'id'>; Update: Partial<AluminumAccessory> };
            aluminum_profiles: { Row: AluminumProfile; Insert: Omit<AluminumProfile, 'id'>; Update: Partial<AluminumProfile> };
            glass_types: { Row: GlassType; Insert: Omit<GlassType, 'id'>; Update: Partial<GlassType> };
            glass_sheets: { Row: GlassSheet; Insert: Omit<GlassSheet, 'id'>; Update: Partial<GlassSheet> };
            glass_remnants: { Row: GlassRemnant; Insert: Omit<GlassRemnant, 'id'>; Update: Partial<GlassRemnant> };
            glass_accessories: { Row: GlassAccessory; Insert: Omit<GlassAccessory, 'id'>; Update: Partial<GlassAccessory> };
            vehicles: { Row: Vehicle; Insert: Omit<Vehicle, 'id'>; Update: Partial<Vehicle> };
        };
    };
};

export interface Vehicle {
    id: string;
    brand: string;
    model: string;
    license_plate: string;
    max_passengers: number;
    max_load_width_mm: number;
    max_load_height_mm: number;
    max_load_length_mm: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
