-- 1. Create Routes Table
CREATE TABLE public.routes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    date date NOT NULL,
    vehicle_id uuid REFERENCES public.vehicles(id),
    driver_id uuid REFERENCES public.operators(id), -- Optional leader
    
    -- Array of installer IDs assigned to this route (The Crew)
    installer_ids uuid[] DEFAULT '{}',
    
    notes text,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. Create Route Stops (Linking Orders to Routes)
CREATE TABLE public.route_stops (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    
    arrival_time time NOT NULL,
    estimated_duration interval DEFAULT '01:00:00',
    
    -- Specific override for installers count if needed for planning
    installers_required integer DEFAULT 2,
    
    notes text, -- Specific instructions for this stop
    
    created_at timestamptz DEFAULT now(),
    
    UNIQUE (route_id, order_id) -- Prevent same order multiple times on same route
);

-- 3. Enable RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- 4. Permissions
INSERT INTO public.permissions (code, description) VALUES
    ('logistics:view', 'Can view logistics routes'),
    ('logistics:manage', 'Can create and edit logistics routes')
ON CONFLICT (code) DO NOTHING;

-- 5. RLS Policies

-- Routes
CREATE POLICY "Routes viewable by permission" ON public.routes FOR SELECT TO authenticated
USING (public.has_permission('logistics:view') OR public.has_permission('logistics:manage'));

CREATE POLICY "Routes manageable by permission" ON public.routes FOR ALL TO authenticated
USING (public.has_permission('logistics:manage'))
WITH CHECK (public.has_permission('logistics:manage'));

-- Route Stops
CREATE POLICY "Stops viewable by permission" ON public.route_stops FOR SELECT TO authenticated
USING (public.has_permission('logistics:view') OR public.has_permission('logistics:manage'));

CREATE POLICY "Stops manageable by permission" ON public.route_stops FOR ALL TO authenticated
USING (public.has_permission('logistics:manage'))
WITH CHECK (public.has_permission('logistics:manage'));
