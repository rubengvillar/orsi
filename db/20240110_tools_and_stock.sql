-- 1. Create Tools Table
CREATE TABLE public.tools (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    quantity_total integer DEFAULT 1,
    quantity_available integer DEFAULT 1,
    location text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Tools RLS
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

INSERT INTO public.permissions (code, description) VALUES
    ('inventory:tools:view', 'Can view tools inventory'),
    ('inventory:tools:write', 'Can manage tools inventory')
ON CONFLICT (code) DO NOTHING;

CREATE POLICY "Tools viewable by permission" ON public.tools FOR SELECT TO authenticated
USING (public.has_permission('inventory:tools:view') OR public.has_permission('inventory:tools:write'));

CREATE POLICY "Tools manageable by permission" ON public.tools FOR ALL TO authenticated
USING (public.has_permission('inventory:tools:write'))
WITH CHECK (public.has_permission('inventory:tools:write'));

-- 3. Enhance route_materials to link to stock and support tools
ALTER TABLE public.route_materials 
ADD COLUMN IF NOT EXISTS tool_id uuid REFERENCES public.tools(id),
ADD COLUMN IF NOT EXISTS aluminum_accessory_id uuid REFERENCES public.aluminum_accessories(id),
ADD COLUMN IF NOT EXISTS glass_accessory_id uuid REFERENCES public.glass_accessories(id),
ADD COLUMN IF NOT EXISTS is_returnable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS returned_at timestamptz,
ADD COLUMN IF NOT EXISTS returned_by_id uuid REFERENCES public.operators(id);

-- 4. Function to handle Tool Checkout/Return (Simplified Logic)
-- We will handle this usually via valid application logic or triggers. 
-- For safety, we'll create a helper function to modify tool stock.

CREATE OR REPLACE FUNCTION public.adjust_tool_stock(p_tool_id uuid, p_delta integer)
RETURNS void AS $$
BEGIN
    UPDATE public.tools
    SET quantity_available = quantity_available + p_delta
    WHERE id = p_tool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
