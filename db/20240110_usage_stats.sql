-- Function to get usage statistics
-- Aggregates data from route_materials, order_cuts, and material_usage

CREATE OR REPLACE FUNCTION public.get_usage_statistics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats jsonb;
BEGIN
    SELECT jsonb_build_object(
        'aluminum_accessories', (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT 
                    a.code, 
                    a.description, 
                    SUM(COALESCE(rm.quantity, 0)) + SUM(COALESCE(mu.quantity, 0)) as total_used
                FROM public.aluminum_accessories a
                LEFT JOIN public.route_materials rm ON rm.aluminum_accessory_id = a.id AND rm.created_at BETWEEN p_start_date AND p_end_date
                LEFT JOIN public.material_usage mu ON mu.material_id = a.id AND mu.material_type = 'aluminum_accessory' AND mu.used_at BETWEEN p_start_date AND p_end_date
                GROUP BY a.id, a.code, a.description
                HAVING SUM(COALESCE(rm.quantity, 0)) + SUM(COALESCE(mu.quantity, 0)) > 0
                ORDER BY total_used DESC
                LIMIT 10
            ) t
        ),
        'glass_accessories', (
             SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT 
                    a.code, 
                    a.description, 
                    SUM(COALESCE(rm.quantity, 0)) + SUM(COALESCE(mu.quantity, 0)) as total_used
                FROM public.glass_accessories a
                LEFT JOIN public.route_materials rm ON rm.glass_accessory_id = a.id AND rm.created_at BETWEEN p_start_date AND p_end_date
                LEFT JOIN public.material_usage mu ON mu.material_id = a.id AND mu.material_type = 'glass_accessory' AND mu.used_at BETWEEN p_start_date AND p_end_date
                GROUP BY a.id, a.code, a.description
                HAVING SUM(COALESCE(rm.quantity, 0)) + SUM(COALESCE(mu.quantity, 0)) > 0
                ORDER BY total_used DESC
                LIMIT 10
            ) t
        ),
        'aluminum_profiles', (
             SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT 
                    p.code, 
                    p.description,
                    p.color,
                    SUM(COALESCE(mu.quantity, 0)) as total_used -- Only in material_usage for now
                FROM public.aluminum_profiles p
                LEFT JOIN public.material_usage mu ON mu.material_id = p.id AND mu.material_type = 'aluminum_profile' AND mu.used_at BETWEEN p_start_date AND p_end_date
                GROUP BY p.id, p.code, p.description, p.color
                HAVING SUM(COALESCE(mu.quantity, 0)) > 0
                ORDER BY total_used DESC
                LIMIT 10
            ) t
        ),
         'glass_types', (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
                SELECT 
                    g.thickness_mm || ' ' || COALESCE(g.color, '') as label,
                    COUNT(oc.id) as cuts_count,
                    SUM((oc.width_mm::bigint * oc.height_mm::bigint)) / 1000000.0 as total_area_m2
                FROM public.glass_types g
                LEFT JOIN public.order_cuts oc ON oc.glass_type_id = g.id AND oc.status != 'cancelled' AND oc.created_at BETWEEN p_start_date AND p_end_date
                GROUP BY g.thickness_mm, g.color
                HAVING COUNT(oc.id) > 0
                ORDER BY total_area_m2 DESC
                LIMIT 10
            ) t
        )
    ) INTO v_stats;

    RETURN v_stats;
END;
$$;
