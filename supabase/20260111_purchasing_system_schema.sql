-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Suppliers Table
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

-- 2. Supplier Products (Price List & Linking)
CREATE TABLE IF NOT EXISTS public.supplier_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    
    -- Polymorphic link to inventory items
    product_type TEXT NOT NULL CHECK (product_type IN ('aluminum_accessory', 'aluminum_profile', 'glass_type', 'glass_accessory', 'tool')),
    product_id UUID NOT NULL,
    
    sku TEXT, -- Supplier's SKU for this product
    price NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ARS', -- 'ARS' or 'USD'
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(supplier_id, product_type, product_id)
);

-- 3. Purchase Orders
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
    
    is_manual BOOLEAN DEFAULT TRUE, -- TRUE if created manually, FALSE if from low-stock automation
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Purchase Order Items
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

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Basic Policies (allowing authenticated users full access for now, to be refined)
CREATE POLICY "Authenticated can full access suppliers" ON public.suppliers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can full access supplier_products" ON public.supplier_products
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can full access purchase_orders" ON public.purchase_orders
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can full access purchase_order_items" ON public.purchase_order_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
