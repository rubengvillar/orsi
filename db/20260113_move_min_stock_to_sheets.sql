-- Move Min Stock from Type to Sheet
-- 1. Add min_stock to glass_sheets
ALTER TABLE public.glass_sheets
ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 0;

-- 2. Migrate existing min_stock from glass_types to ALL associated sheets
-- This ensures existing rules are preserved at the sheet level (e.g. if type had min 5, all its sheets now have min 5)
UPDATE public.glass_sheets s
SET min_stock = t.min_stock_sheets
FROM public.glass_types t
WHERE s.glass_type_id = t.id
AND t.min_stock_sheets > 0;
