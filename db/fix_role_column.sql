-- FIX FOR MISSING ROLE COLUMN
-- This script ensures the 'role' column exists and is part of the primary key.

DO $$ 
BEGIN
    -- 1. Add the column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_operators' 
        AND column_name = 'role'
    ) THEN
        -- We need to drop the existing primary key constraint first if we want to change it
        -- Usually PK name is {table}_pkey
        ALTER TABLE public.order_operators DROP CONSTRAINT IF EXISTS order_operators_pkey;
        
        ALTER TABLE public.order_operators ADD COLUMN role text NOT NULL DEFAULT 'Cutter' CHECK (role IN ('Cutter', 'Installer'));
        
        -- Re-add the primary key including the role
        ALTER TABLE public.order_operators ADD PRIMARY KEY (order_id, operator_id, role);
    END IF;
END $$;

-- Force a schema reload in Supabase/PostgREST cache
NOTIFY pgrst, 'reload schema';
