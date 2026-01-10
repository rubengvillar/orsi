-- Update manufactured_at and installed_at to TIMESTAMPTZ
-- This allows storing both date and time

-- 1. manufactured_at
ALTER TABLE public.orders 
ALTER COLUMN manufactured_at TYPE TIMESTAMPTZ 
USING manufactured_at::timestamptz;

-- 2. installed_at
ALTER TABLE public.orders 
ALTER COLUMN installed_at TYPE TIMESTAMPTZ 
USING installed_at::timestamptz;
