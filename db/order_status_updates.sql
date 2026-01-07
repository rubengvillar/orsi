-- ORDER STATUS UPDATES
-- -----------------------------------------------------------------------------

-- 1. Update Check Constraint for Statuses
-- We drop the old one and add the new one. 
-- Old one was named automatically likely, but let's find it or just update the column.
-- Alternatively, use a domain or just update the table.

ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'Pending', 
  'Ready for Cutting', 
  'Cut', 
  'In Progress', 
  'Installed', 
  'Completed', 
  'Cancelled'
));

-- Add description for new statuses if needed in documentation
COMMENT ON COLUMN public.orders.status IS 'Status of the order: Pending, Ready for Cutting, Cut, In Progress, Installed, Completed, Cancelled';
