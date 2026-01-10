-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create Permissions if they don't exist
INSERT INTO public.permissions (code, description) VALUES
    ('vehicles:view', 'Can view vehicle list'),
    ('vehicles:manage', 'Can create, update, and delete vehicles')
ON CONFLICT (code) DO NOTHING;

-- Policies
-- 1. View Policy
DROP POLICY IF EXISTS "Vehicles viewable by permission" ON public.vehicles;
CREATE POLICY "Vehicles viewable by permission" ON public.vehicles
    FOR SELECT
    TO authenticated
    USING (
        public.has_permission('vehicles:view') OR 
        public.has_permission('vehicles:manage')
    );

-- 2. Management Policy (Insert, Update, Delete)
DROP POLICY IF EXISTS "Vehicles manageable by permission" ON public.vehicles;
CREATE POLICY "Vehicles manageable by permission" ON public.vehicles
    FOR ALL
    TO authenticated
    USING (public.has_permission('vehicles:manage'))
    WITH CHECK (public.has_permission('vehicles:manage'));
