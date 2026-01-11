-- Add aluminum_profile_id to route_materials to support tracking profiles in logistics
ALTER TABLE public.route_materials 
ADD COLUMN IF NOT EXISTS aluminum_profile_id uuid REFERENCES public.aluminum_profiles(id);
