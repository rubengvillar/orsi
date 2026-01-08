import React, { useState, useEffect } from "react";
import { Clock, User, Package, Calendar } from "lucide-react";
import { supabase } from "../../lib/supabase";
import MaterialUsageForm from "./MaterialUsageForm";
import OrderCutsList from "./OrderCutsList";

interface OrderDetailsProps {
    orderId: string;
}

export default function OrderDetails({ orderId }: OrderDetailsProps) {
    const [order, setOrder] = useState<any>(null);
    const [usage, setUsage] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [orderId]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Order with Operators
        const { data: orderData } = await supabase
            .from("orders")
            .select(`
                *,
                operators:order_operators (
                    operator:operator_id ( id, full_name )
                )
            `)
            .eq("id", orderId)
            .single();

        setOrder(orderData);

        // Fetch Usage
        fetchUsage();
    };

    const handleStatusChange = async (newStatus: string) => {
        setLoading(true);
        const { error } = await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", orderId);

        if (error) alert(error.message);
        else setOrder({ ...order, status: newStatus });
        setLoading(false);
    };

    const fetchUsage = async () => {
        const { data: usageData } = await supabase
            .from("material_usage")
            .select(`
                id, quantity, material_type, material_id, used_at,
                worker:worker_id ( full_name, email ),
                delivered_to:operator_id ( full_name )
            `)
            .eq("order_id", orderId)
            .order("used_at", { ascending: false });

        if (usageData) {
            // Fetch material names from view
            const materialIds = usageData.map(u => u.material_id);
            const { data: names } = await supabase
                .from('v_material_info')
                .select('id, display_name')
                .in('id', materialIds);

            const nameMap = new Map(names?.map(n => [n.id, n.display_name]));

            const enhancedUsage = usageData.map(u => ({
                ...u,
                material_name: nameMap.get(u.material_id) || `Item (${u.material_id.substring(0, 8)})`
            }));

            setUsage(enhancedUsage);
        } else {
            setUsage([]);
        }
        setLoading(false);
    };

    if (loading && !order) return <div>Loading details...</div>;
    if (!order) return <div>Order not found</div>;

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Order Info & Usage List */}
            <div className="flex-1 space-y-6">

                {/* Header Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{order.client_name}</h1>
                            <p className="text-slate-500 font-mono text-sm mt-1">NO. {order.order_number}</p>
                        </div>
                        <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            disabled={loading}
                            className={`px-3 py-1 rounded-lg text-sm font-semibold border focus:ring-2 focus:ring-offset-1 transition-all ${order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' :
                                order.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500' :
                                    order.status === 'Cut' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 focus:ring-indigo-500' :
                                        'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-500'
                                }`}
                        >
                            <option value="Pending">Pendiente</option>
                            <option value="Ready for Cutting">Listo para Corte</option>
                            <option value="Cut">Cortado</option>
                            <option value="In Progress">En Producción</option>
                            <option value="Installed">Colocado / Finalizado</option>
                            <option value="Completed">Completado</option>
                            <option value="Cancelled">Cancelado</option>
                        </select>
                    </div>
                    <p className="mt-4 text-slate-600">{order.description}</p>
                    <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                        <div className="flex flex-wrap gap-6 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">Creado:</span> {new Date(order.created_at).toLocaleDateString()}
                            </div>
                            {order.manufactured_at && (
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-400" />
                                    <span className="font-medium">Fabricado:</span> {new Date(order.manufactured_at).toLocaleDateString()}
                                </div>
                            )}
                            {order.installed_at && (
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-emerald-400" />
                                    <span className="font-medium">Colocado:</span> {new Date(order.installed_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-500">Operarios:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {order.operators && order.operators.length > 0 ? (
                                    order.operators.map((op: any) => (
                                        <span key={op.operator.id} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs border border-slate-200">
                                            {op.operator.full_name}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-slate-400 italic">Ninguno asignado</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Usage History */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Uso de Materiales
                        </h3>
                        <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200">
                            Registros: {usage.length}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Registró</th>
                                    <th className="px-4 py-3">Entregado a</th>
                                    <th className="px-4 py-3">Material</th>
                                    <th className="px-4 py-3">Cant.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {usage.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-600">
                                            {new Date(record.used_at).toLocaleDateString()}
                                            <span className="block text-[10px] text-slate-400">{new Date(record.used_at).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {record.worker?.full_name || record.worker?.email || "Unknown"}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-blue-600">
                                            {record.delivered_to?.full_name || <span className="text-slate-400 italic font-normal">No especificado</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            <span className="font-medium text-slate-800 block">{record.material_name}</span>
                                            <span className="text-xs text-slate-400 capitalize">{record.material_type.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-700">
                                            {record.quantity}
                                        </td>
                                    </tr>
                                ))}
                                {usage.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                            No material usage recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cutting Requirements */}
                <OrderCutsList orderId={orderId} />

            </div>

            {/* Right Column: Add Usage Form */}
            <div className="w-full lg:w-80 shrink-0">
                <div className="sticky top-6">
                    <MaterialUsageForm orderId={orderId} onUsageRecorded={fetchUsage} />
                </div>
            </div>
        </div>
    );
}
