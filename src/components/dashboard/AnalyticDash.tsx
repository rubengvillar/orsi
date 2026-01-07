import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import {
    AlertTriangle,
    Package,
    ClipboardList,
    CheckCircle2,
    TrendingUp,
    BarChart3
} from "lucide-react";

// Register Chart.js components
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
);

export default function AnalyticDash() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingCuts: 0,
        lowStockCount: 0,
        orderStatusDist: {} as Record<string, number>,
        criticalItems: [] as { name: string, stock: number, min: number }[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Fetch Orders for Status Distribution
            const { data: orders } = await supabase.from('orders').select('status');
            const dist: Record<string, number> = {};
            let pendingCuts = 0;
            orders?.forEach(o => {
                dist[o.status] = (dist[o.status] || 0) + 1;
                if (o.status === "Ready for Cutting") pendingCuts++;
            });

            // 2. Fetch Low Stock Items across all categories
            const lowStock: any[] = [];

            const fetchCategory = async (table: string, nameField: string = 'code') => {
                const { data } = await supabase.from(table).select(`${nameField}, quantity, min_stock`);
                data?.forEach(item => {
                    if (item.quantity <= (item.min_stock || 0)) {
                        lowStock.push({
                            name: item[nameField],
                            stock: item.quantity,
                            min: item.min_stock
                        });
                    }
                });
            };

            const fetchGlassTypes = async () => {
                const { data } = await supabase.from('glass_types').select('code, min_stock_sheets, glass_sheets(quantity)');
                data?.forEach(item => {
                    const qty = item.glass_sheets?.[0]?.quantity || 0;
                    if (qty <= (item.min_stock_sheets || 0)) {
                        lowStock.push({ name: item.code, stock: qty, min: item.min_stock_sheets });
                    }
                });
            };

            await Promise.all([
                fetchCategory('aluminum_accessories'),
                fetchCategory('aluminum_profiles'),
                fetchCategory('glass_accessories'),
                fetchGlassTypes()
            ]);

            setStats({
                totalOrders: orders?.length || 0,
                pendingCuts,
                lowStockCount: lowStock.length,
                orderStatusDist: dist,
                criticalItems: lowStock.slice(0, 5) // Top 5 for the chart
            });

        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-100 rounded-xl border border-slate-200"></div>
            ))}
        </div>
    );

    // Chart Data Configs
    const statusLabels = Object.keys(stats.orderStatusDist);
    const statusData = {
        labels: statusLabels,
        datasets: [{
            data: Object.values(stats.orderStatusDist),
            backgroundColor: [
                '#94a3b8', // Pending - Slate
                '#f59e0b', // Ready for Cutting - Amber
                '#6366f1', // Cut - Indigo
                '#3b82f6', // In Progress - Blue
                '#10b981', // Installed - Emerald
                '#22c55e', // Completed - Green
                '#ef4444', // Cancelled - Red
            ],
            borderWidth: 0,
        }]
    };

    const stockData = {
        labels: stats.criticalItems.map(i => i.name),
        datasets: [
            {
                label: 'Stock Actual',
                data: stats.criticalItems.map(i => i.stock),
                backgroundColor: '#3b82f6',
                borderRadius: 6,
            },
            {
                label: 'Mínimo',
                data: stats.criticalItems.map(i => i.min),
                backgroundColor: '#f1f5f9',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                borderRadius: 6,
            }
        ]
    };

    return (
        <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <ClipboardList className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-slate-400">TOTAL</span>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500">Órdenes Totales</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.totalOrders}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-amber-500">PENDIENTE</span>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500">Pendientes de Corte</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.pendingCuts}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-red-500">CRÍTICO</span>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500">Items con bajo stock</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.lowStockCount}</h3>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" /> Distribución de Estados
                    </h4>
                    <div className="h-64 flex items-center justify-center">
                        <Pie
                            data={statusData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 10 } } } }
                            }}
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Alertas de Stock (Críticos)
                    </h4>
                    <div className="h-64">
                        <Bar
                            data={stockData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, grid: { display: false } },
                                    x: { grid: { display: false } }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
