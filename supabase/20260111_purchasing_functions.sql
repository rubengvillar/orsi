-- RPC Function to receive items and update stock
CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
    p_purchase_order_id UUID,
    p_items JSONB -- Array of objects: { id (po_item_id), quantity_received, updates_price (bool), new_price (numeric) }
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    item_record RECORD;
    item_data JSONB;
    v_qty_received NUMERIC;
    v_product_type TEXT;
    v_product_id UUID;
    v_new_price NUMERIC;
    v_updates_price BOOLEAN;
    v_po_status TEXT;
    v_all_received BOOLEAN;
BEGIN
    -- Loop through the items provided in the JSON array
    FOR item_data IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Extract data
        v_qty_received := (item_data->>'quantity_received')::NUMERIC;
        v_updates_price := (item_data->>'updates_price')::BOOLEAN;
        v_new_price := (item_data->>'new_price')::NUMERIC;
        
        -- Get the PO Item details
        SELECT * INTO item_record FROM public.purchase_order_items WHERE id = (item_data->>'id')::UUID;
        
        IF item_record IS NULL THEN
            RAISE EXCEPTION 'Purchase Order Item % not found', (item_data->>'id');
        END IF;

        v_product_type := item_record.product_type;
        v_product_id := item_record.product_id;

        -- 1. Update Purchase Order Item
        UPDATE public.purchase_order_items
        SET 
            quantity_received = quantity_received + v_qty_received,
            status = CASE 
                WHEN (quantity_received + v_qty_received) >= quantity THEN 'received' 
                ELSE 'pending' 
            END
        WHERE id = item_record.id;

        -- 2. Update Stock (Dynamic based on product_type)
        IF v_product_type = 'aluminum_accessory' THEN
            UPDATE public.aluminum_accessories SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'aluminum_profile' THEN
            UPDATE public.aluminum_profiles SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'glass_accessory' THEN
            UPDATE public.glass_accessories SET quantity = quantity + v_qty_received WHERE id = v_product_id;
        ELSIF v_product_type = 'glass_type' THEN
            -- For glass types, we usually stock "sheets" in `glass_sheets` or just `glass_types`?
            -- Based on schema: `glass_sheets` links to `glass_type`. But `supplier_products` links to `glass_type` (product_id).
            -- If we are buying "sheets", we might need to insert into `glass_sheets` or update a summary.
            -- Looking at schema: `glass_sheets` has `quantity` and `glass_type_id`. It seems like individual sheets or batches?
            -- `glass_types` has no quantity column? Wait, let me check `glass_types` in `database.ts`.
            -- `glass_types` has `min_stock_sheets`. `glass_sheets` has `quantity` (count of sheets?).
            -- This is tricky. Let's assume for now we just insert a new batch into `glass_sheets` or update an existing one?
            -- Simpler approach: If `glass_sheets` tracks batches, we insert a new row? Or find a "general" row?
            -- Let's check `glass_sheets` definition again. 
            -- `id`, `glass_type_id`, `quantity` (number). 
            -- Probably we should just add to the total `quantity` of a generic record or create a new one?
            -- Let's just create a new record in `glass_sheets` for this delivery to be safe, or update the most recent one.
            -- Actually, to keep it simple and safe: Insert a new record into `glass_sheets`.
            INSERT INTO public.glass_sheets (glass_type_id, quantity) VALUES (v_product_id, v_qty_received);
            
        ELSIF v_product_type = 'tool' THEN
             UPDATE public.tools SET quantity_total = quantity_total + v_qty_received, quantity_available = quantity_available + v_qty_received WHERE id = v_product_id;
        END IF;

        -- 3. Update Supplier Price if requested
        IF v_updates_price AND v_new_price > 0 THEN
             -- Update the supplier_product entry
             -- We need the supplier_id from the PO
            UPDATE public.supplier_products
            SET price = v_new_price, updated_at = NOW()
            WHERE product_id = v_product_id 
              AND product_type = v_product_type 
              AND supplier_id = (SELECT supplier_id FROM public.purchase_orders WHERE id = p_purchase_order_id);
        END IF;

    END LOOP;

    -- 4. Check if PO is fully completed
    SELECT bool_and(status = 'received') INTO v_all_received 
    FROM public.purchase_order_items 
    WHERE purchase_order_id = p_purchase_order_id;

    IF v_all_received THEN
        UPDATE public.purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = p_purchase_order_id;
    ELSE
        UPDATE public.purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = p_purchase_order_id;
    END IF;

END;
$$;
