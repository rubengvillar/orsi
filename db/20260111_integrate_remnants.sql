-- 1. Undo previous changes (if applied)
DROP TABLE IF EXISTS public.aluminum_remnants CASCADE;

-- 2. Modify aluminum_profiles to support remnants (same code, different length)
ALTER TABLE public.aluminum_profiles 
DROP CONSTRAINT IF EXISTS aluminum_profiles_code_key;

ALTER TABLE public.aluminum_profiles
ADD COLUMN IF NOT EXISTS location text;

-- 3. Cleanup route_materials
ALTER TABLE public.route_materials 
DROP COLUMN IF EXISTS aluminum_remnant_id;

-- 4. Restore Trigger Function (Simplified)
CREATE OR REPLACE FUNCTION public.handle_route_material_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_qty_diff integer;
BEGIN
    -- HANDLE INSERT
    IF (TG_OP = 'INSERT') THEN
        -- Deduct from stock if new item is added
        IF NEW.tool_id IS NOT NULL THEN
            UPDATE public.tools SET quantity_available = quantity_available - NEW.quantity WHERE id = NEW.tool_id;
        ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
            UPDATE public.aluminum_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_accessory_id;
        ELSIF NEW.glass_accessory_id IS NOT NULL THEN
            UPDATE public.glass_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.glass_accessory_id;
        ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
            UPDATE public.aluminum_profiles SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_profile_id;
        END IF;

        RETURN NEW;
    
    -- HANDLE DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        -- If it was NOT returned yet, give it back to stock
        IF OLD.returned_at IS NULL THEN
            IF OLD.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available + OLD.quantity WHERE id = OLD.tool_id;
            ELSIF OLD.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity + OLD.quantity WHERE id = OLD.aluminum_accessory_id;
            ELSIF OLD.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity + OLD.quantity WHERE id = OLD.glass_accessory_id;
            ELSIF OLD.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity + OLD.quantity WHERE id = OLD.aluminum_profile_id;
            END IF;
        END IF;
        RETURN OLD;

    -- HANDLE UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        
        -- 1. Quantity Change?
        v_qty_diff := NEW.quantity - OLD.quantity;
        IF v_qty_diff != 0 THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available - v_qty_diff WHERE id = NEW.tool_id;
            ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity - v_qty_diff WHERE id = NEW.aluminum_accessory_id;
            ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity - v_qty_diff WHERE id = NEW.glass_accessory_id;
            ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity - v_qty_diff WHERE id = NEW.aluminum_profile_id;
            END IF;
        END IF;

        -- 2. Returned Status Change?
        IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available + NEW.quantity WHERE id = NEW.tool_id;
             ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_accessory_id;
             ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.glass_accessory_id;
             ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_profile_id;
             END IF;
        
        -- Undo Return
        ELSIF OLD.returned_at IS NOT NULL AND NEW.returned_at IS NULL THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available - NEW.quantity WHERE id = NEW.tool_id;
             ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_accessory_id;
             ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.glass_accessory_id;
             ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_profile_id;
             END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
