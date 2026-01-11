-- Create a view to aggregate order statistics (total cuts, total glass area)
create or replace view public.v_orders_with_stats as
select 
    o.id,
    o.order_number,
    o.legacy_order_number,
    o.client_name,
    o.description,
    o.address,
    o.status,
    o.manufactured_at,
    o.installed_at,
    o.created_at,
    o.created_by,
    o.updated_at,
    o.estimated_installation_time,
    -- Sum quantity for all cuts that are NOT cancelled (includes 'pending' and 'cut')
    coalesce(sum(case when oc.status <> 'cancelled' then oc.quantity else 0 end), 0) as total_cuts,
    -- Sum area for all cuts that are NOT cancelled
    coalesce(sum(case when oc.status <> 'cancelled' then (oc.width_mm * oc.height_mm * oc.quantity) / 1000000.0 else 0 end), 0) as total_area_m2
from 
    public.orders o
left join 
    public.order_cuts oc on o.id = oc.order_id
group by 
    o.id;

-- Grant access
alter view public.v_orders_with_stats owner to postgres;
grant select on public.v_orders_with_stats to authenticated;
grant select on public.v_orders_with_stats to service_role;
