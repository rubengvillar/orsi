-- Migration: Add provided_categories to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS provided_categories TEXT[] DEFAULT '{}';

-- Optional: Update existing suppliers to have all categories by default to avoid breaking existing orders
UPDATE public.suppliers 
SET provided_categories = ARRAY['aluminum_profile', 'aluminum_accessory', 'glass_type', 'glass_accessory', 'tool']
WHERE provided_categories = '{}';
