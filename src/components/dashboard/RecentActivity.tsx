import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface Activity {
    id: string;
    order_id: string;
    material_id: string;
    quantity: number;
    used_at: string;
    order_name?: string;
    material_display?: string;
}

export default function RecentActivity() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivity();
    }, []);

    const fetchActivity = async () => {
        setLoading(true);
        // 1. Fetch latest 5 usage records with order join
        const { data: usage } = await supabase
            .from("material_usage")
            .select(`
        id, order_id, material_id, quantity, used_at,
        orders ( client_name )
      `)
            .order("used_at", { ascending: false })
            .limit(5);

        if (usage) {
            // 2. Map material names from view
            const ids = usage.map(u => u.material_id);
            const { data: names } = await supabase
                .from('v_material_info')
                .select('id, display_name')
                .in('id', ids);

            const nameMap = new Map(names?.map(n => [n.id, n.display_name]));

            const enhanced = usage.map((u: any) => ({
                id: u.id,
                order_id: u.order_id,
                material_id: u.material_id,
                quantity: u.quantity,
                used_at: u.used_at,
                order_name: u.orders?.client_name || "Unknown Order",
                material_display: nameMap.get(u.material_id) || `Item ${u.material_id.substring(0, 8)}`
            }));

            setActivities(enhanced);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <tbody className="divide-y divide-slate-100">
                {[...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                        <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-100 rounded w-8 ml-auto"></div></td>
                    </tr>
                ))}
            </tbody>
        );
    }

    if (activities.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                        No hay actividad reciente.
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody className="divide-y divide-slate-100">
            {activities.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 truncate block max-w-[150px]">
                            {act.order_name}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                        <span className="truncate block max-w-[200px]" title={act.material_display}>
                            {act.material_display}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {act.quantity}
                    </td>
                </tr>
            ))}
        </tbody>
    );
}
