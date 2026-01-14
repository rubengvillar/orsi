-- Add weight_per_meter to aluminum_profiles
-- This allows calculating the cost/price by weight (kg)

ALTER TABLE public.aluminum_profiles 
ADD COLUMN IF NOT EXISTS weight_per_meter NUMERIC DEFAULT 0;

-- Optional: Add index if we frequently query or sort by weight (unlikely for now, but good practice if needed)
-- CREATE INDEX IF NOT EXISTS idx_aluminum_profiles_weight ON public.aluminum_profiles(weight_per_meter);
