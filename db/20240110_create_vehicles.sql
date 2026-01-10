-- 1. Create Vehicles Table
CREATE TABLE public.vehicles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand text NOT NULL,
    model text NOT NULL,
    license_plate text UNIQUE NOT NULL,
    max_passengers integer DEFAULT 2,
    -- Load dimensions in mm
    max_load_width_mm integer DEFAULT 0,  -- For warning checks
    max_load_height_mm integer DEFAULT 0, -- For warning checks
    max_load_length_mm integer DEFAULT 0, -- Optional, if carrying profiles
    
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- 3. Create permissions
INSERT INTO public.permissions (code, description) VALUES
    ('vehicles:view', 'Can view vehicle list'),
    ('vehicles:manage', 'Can create, update, and delete vehicles')
ON CONFLICT (code) DO NOTHING;

-- 4. RLS Policies

-- View: Authenticated users with 'vehicles:view' OR 'vehicles:manage' can view
CREATE POLICY "Vehicles viewable by permission"
ON public.vehicles FOR SELECT
TO authenticated
USING (
    public.has_permission('vehicles:view') OR 
    public.has_permission('vehicles:manage')
);

-- Manage: Authenticated users with 'vehicles:manage' can insert/update/delete
CREATE POLICY "Vehicles manageable by permission"
ON public.vehicles FOR ALL
TO authenticated
USING (public.has_permission('vehicles:manage'))
WITH CHECK (public.has_permission('vehicles:manage'));
