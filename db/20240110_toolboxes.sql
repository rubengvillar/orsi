-- 1. Create Toolboxes Table
CREATE TABLE public.toolboxes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    assigned_to_team text, 
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create Toolbox Items Table
CREATE TABLE public.toolbox_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    toolbox_id uuid REFERENCES public.toolboxes(id) ON DELETE CASCADE,
    tool_id uuid REFERENCES public.tools(id) ON DELETE RESTRICT,
    quantity integer DEFAULT 1 CHECK (quantity > 0),
    created_at timestamptz DEFAULT now(),
    UNIQUE(toolbox_id, tool_id)
);

-- 3. Create Tool Losses Table
CREATE TABLE public.tool_losses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    toolbox_id uuid REFERENCES public.toolboxes(id) ON DELETE CASCADE,
    tool_id uuid REFERENCES public.tools(id) ON DELETE RESTRICT,
    quantity integer DEFAULT 1,
    reason text NOT NULL, -- 'Lost', 'Broken', 'Stolen'
    reported_by uuid REFERENCES public.operators(id), -- Optional
    reported_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.toolboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toolbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_losses ENABLE ROW LEVEL SECURITY;

-- 5. Permissions
INSERT INTO public.permissions (code, description) VALUES
    ('inventory:toolboxes:view', 'Can view toolboxes'),
    ('inventory:toolboxes:manage', 'Can manage toolboxes and report losses')
ON CONFLICT (code) DO NOTHING;

-- 6. Policies (Simplified)
CREATE POLICY "Toolboxes viewable" ON public.toolboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Toolboxes manageable" ON public.toolboxes FOR ALL TO authenticated USING (public.has_permission('inventory:toolboxes:manage'));

CREATE POLICY "Toolbox items viewable" ON public.toolbox_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Toolbox items manageable" ON public.toolbox_items FOR ALL TO authenticated USING (public.has_permission('inventory:toolboxes:manage'));

CREATE POLICY "Losses viewable" ON public.tool_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Losses manageable" ON public.tool_losses FOR ALL TO authenticated USING (public.has_permission('inventory:toolboxes:manage'));

-- 7. RPC for Transactional Item Management
-- Usage: select manage_toolbox_item(toolbox_id, tool_id, quantity_change)
-- Positive quantity_change adds to box (and deducts FROM stock)
-- Negative quantity_change removes from box (and adds TO stock)
CREATE OR REPLACE FUNCTION public.manage_toolbox_item(
    p_toolbox_id uuid,
    p_tool_id uuid,
    p_quantity_change integer
) RETURNS void AS $$
DECLARE
    v_current_available integer;
    v_current_box_qty integer;
BEGIN
    -- Check Tool Availability if adding
    IF p_quantity_change > 0 THEN
        SELECT quantity_available INTO v_current_available FROM public.tools WHERE id = p_tool_id;
        IF v_current_available < p_quantity_change THEN
            RAISE EXCEPTION 'Not enough tools in stock. Available: %', v_current_available;
        END IF;
    END IF;

    -- Update or Insert Toolbox Item
    IF EXISTS (SELECT 1 FROM public.toolbox_items WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id) THEN
        UPDATE public.toolbox_items
        SET quantity = quantity + p_quantity_change
        WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id;
        
        -- Cleanup if 0
        DELETE FROM public.toolbox_items WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id AND quantity <= 0;
    ELSE
        IF p_quantity_change > 0 THEN
            INSERT INTO public.toolbox_items (toolbox_id, tool_id, quantity)
            VALUES (p_toolbox_id, p_tool_id, p_quantity_change);
        ELSE
            RAISE EXCEPTION 'Cannot remove tool that is not in toolbox';
        END IF;
    END IF;

    -- Update Tool Stock (Invert logic: + to box means - from stock)
    UPDATE public.tools
    SET quantity_available = quantity_available - p_quantity_change
    WHERE id = p_tool_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC for Reporting Loss
-- Reporting a loss removes it from the toolbox but DOES NOT add it back to stock (it's gone).
CREATE OR REPLACE FUNCTION public.report_tool_loss(
    p_toolbox_id uuid,
    p_tool_id uuid,
    p_quantity integer,
    p_reason text,
    p_reported_by uuid
) RETURNS void AS $$
BEGIN
     -- Verify enough in box
     IF (SELECT quantity FROM public.toolbox_items WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id) < p_quantity THEN
        RAISE EXCEPTION 'Not enough tools in this toolbox to report as lost';
     END IF;

     -- Decrease from Box
     UPDATE public.toolbox_items
     SET quantity = quantity - p_quantity
     WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id;

     DELETE FROM public.toolbox_items WHERE toolbox_id = p_toolbox_id AND tool_id = p_tool_id AND quantity <= 0;
     
     -- Record Loss
     INSERT INTO public.tool_losses (toolbox_id, tool_id, quantity, reason, reported_by)
     VALUES (p_toolbox_id, p_tool_id, p_quantity, p_reason, p_reported_by);

     -- Note: We do NOT update public.tools quantity_available because it was already deducted when put in the box.
     -- However, we arguably SHOULD decrease quantity_total in public.tools to reflect permanent loss.
     UPDATE public.tools
     SET quantity_total = quantity_total - p_quantity
     WHERE id = p_tool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
