-- 1. Restore UNIQUE constraint on aluminum_profiles (since we want it to be the "Type")
-- First verify if we have dupes from previous testing and merge/delete them if needed.
-- DELETE FROM aluminum_profiles a USING aluminum_profiles b WHERE a.id < b.id AND a.code = b.code;
ALTER TABLE public.aluminum_profiles 
ADD CONSTRAINT aluminum_profiles_code_key UNIQUE (code);

-- 2. Create aluminum_remnants table (Child of Profile)
CREATE TABLE IF NOT EXISTS public.aluminum_remnants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    aluminum_profile_id uuid REFERENCES public.aluminum_profiles(id) ON DELETE CASCADE,
    length_mm numeric NOT NULL,
    quantity integer DEFAULT 1,
    location text,
    created_at timestamptz DEFAULT now()
);

-- 3. Add column to route_materials
ALTER TABLE public.route_materials 
ADD COLUMN IF NOT EXISTS aluminum_remnant_id uuid REFERENCES public.aluminum_remnants(id);

-- 4. Update Trigger Function (Prioritize Remnant logic)
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
        
        -- PROFILE REMNANT LOGIC
        ELSIF NEW.aluminum_remnant_id IS NOT NULL THEN
            UPDATE public.aluminum_remnants SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_remnant_id;
        -- FALLBACK TO PROFILE BAR IF NO REMNANT SELECTED
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
            
            -- POFILE REMNANT LOGIC
            ELSIF OLD.aluminum_remnant_id IS NOT NULL THEN
                UPDATE public.aluminum_remnants SET quantity = quantity + OLD.quantity WHERE id = OLD.aluminum_remnant_id;
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
            
            -- REMNANT LOGIC
            ELSIF NEW.aluminum_remnant_id IS NOT NULL THEN
                UPDATE public.aluminum_remnants SET quantity = quantity - v_qty_diff WHERE id = NEW.aluminum_remnant_id;
            ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity - v_qty_diff WHERE id = NEW.aluminum_profile_id;
            END IF;
        END IF;

        -- 2. Returned Status Change?
        -- Marked as Returned (NULL -> DATE) => Add back to stock IF it is returnable
        IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available + NEW.quantity WHERE id = NEW.tool_id;
             ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_accessory_id;
             ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.glass_accessory_id;
             
             -- REMNANT LOGIC
             ELSIF NEW.aluminum_remnant_id IS NOT NULL THEN
                UPDATE public.aluminum_remnants SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_remnant_id;
             ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_profile_id;
             END IF;
        
        -- Creating a 'Undo Return' (DATE -> NULL) => Deduct again
        ELSIF OLD.returned_at IS NOT NULL AND NEW.returned_at IS NULL THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available - NEW.quantity WHERE id = NEW.tool_id;
             ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_accessory_id;
             ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity - NEW.quantity WHERE id = NEW.glass_accessory_id;
             
             -- REMNANT LOGIC
             ELSIF NEW.aluminum_remnant_id IS NOT NULL THEN
                UPDATE public.aluminum_remnants SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_remnant_id;
             ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_profile_id;
             END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
