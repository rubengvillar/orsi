-- PURCHASING SYSTEM SETUP SCRIPT
-- This script creates the necessary tables, functions, and permissions for the Purchasing module.

-- 1. Create Tables

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Products (Polymorphic link to Inventory)
CREATE TABLE IF NOT EXISTS public.supplier_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    product_type TEXT NOT NULL CHECK (product_type IN ('aluminum_accessory', 'aluminum_profile', 'glass_type', 'glass_accessory', 'tool')),
    product_id UUID NOT NULL,
    sku TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ARS',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(supplier_id, product_type, product_id)
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number SERIAL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'partially_received', 'completed', 'cancelled')),
    expected_delivery_date DATE,
    notes TEXT,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    is_manual BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_type TEXT NOT NULL CHECK (product_type IN ('aluminum_accessory', 'aluminum_profile', 'glass_type', 'glass_accessory', 'tool')),
    product_id UUID NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL DEFAULT 0,
    quantity_received NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Receiving Function
CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
    p_purchase_order_id UUID,
    p_items JSONB -- Array: { id, quantity_received, updates_price, new_price }
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    item_record RECORD;
    item_data JSONB;
    v_qty_received NUMERIC;
    v_product_type TEXT;
    v_product_id UUID;
    v_new_price NUMERIC;
    v_updates_price BOOLEAN;
    v_all_received BOOLEAN;
BEGIN
    FOR item_data IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty_received := (item_data->>'quantity_received')::NUMERIC;
        v_updates_price := (item_data->>'updates_price')::BOOLEAN;
        v_new_price := (item_data->>'new_price')::NUMERIC;
        
        SELECT * INTO item_record FROM public.purchase_order_items WHERE id = (item_data->>'id')::UUID;
        
        IF item_record IS NULL THEN
            RAISE EXCEPTION 'Purchase Order Item % not found', (item_data->>'id');
        END IF;

        v_product_type := item_record.product_type;
        v_product_id := item_record.product_id;

        -- Update PO Item
        UPDATE public.purchase_order_items
        SET 
            quantity_received = quantity_received + v_qty_received,
            status = CASE 
                WHEN (quantity_received + v_qty_received) >= quantity THEN 'received' 
                ELSE 'pending' 
            END
        WHERE id = item_record.id;

        -- Update Stock
        IF v_product_type = 'aluminum_accessory' THEN
            UPDATE public.aluminum_accessories SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'aluminum_profile' THEN
            UPDATE public.aluminum_profiles SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'glass_accessory' THEN
            UPDATE public.glass_accessories SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'glass_type' THEN
            INSERT INTO public.glass_sheets (glass_type_id, quantity) VALUES (v_product_id, v_qty_received);
        ELSIF v_product_type = 'tool' THEN
             UPDATE public.tools SET quantity_total = quantity_total + v_qty_received, quantity_available = quantity_available + v_qty_received WHERE id = v_product_id;
        END IF;

        -- Update Supplier Price
        IF v_updates_price AND v_new_price > 0 THEN
             INSERT INTO public.supplier_products (supplier_id, product_type, product_id, price)
             VALUES (
                (SELECT supplier_id FROM public.purchase_orders WHERE id = p_purchase_order_id),
                v_product_type,
                v_product_id,
                v_new_price
             )
             ON CONFLICT (supplier_id, product_type, product_id) 
             DO UPDATE SET price = EXCLUDED.price, updated_at = NOW();
        END IF;
    END LOOP;

    -- Update PO Status
    SELECT bool_and(status = 'received') INTO v_all_received 
    FROM public.purchase_order_items 
    WHERE purchase_order_id = p_purchase_order_id;

    IF v_all_received THEN
        UPDATE public.purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = p_purchase_order_id;
    ELSE
        UPDATE public.purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = p_purchase_order_id;
    END IF;
END;
$$;

-- 3. Insert Permissions
-- Using INSERT ... ON CONFLICT DO NOTHING to match permissions in src/lib/permissions.ts

INSERT INTO public.permissions (code, description) VALUES
('purchases:view', 'Can view the main Purchasing dashboard'),
('suppliers:view', 'Can view list of Suppliers'),
('suppliers:write', 'Can create, edit, or delete Suppliers'),
('purchase_orders:view', 'Can view Purchase Orders'),
('purchase_orders:write', 'Can create, edit, submit, and receive Purchase Orders')
ON CONFLICT (code) DO NOTHING;

-- 4. Assign Permissions to Admin Role (Example)
-- Assuming a role named 'Admin' or 'Super Admin' exists. 
-- Adjust the role name as per your production DB.

DO $$
DECLARE
    v_role_id UUID;
BEGIN
    SELECT id INTO v_role_id FROM public.roles WHERE name IN ('Admin', 'Super Admin', 'Administrador') LIMIT 1;
    
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, id FROM public.permissions 
        WHERE code IN (
            'purchases:view', 
            'suppliers:view', 
            'suppliers:write', 
            'purchase_orders:view', 
            'purchase_orders:write'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
