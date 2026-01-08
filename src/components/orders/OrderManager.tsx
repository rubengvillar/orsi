import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, FolderKanban, AlertCircle, Calendar } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Order {
    id: string;
    order_number: number;
    client_name: string;
    description: string;
    status: 'Pending' | 'Ready for Cutting' | 'Cut' | 'In Progress' | 'Installed' | 'Completed' | 'Cancelled';
    manufactured_at: string | null;
    installed_at: string | null;
    created_at: string;
}

interface Operator {
    id: string;
    full_name: string;
}

interface OrderManagerProps {
    canManage: boolean;
}

export default function OrderManager({ canManage }: OrderManagerProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [isByStatus, setIsByStatus] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        client_name: "",
        description: "",
        manufactured_at: "",
        installed_at: "",
        operator_ids: [] as string[]
    });

    useEffect(() => {
        fetchOrders();
        fetchOperators();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching orders:", error);
            setError("Failed to load orders");
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const fetchOperators = async () => {
        const { data } = await supabase.from("operators").select("id, full_name").eq("is_active", true);
        if (data) setOperators(data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.client_name) return;

        // 1. Create Order
        const { data: orderData, error: orderError } = await supabase.from("orders").insert([
            {
                client_name: formData.client_name,
                description: formData.description,
                status: "Pending",
                manufactured_at: formData.manufactured_at || null,
                installed_at: formData.installed_at || null,
            },
        ]).select();

        if (orderError) {
            alert("Error creating order: " + orderError.message);
            return;
        }

        const newOrderId = orderData[0].id;

        // 2. Link Operators
        if (formData.operator_ids.length > 0) {
            const operatorLinks = formData.operator_ids.map(opId => ({
                order_id: newOrderId,
                operator_id: opId
            }));
            const { error: linkError } = await supabase.from("order_operators").insert(operatorLinks);
            if (linkError) console.error("Error linking operators:", linkError);
        }

        setIsModalOpen(false);
        setFormData({ client_name: "", description: "", manufactured_at: "", installed_at: "", operator_ids: [] });
        fetchOrders();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Pending": return "bg-amber-50 text-amber-700 border-amber-200";
            case "Ready for Cutting": return "bg-orange-50 text-orange-700 border-orange-200";
            case "Cut": return "bg-indigo-50 text-indigo-700 border-indigo-200";
            case "In Progress": return "bg-blue-50 text-blue-700 border-blue-200";
            case "Installed": return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "Completed": return "bg-green-50 text-green-700 border-green-200";
            case "Cancelled": return "bg-red-50 text-red-700 border-red-200";
            default: return "bg-gray-50 text-gray-600 border-gray-200";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "Pending": return "Pendiente";
            case "Ready for Cutting": return "Listo para Corte";
            case "Cut": return "Cortado";
            case "In Progress": return "En Producción";
            case "Installed": return "Colocado / Finalizado";
            case "Completed": return "Completado";
            case "Cancelled": return "Cancelado";
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex gap-2">
                    {canManage && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium shadow-sm"
                        >
                            <Plus className="w-5 h-5" />
                            New Order
                        </button>
                    )}
                </div>
            </div>

            {/* Orders List / Grid */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading orders...</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                    <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-700">No orders found</h3>
                    <p className="text-slate-500 text-sm">Create a new order to get started.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {orders.map((order) => (
                        <a
                            key={order.id}
                            href={`/orders/${order.id}`}
                            className="block bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-400 font-mono uppercase">Order #{order.order_number}</span>
                                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                        {order.client_name}
                                    </h3>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${getStatusColor(order.status)}`}>
                                    {getStatusLabel(order.status)}
                                </span>
                            </div>

                            <p className="text-slate-600 text-sm mb-4 line-clamp-2 min-h-[2.5em]">
                                {order.description || "No description provided."}
                            </p>

                            <div className="flex items-center text-xs text-slate-400 pt-3 border-t border-slate-100">
                                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                {new Date(order.created_at).toLocaleDateString()}
                            </div>
                        </a>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Create New Order</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Client Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.client_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, client_name: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Fecha Fabricación
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.manufactured_at}
                                        onChange={(e) =>
                                            setFormData({ ...formData, manufactured_at: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Fecha Colocación
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.installed_at}
                                        onChange={(e) =>
                                            setFormData({ ...formData, installed_at: e.target.value })
                                        }
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Asignar Operarios / Colocadores
                                </label>
                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2">
                                    {operators.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-2">No hay operarios activos</p>
                                    ) : (
                                        operators.map((op) => (
                                            <div key={op.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`op-${op.id}`}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={formData.operator_ids.includes(op.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...formData.operator_ids, op.id]
                                                            : formData.operator_ids.filter(id => id !== op.id);
                                                        setFormData({ ...formData, operator_ids: newIds });
                                                    }}
                                                />
                                                <label htmlFor={`op-${op.id}`} className="text-sm text-slate-700 cursor-pointer">
                                                    {op.full_name}
                                                </label>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Puedes seleccionar uno o varios operarios.</p>
                            </div>

                            {/* Note: Created By is handled by RLS/Trigger or default value using auth.uid() if set in table definition, otherwise we assume default user context works or supabase handles it via RLS policies checking auth.uid() */}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                >
                                    Create Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
