-- Create order_statuses table
CREATE TABLE IF NOT EXISTS public.order_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'gray',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default statuses
INSERT INTO public.order_statuses (name, label, color, sort_order) VALUES
('Pending', 'Pendiente', 'yellow', 10),
('Ready for Cutting', 'Listo para Corte', 'blue', 20),
('Cut', 'Cortado', 'indigo', 30),
('In Progress', 'En Progreso', 'orange', 40),
('Installed', 'Instalado', 'teal', 50),
('Completed', 'Completado', 'green', 60),
('Cancelled', 'Cancelado', 'red', 99)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

-- Policies for order_statuses
CREATE POLICY "Allow public read access to order_statuses"
ON public.order_statuses FOR SELECT
USING (true);

CREATE POLICY "Allow admin full access to order_statuses"
ON public.order_statuses FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND (r.name = 'Admin' OR r.name = 'Administrador')
    )
);

-- Update orders table to use foreign key instead of check constraint
-- First, drop the existing check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add foreign key constraint
-- Note: We assume existing statuses in 'orders' match the 'name' in 'order_statuses'.
-- If there are mismatches, this might fail or require data cleanup.
-- Start transaction to ensure atomicity
DO $$
BEGIN
    -- Optional: Update any legacy statuses if necessary before adding constraint
    -- UPDATE public.orders SET status = 'Pending' WHERE status NOT IN (SELECT name FROM public.order_statuses);
    
    ALTER TABLE public.orders
    ADD CONSTRAINT fk_orders_status
    FOREIGN KEY (status)
    REFERENCES public.order_statuses(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Existing data violates foreign key constraint. Please cleanup data first.';
END $$;
