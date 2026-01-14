-- Refactor Glass Data Structure
-- 1. Add 'structure' to glass_types
ALTER TABLE public.glass_types 
ADD COLUMN IF NOT EXISTS structure text DEFAULT 'Simple';

-- 2. Add dimensions to glass_sheets
ALTER TABLE public.glass_sheets
ADD COLUMN IF NOT EXISTS width_mm integer,
ADD COLUMN IF NOT EXISTS height_mm integer;

-- 3. Migrate data: Copy std dimensions from types to existing sheets
UPDATE public.glass_sheets s
SET 
  width_mm = t.std_width_mm,
  height_mm = t.std_height_mm
FROM public.glass_types t
WHERE s.glass_type_id = t.id
AND s.width_mm IS NULL;

-- 4. Set defaults for new sheets (optional constraint, but better handled in app logic or not needed if mandatory)
-- For now, we leave them nullable during migration but they should be required in UI.

-- 5. Add NOT NULL constraint after migration if we want consistency
-- ALTER TABLE public.glass_sheets ALTER COLUMN width_mm SET NOT NULL;
-- ALTER TABLE public.glass_sheets ALTER COLUMN height_mm SET NOT NULL;
