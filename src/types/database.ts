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

export interface Route {
    id: string;
    date: string;
    vehicle_id: string | null;
    driver_id: string | null;
    installer_ids: string[] | null;
    notes: string | null;
    status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface RouteStop {
    id: string;
    route_id: string;
    order_id: string;
    arrival_time: string;
    estimated_duration: string | null;
    installers_required: number;
    notes: string | null;
    items_to_deliver: string | null;
    delivery_contact: string | null;

    // Proof of Delivery
    photos_before: { url: string; timestamp: string }[] | null;
    photos_after: { url: string; timestamp: string }[] | null;
    signature_data: string | null;
    signed_at: string | null;
    signed_by_name: string | null;

    created_at: string;
    order?: any; // For joins
}

export interface RouteMaterial {
    id: string;
    route_id: string;
    description: string;
    quantity: number;
    order_id: string | null;
    receiver_operator_id: string | null;
    created_at: string;
}


