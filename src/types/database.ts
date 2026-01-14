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
    weight_per_meter: number; // Added for weight-based costing
    created_at: string;
}

export interface AluminumRemnant {
    id: string;
    aluminum_profile_id: string;
    length_mm: number;
    quantity: number;
    location: string | null;
    created_at: string;
}

export interface GlassType {
    id: string;
    code: string;
    thickness_mm: string;
    color: string | null;
    structure: 'Simple' | 'Laminado' | 'DVH' | null; // Added structure
    description: string | null;
    min_stock_sheets?: number; // Deprecated
    std_width_mm?: number; // Deprecated
    std_height_mm?: number; // Deprecated
    created_at: string;
}

export interface GlassSheet {
    id: string;
    glass_type_id: string;
    width_mm: number; // Moved here
    height_mm: number; // Moved here
    quantity: number;
    min_stock: number; // Added
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

    // Inventory Links
    tool_id: string | null;
    aluminum_accessory_id: string | null;
    glass_accessory_id: string | null;
    aluminum_profile_id: string | null;
    aluminum_remnant_id: string | null;

    // Logic
    is_returnable: boolean;
    returned_at: string | null;
    returned_by_id: string | null;

    created_at: string;

    // Joins
    tool?: Tool;
}

export interface Tool {
    id: string;
    name: string;
    description: string | null;
    quantity_total: number;
    quantity_available: number;
    location: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Toolbox {
    id: string;
    name: string;
    description: string | null;
    assigned_to_team: string | null;
    team_id: string | null;
    is_active: boolean;
    created_at: string;
}

export interface ToolboxItem {
    id: string;
    toolbox_id: string;
    tool_id: string;
    quantity: number;
    created_at: string;
    tool?: Tool;
}

export interface ToolLoss {
    id: string;
    toolbox_id: string;
    tool_id: string;
    quantity: number;
    reason: string;
    reported_by: string;
    reported_at: string;
    tool?: Tool;
}



export interface Database {
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
            aluminum_remnants: { Row: AluminumRemnant; Insert: Omit<AluminumRemnant, 'id'>; Update: Partial<AluminumRemnant> };
            glass_accessories: { Row: GlassAccessory; Insert: Omit<GlassAccessory, 'id'>; Update: Partial<GlassAccessory> };

            vehicles: { Row: Vehicle; Insert: Omit<Vehicle, 'id'>; Update: Partial<Vehicle> };
            routes: { Row: Route; Insert: Omit<Route, 'id'>; Update: Partial<Route> };
            route_stops: { Row: RouteStop; Insert: Omit<RouteStop, 'id'>; Update: Partial<RouteStop> };
            route_materials: { Row: RouteMaterial; Insert: Omit<RouteMaterial, 'id'>; Update: Partial<RouteMaterial> };

            tools: { Row: Tool; Insert: Omit<Tool, 'id'>; Update: Partial<Tool> };
            toolboxes: { Row: Toolbox; Insert: Omit<Toolbox, 'id'>; Update: Partial<Toolbox> };
            toolbox_items: { Row: ToolboxItem; Insert: Omit<ToolboxItem, 'id'>; Update: Partial<ToolboxItem> };
            tool_losses: { Row: ToolLoss; Insert: Omit<ToolLoss, 'id'>; Update: Partial<ToolLoss> };

            // Orders
            orders: { Row: Order; Insert: Omit<Order, 'id'>; Update: Partial<Order> };
            order_cuts: { Row: OrderCut; Insert: Omit<OrderCut, 'id'>; Update: Partial<OrderCut> };

            // Purchasing
            suppliers: { Row: Supplier; Insert: Omit<Supplier, 'id'>; Update: Partial<Supplier> };
            supplier_products: { Row: SupplierProduct; Insert: Omit<SupplierProduct, 'id'>; Update: Partial<SupplierProduct> };
            purchase_orders: { Row: PurchaseOrder; Insert: Omit<PurchaseOrder, 'id'>; Update: Partial<PurchaseOrder> };
            purchase_order_items: { Row: PurchaseOrderItem; Insert: Omit<PurchaseOrderItem, 'id'>; Update: Partial<PurchaseOrderItem> };

