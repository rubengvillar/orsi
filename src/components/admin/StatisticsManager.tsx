import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function StatisticsManager() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('30'); // '7', '30', '90', '365'

    useEffect(() => {
        fetchStats();
    }, [dateRange]);

    const fetchStats = async () => {
        setLoading(true);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(dateRange));

        const { data, error } = await supabase.rpc('get_usage_statistics', {
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
        });

        if (error) {
            console.error('Error fetching stats:', error);
        } else {
            setStats(data || {});
        }
        setLoading(false);
    };

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">Sin datos para este período</span>
        </div>
    );

    const StatCard = ({ title, data, dataKey, labelKey, color }: any) => {
        const chartData = {
            labels: data?.map((item: any) => item[labelKey]) || [],
            datasets: [
                {
                    label: title,
                    data: data?.map((item: any) => item[dataKey]) || [],
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };

        const options = {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false,
                },
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        };

        return (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
                {(!data || data.length === 0) ? <EmptyState /> : (
                    <div className="h-64">
                        <Bar options={options} data={chartData} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                    Estadísticas de Uso
                </h2>

                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    {['7', '30', '90', '365'].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDateRange(d)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateRange === d
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            Last {d} Days
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="h-96 flex items-center justify-center text-slate-400">Cargando estadísticas...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <StatCard
                        title="Top Accesorios Aluminio"
                        data={stats?.aluminum_accessories}
                        dataKey="total_used"
                        labelKey="code"
                        color="rgba(59, 130, 246, 0.8)" // Blue
                    />
                    <StatCard
                        title="Top Accesorios Vidrio"
                        data={stats?.glass_accessories}
                        dataKey="total_used"
                        labelKey="code"
                        color="rgba(16, 185, 129, 0.8)" // Emerald
                    />
                    <StatCard
                        title="Top Perfiles Aluminio"
                        data={stats?.aluminum_profiles}
                        dataKey="total_used"
                        labelKey="code"
                        color="rgba(99, 102, 241, 0.8)" // Indigo
                    />
                    <StatCard
                        title="Uso de Vidrio (m² Cortados)"
                        data={stats?.glass_types}
                        dataKey="total_area_m2"
                        labelKey="label"
                        color="rgba(6, 182, 212, 0.8)" // Cyan
                    />
                </div>
            )}
        </div>
    );
}
