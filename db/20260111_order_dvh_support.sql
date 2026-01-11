-- Modify order_cuts table to support DVH (Double Hermetic Glazing)

-- 1. Add cut_type column
ALTER TABLE public.order_cuts 
ADD COLUMN IF NOT EXISTS cut_type text DEFAULT 'simple' CHECK (cut_type IN ('simple', 'dvh'));

-- 2. Add DVH component columns (references)
ALTER TABLE public.order_cuts
ADD COLUMN IF NOT EXISTS dvh_outer_glass_id uuid REFERENCES public.glass_types(id),
ADD COLUMN IF NOT EXISTS dvh_inner_glass_id uuid REFERENCES public.glass_types(id),
ADD COLUMN IF NOT EXISTS dvh_chamber_id uuid REFERENCES public.glass_accessories(id);

-- 3. Make glass_type_id nullable (for DVH it might be null, or we could use it for 'simple')
ALTER TABLE public.order_cuts 
ALTER COLUMN glass_type_id DROP NOT NULL;

-- 4. Add Constraints to ensure data integrity
-- If simple, glass_type_id needed. If DVH, outer/inner/chamber needed.
ALTER TABLE public.order_cuts
ADD CONSTRAINT check_cut_type_data CHECK (
    (cut_type = 'simple' AND glass_type_id IS NOT NULL) OR
    (cut_type = 'dvh' AND dvh_outer_glass_id IS NOT NULL AND dvh_inner_glass_id IS NOT NULL AND dvh_chamber_id IS NOT NULL)
);