            // Carpentry System
            carpentry_systems: { Row: CarpentrySystem; Insert: Omit<CarpentrySystem, 'id'>; Update: Partial<CarpentrySystem> };
            system_profiles: { Row: SystemProfile; Insert: Omit<SystemProfile, 'id'>; Update: Partial<SystemProfile> };
            carpentry_projects: { Row: CarpentryProject; Insert: Omit<CarpentryProject, 'id'>; Update: Partial<CarpentryProject> };
            carpentry_units: { Row: CarpentryUnit; Insert: Omit<CarpentryUnit, 'id'>; Update: Partial<CarpentryUnit> };
        };
    };
};

export interface CarpentrySystem {
    id: string;
    name: string;
    brand: string;
    description: string | null;
    base_color: string | null;
    configuration: any; // JSONB
    created_at: string;
}

export interface SystemProfile {
    id: string;
    system_id: string;
    role: string;
    aluminum_profile_id: string;
    is_default: boolean;
    properties: any; // JSONB
    created_at: string;
    // Joins
    aluminum_profile?: AluminumProfile;
}

export interface CarpentryProject {
    id: string;
    project_number: number;
    name: string;
    client_name: string | null;
    client_address: string | null;
    status: 'draft' | 'confirmed' | 'production' | 'completed';
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CarpentryUnit {
    id: string;
    project_id: string;
    name: string;
    system_id: string | null;
    width: number;
    height: number;
    quantity: number;
    opening_type: string | null;
    glass_type_id: string | null;
    glass_composition: 'simple' | 'dvh' | 'laminated' | null;
    is_irregular: boolean;
    geometry_data: any; // JSONB { nodes: [], segments: [] }
    estimated_cost: number;
    cost_breakdown: any; // JSONB
    created_at: string;
    updated_at: string;
    // Joins
    system?: CarpentrySystem;
    glass_type?: GlassType;
}

export interface Supplier {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id: string | null;
    notes: string | null;
    provided_categories: string[];
    created_at: string;
    updated_at: string;
}

export interface SupplierProduct {
    id: string;
    supplier_id: string;
    product_type: 'aluminum_accessory' | 'aluminum_profile' | 'glass_type' | 'glass_accessory' | 'tool';
    product_id: string;
    sku: string | null;
    price: number;
    currency: string | null;
    updated_at: string;
}

export interface PurchaseOrder {
    id: string;
    order_number: number;
    supplier_id: string;
    status: 'draft' | 'submitted' | 'partially_received' | 'completed' | 'cancelled';
    expected_delivery_date: string | null;
    notes: string | null;
    subtotal: number;
    tax: number;
    total: number;
    is_manual: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    supplier?: Supplier; // Join
}

export interface PurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    product_type: 'aluminum_accessory' | 'aluminum_profile' | 'glass_type' | 'glass_accessory' | 'tool';
    product_id: string;
    quantity: number;
    unit_price: number;
    quantity_received: number;
    width_mm?: number; // Added
    height_mm?: number; // Added
    status: 'pending' | 'received';
    created_at: string;
}

export interface Order {
    id: string;
    order_number: number;
    legacy_order_number: string | null;
    client_name: string;
    description: string;
    address: string | null;
    status: 'Pending' | 'Ready for Cutting' | 'Cut' | 'In Progress' | 'Installed' | 'Completed' | 'Cancelled';
    manufactured_at: string | null;
    installed_at: string | null;
    created_at: string;
    total_cuts?: number;
    total_area_m2?: number;
    priority?: boolean;
    estimated_installation_time: string | null;
}

export interface OrderCut {
    id: string;
    order_id: string;
    glass_type_id: string | null;
    cut_type: 'simple' | 'dvh';
    dvh_outer_glass_id: string | null;
    dvh_inner_glass_id: string | null;
    dvh_chamber_id: string | null;
    width_mm: number;
    height_mm: number;
    quantity: number;
    notes: string | null;
    status: 'pending' | 'cut';
    created_at: string;
    glass_types?: GlassType; // Joined
}
