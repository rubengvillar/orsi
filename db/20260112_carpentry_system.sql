-- ALUMIMUM CARPENTRY SYSTEM (ALUAR)
-- Creates tables for managing carpentry projects, units (windows/doors), and system definitions.

-- 1. Carpentry Systems (e.g., 'Modena', 'A30 New')
CREATE TABLE IF NOT EXISTS public.carpentry_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    brand TEXT DEFAULT 'Aluar',
    description TEXT,
    base_color TEXT, -- Default color for visualization or ordering
    configuration JSONB DEFAULT '{}', -- Store global system rules (e.g., default deductions)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. System Profiles (Mapping Inventory to System Roles)
CREATE TABLE IF NOT EXISTS public.system_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID NOT NULL REFERENCES public.carpentry_systems(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- e.g., 'frame_jamb', 'sash_top', 'bead'
    aluminum_profile_id UUID NOT NULL REFERENCES public.aluminum_profiles(id) ON DELETE RESTRICT,
    is_default BOOLEAN DEFAULT FALSE,
    properties JSONB DEFAULT '{}', -- Specific properties for this role (e.g., 'deduction_mm': 6)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(system_id, role, aluminum_profile_id)
);

-- 3. Carpentry Projects
CREATE TABLE IF NOT EXISTS public.carpentry_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_number SERIAL,
    name TEXT NOT NULL,
    client_name TEXT,
    client_address TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'production', 'completed')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Carpentry Units (Individual Windows/Doors)
CREATE TABLE IF NOT EXISTS public.carpentry_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.carpentry_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'V1 Kitchen'
    system_id UUID REFERENCES public.carpentry_systems(id),
    width NUMERIC NOT NULL,
    height NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    
    -- Configuration
    opening_type TEXT, -- 'sliding', 'fixed', 'projecting', 'bi-fold'
    glass_type_id UUID REFERENCES public.glass_types(id),
    glass_composition TEXT CHECK (glass_composition IN ('simple', 'dvh', 'laminated')),
    
    -- Advanced Geometry
    is_irregular BOOLEAN DEFAULT FALSE,
    geometry_data JSONB, -- Stores nodes/polygons for custom shapes: { "nodes": [{x,y}], "segments": [...] }
    
    -- Snapshot of costs
    estimated_cost NUMERIC DEFAULT 0,
    cost_breakdown JSONB, -- Cache the BOM result here
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Permissions
INSERT INTO public.permissions (code, description) VALUES
('carpentry:view', 'Can view carpentry projects'),
('carpentry:write', 'Can create and edit carpentry projects')
ON CONFLICT (code) DO NOTHING;

-- Auto-assign to Admin (assuming role id lookup logic or manual run)
-- (Skipping auto-assign logic here to avoid complexity in this file, ideally handled by seed script)

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_carpentry_units_project ON public.carpentry_units(project_id);
CREATE INDEX IF NOT EXISTS idx_system_profiles_system ON public.system_profiles(system_id);
