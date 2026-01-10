-- Add columns for manual material entry and specific contact info
ALTER TABLE public.route_stops 
ADD COLUMN IF NOT EXISTS items_to_deliver text,
ADD COLUMN IF NOT EXISTS delivery_contact text;
