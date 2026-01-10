-- 1. Create table for Route Materials (General Load / Tools)
CREATE TABLE public.route_materials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
    
    description text NOT NULL,
    quantity integer DEFAULT 1,
    
    -- Optional: Link to specific order if known (but can be null)
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    
    -- "Always received by an operator"
    receiver_operator_id uuid REFERENCES public.operators(id),
    
    created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS for route_materials
ALTER TABLE public.route_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route materials viewable by permission" ON public.route_materials FOR SELECT TO authenticated
USING (public.has_permission('logistics:view') OR public.has_permission('logistics:manage'));

CREATE POLICY "Route materials manageable by permission" ON public.route_materials FOR ALL TO authenticated
USING (public.has_permission('logistics:manage'))
WITH CHECK (public.has_permission('logistics:manage'));

-- 3. Add Proof of Delivery fields to route_stops
ALTER TABLE public.route_stops
ADD COLUMN IF NOT EXISTS photos_before jsonb DEFAULT '[]'::jsonb, -- Array of { url: string, timestamp: string }
ADD COLUMN IF NOT EXISTS photos_after jsonb DEFAULT '[]'::jsonb,  -- Array of { url: string, timestamp: string }
ADD COLUMN IF NOT EXISTS signature_data text, -- Base64 or URL
ADD COLUMN IF NOT EXISTS signed_at timestamptz,
ADD COLUMN IF NOT EXISTS signed_by_name text;

-- 4. Storage Bucket for Logistics (Optional - assuming 'images' bucket exists or similar)
-- For now we rely on the existing storage logic or assume simple URL storage if using external, 
-- but usually Supabase needs a bucket. We'll assume a 'logistics-proofs' bucket might be needed 
-- or we use a general one. I'll omit bucket creation SQL as it's often done via API/UI or 
-- requires specific extensions, but I will ensure the FE handles uploads.
