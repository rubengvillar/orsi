
-- Function to handle stock adjustments based on route_materials changes
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
        -- Marked as Returned (NULL -> DATE) => Add back to stock IF it is returnable
        -- Note: Usually only 'Tools' or 'Returnable items' should be added back. 
        -- Logic: If we 'returned' it, it means it's back in inventory.
        IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
             IF NEW.tool_id IS NOT NULL THEN
                UPDATE public.tools SET quantity_available = quantity_available + NEW.quantity WHERE id = NEW.tool_id;
             -- For accessories/profiles, depending on business logic, usually they are consumed. 
             -- But if marked 'returned', we assume they are back.
             ELSIF NEW.aluminum_accessory_id IS NOT NULL THEN
                UPDATE public.aluminum_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.aluminum_accessory_id;
             ELSIF NEW.glass_accessory_id IS NOT NULL THEN
                UPDATE public.glass_accessories SET quantity = quantity + NEW.quantity WHERE id = NEW.glass_accessory_id;
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
             ELSIF NEW.aluminum_profile_id IS NOT NULL THEN
                UPDATE public.aluminum_profiles SET quantity = quantity - NEW.quantity WHERE id = NEW.aluminum_profile_id;
             END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger Definition
DROP TRIGGER IF EXISTS on_route_material_change ON public.route_materials;
CREATE TRIGGER on_route_material_change
AFTER INSERT OR UPDATE OR DELETE ON public.route_materials
FOR EACH ROW EXECUTE FUNCTION public.handle_route_material_stock();
