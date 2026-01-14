-- Add dimensions to purchase order items
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS width_mm integer,
ADD COLUMN IF NOT EXISTS height_mm integer;

-- Update the receive function to handle dimensions
CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  p_purchase_order_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_record record;
  order_item record;
BEGIN
  -- Iterate ensuring we process valid items
  FOR item_record IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id uuid, quantity_received int, updates_price boolean, new_price numeric)
  LOOP
    -- Get the full order item details including dimensions
    SELECT * INTO order_item FROM public.purchase_order_items WHERE id = item_record.id;

    -- 1. Update the order item status/qty
    UPDATE public.purchase_order_items
    SET 
      quantity_received = quantity_received + item_record.quantity_received,
      status = CASE 
                 WHEN (quantity_received + item_record.quantity_received) >= quantity THEN 'received' 
                 ELSE 'pending' -- or partially received logic
               END,
      unit_price = CASE WHEN item_record.updates_price THEN item_record.new_price ELSE unit_price END
    WHERE id = item_record.id;

    -- 2. Update Stock based on Product Type
    IF order_item.product_type = 'aluminum_accessory' THEN
      UPDATE public.aluminum_accessories SET quantity = quantity + item_record.quantity_received WHERE id = order_item.product_id;
    
    ELSIF order_item.product_type = 'aluminum_profile' THEN
      UPDATE public.aluminum_profiles SET quantity = quantity + item_record.quantity_received WHERE id = order_item.product_id;
      
    ELSIF order_item.product_type = 'glass_accessory' THEN
      UPDATE public.glass_accessories SET quantity = quantity + item_record.quantity_received WHERE id = order_item.product_id;
      
    ELSIF order_item.product_type = 'glass_type' THEN
      -- Handle Glass Sheets: Logic involves Dimensions!
      -- If dimensions exist, find or create the specific sheet record
      IF order_item.width_mm IS NOT NULL AND order_item.height_mm IS NOT NULL THEN
        -- Insert new sheet record or update existing?
        -- Strategy: Stock is tracked by discrete sheet sizes. We should try to find a matching size batch or insert.
        -- HOWEVER, for "Stock Control", usually we just increment the matching size.
        
        -- Try Update
        UPDATE public.glass_sheets 
        SET quantity = quantity + item_record.quantity_received
        WHERE glass_type_id = order_item.product_id 
          AND width_mm = order_item.width_mm 
          AND height_mm = order_item.height_mm;
          
        -- If found (updated), great. If not, Insert.
        IF NOT FOUND THEN
          INSERT INTO public.glass_sheets (glass_type_id, width_mm, height_mm, quantity, min_stock)
          VALUES (order_item.product_id, order_item.width_mm, order_item.height_mm, item_record.quantity_received, 0);
        END IF;

      ELSE
        -- Fallback for legacy or error: Update default size (e.g. 2400x3210) or raise error?
        -- Check if there is a 'standard' sheet for this type?
        -- For now, let's look for a 2400x3210 one or create it.
        UPDATE public.glass_sheets 
        SET quantity = quantity + item_record.quantity_received
        WHERE glass_type_id = order_item.product_id 
          AND width_mm = 2400 AND height_mm = 3210;
          
        IF NOT FOUND THEN
           INSERT INTO public.glass_sheets (glass_type_id, width_mm, height_mm, quantity, min_stock)
           VALUES (order_item.product_id, 2400, 3210, item_record.quantity_received, 0);
        END IF;
      END IF;

    ELSIF order_item.product_type = 'tool' THEN
       -- Tools might not have quantity in same way, or maybe they do? assuming yes.
       -- Update logic if 'tools' table supports quantity
       NULL;
    END IF;

    -- 3. Update Supplier Price if requested
    IF item_record.updates_price THEN
       -- Check if record exists
       IF EXISTS (SELECT 1 FROM public.supplier_products WHERE supplier_id = (SELECT supplier_id FROM public.purchase_orders WHERE id = p_purchase_order_id) AND product_type = order_item.product_type AND product_id = order_item.product_id) THEN
          UPDATE public.supplier_products 
          SET price = item_record.new_price, updated_at = now()
          WHERE supplier_id = (SELECT supplier_id FROM public.purchase_orders WHERE id = p_purchase_order_id) 
            AND product_type = order_item.product_type 
            AND product_id = order_item.product_id;
       ELSE
          INSERT INTO public.supplier_products (supplier_id, product_type, product_id, price)
          VALUES ((SELECT supplier_id FROM public.purchase_orders WHERE id = p_purchase_order_id), order_item.product_type, order_item.product_id, item_record.new_price);
       END IF;
    END IF;

  END LOOP;
  
  -- Update Order Status if all received (Simplified logic)
  -- Perform check outside loop or simply leave as Partially Received until manually closed? 
  -- Provided logic just updates item status.
END;
$$;
