import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, FolderKanban, AlertCircle, Calendar, MapPin, Scissors, Box } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Order {
    id: string;
    order_number: number;
    legacy_order_number: string | null;
    client_name: string;
    description: string;
    address: string | null;
    status: 'Pending' | 'Ready for Cutting' | 'Cut' | 'In Progress' | 'Installed' | 'Completed' | 'Cancelled';
    manufactured_at: string | null;
    installed_at: string | null;
    created_at: string;
    total_cuts: number;
    total_area_m2: number;
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
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        client_name: "",
        description: "",
        manufactured_at: "",
        installed_at: "",
        legacy_order_number: "",
        address: "",
        estimated_installation_time: "",
        cutter_ids: [] as string[],
        installer_ids: [] as string[]
    });

    useEffect(() => {
        fetchOrders();
        fetchOperators();
    }, []);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);

        // Try fetching from the view first
        const { data, error } = await supabase
            .from("v_orders_with_stats")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.warn("View v_orders_with_stats might not exist, falling back to basic orders table (no stats)", error);
            // Fallback to regular orders table content if view is missing
            const { data: fallbackData, error: fallbackError } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });

            if (fallbackError) {
                console.error("Error fetching orders:", fallbackError);
                setError("Failed to load orders");
            } else {
                // Map to Order interface with 0 defaults for missing stats
                const mapped = (fallbackData || []).map((o: any) => ({
                    ...o,
                    total_cuts: 0,
                    total_area_m2: 0
                }));
                setOrders(mapped);
            }
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const fetchOperators = async () => {
        const { data } = await supabase.from("operators").select("id, full_name").eq("is_active", true);
        if (data) setOperators(data);
    };

    // Helper Functions (Hoisted for Filter)
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

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        // 1. Status Filter
        if (statusFilter !== "all" && order.status !== statusFilter) {
            return false;
        }

        // 2. Search Term
        const term = debouncedSearchTerm.toLowerCase();
        if (!term) return true;

        return (
            (order.client_name || '').toLowerCase().includes(term) ||
            (order.description || '').toLowerCase().includes(term) ||
            (order.order_number?.toString() || '').includes(term) ||
            (order.legacy_order_number || '').toLowerCase().includes(term) ||
            (order.address || '').toLowerCase().includes(term) ||
            getStatusLabel(order.status).toLowerCase().includes(term)
        );
    });

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
                legacy_order_number: formData.legacy_order_number || null,
                address: formData.address || null,
                estimated_installation_time: formData.estimated_installation_time || null,
            },
        ]).select();

        if (orderError) {
            alert("Error creating order: " + orderError.message);
            return;
        }

        const newOrderId = orderData[0].id;

        // 2. Link Operators (Cutter & Installer)
        const operatorLinks: any[] = [];

        if (formData.cutter_ids.length > 0) {
            formData.cutter_ids.forEach(opId => {
                operatorLinks.push({
                    order_id: newOrderId,
                    operator_id: opId,
                    role: 'Cutter'
                });
            });
        }

        if (formData.installer_ids.length > 0) {
            formData.installer_ids.forEach(opId => {
                operatorLinks.push({
                    order_id: newOrderId,
                    operator_id: opId,
                    role: 'Installer'
                });
            });
        }

        if (operatorLinks.length > 0) {
            const { error: linkError } = await supabase.from("order_operators").insert(operatorLinks);
            if (linkError) console.error("Error linking operators:", linkError);
        }

        setIsModalOpen(false);
        setFormData({
            client_name: "",
            description: "",
            manufactured_at: "",
            installed_at: "",
            legacy_order_number: "",
            address: "",
            estimated_installation_time: "",
            cutter_ids: [],
            installer_ids: []
        });
        fetchOrders();
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nro, cliente, descripción..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Actions Group */}
                <div className="flex gap-2 items-center overflow-x-auto pb-1 md:pb-0">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 mr-2">
                        <Filter className="w-4 h-4 text-slate-400 ml-2" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-slate-600 focus:ring-0 cursor-pointer py-1 pr-8 outline-none"
                        >
                            <option value="all">Todos los Estados</option>
                            <option value="Pending">Pendiente</option>
                            <option value="Ready for Cutting">Listo para Corte</option>
                            <option value="Cut">Cortado</option>
                            <option value="In Progress">En Producción</option>
                            <option value="Installed">Colocado / Finalizado</option>
                            <option value="Completed">Completado</option>
                            <option value="Cancelled">Cancelado</option>
                        </select>
                    </div>

                    {canManage && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" />
                            Nueva Orden
                        </button>
                    )}
                </div>
            </div>

            {/* Orders List / Grid */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Cargando órdenes...</div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                    <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-700">No se encontraron órdenes</h3>
                    <p className="text-slate-500 text-sm">Prueba ajustes tu búsqueda o el filtro de estado.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredOrders.map((order) => {
                        const daysOld = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / (1000 * 3600 * 24));
                        const isCompleted = order.status === 'Completed' || order.status === 'Cancelled';
                        let borderClass = 'border-slate-200 hover:border-blue-300';

                        // Priority logic for borders
                        if (!isCompleted) {
                            if (daysOld > 10) {
                                borderClass = 'border-red-500 ring-1 ring-red-500 bg-red-50/10';
                            } else if (daysOld > 5) {
                                borderClass = 'border-amber-400 ring-1 ring-amber-400 bg-amber-50/10';
                            }
                        }

                        return (
                            <a
                                key={order.id}
                                href={`/orders/${order.id}`}
                                className={`block bg-white p-5 rounded-xl border ${borderClass} hover:shadow-md transition-all group relative flex flex-col h-full`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 font-mono uppercase">Orden N° {order.order_number}</span>
                                            {order.legacy_order_number && (
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200 font-mono">
                                                    #{order.legacy_order_number}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                            {order.client_name}
                                        </h3>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>

                                <p className="text-slate-600 text-sm mb-4 line-clamp-2 min-h-[1.5em] flex-1">
                                    {order.description || "Sin descripción."}
                                </p>

                                <div className="flex flex-col gap-2 mb-3">
                                    {/* Address Line */}
                                    {order.address && (
                                        <div className="flex items-center text-xs text-slate-500">
                                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                                            <span className="truncate">{order.address}</span>
                                        </div>
                                    )}

                                    {/* Stats Line */}
                                    <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex items-center" title="Cantidad de Cortes">
                                            <Scissors className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
                                            <span className="font-semibold">{order.total_cuts}</span>
                                            <span className="ml-1 text-slate-400 font-normal">Cortes</span>
                                        </div>
                                        <div className="w-px h-3 bg-slate-200"></div>
                                        <div className="flex items-center" title="Material Estimado (Vidrio)">
                                            <Box className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                                            <span className="font-semibold">{order.total_area_m2?.toFixed(2)}</span>
                                            <span className="ml-1 text-slate-400 font-normal">m²</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 mt-auto">
                                    <div className="flex items-center">
                                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </div>
                                    {!isCompleted && daysOld > 5 && (
                                        <div className={`flex items-center font-bold ${daysOld > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                                            <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                            {daysOld} días
                                        </div>
                                    )}
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Crear Nueva Orden</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Nombre del Cliente
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
                                        Nro. Orden Antiguo (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.legacy_order_number}
                                        onChange={(e) =>
                                            setFormData({ ...formData, legacy_order_number: e.target.value })
                                        }
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Dirección de Obra / Colocación
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.address}
                                    onChange={(e) =>
                                        setFormData({ ...formData, address: e.target.value })
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tiempo Estimado de Colocación
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: 2 días, 4 horas..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.estimated_installation_time}
                                    onChange={(e) =>
                                        setFormData({ ...formData, estimated_installation_time: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Descripción / Notas
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Responsables de Corte
                                    </label>
                                    <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                                        {operators.map((op) => (
                                            <div key={op.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`cutter-${op.id}`}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                                                    checked={formData.cutter_ids.includes(op.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...formData.cutter_ids, op.id]
                                                            : formData.cutter_ids.filter(id => id !== op.id);
                                                        setFormData({ ...formData, cutter_ids: newIds });
                                                    }}
                                                />
                                                <label htmlFor={`cutter-${op.id}`} className="text-xs text-slate-700 cursor-pointer">
                                                    {op.full_name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        Responsables de Colocación
                                    </label>
                                    <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                                        {operators.map((op) => (
                                            <div key={op.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`inst-${op.id}`}
                                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                                                    checked={formData.installer_ids.includes(op.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...formData.installer_ids, op.id]
                                                            : formData.installer_ids.filter(id => id !== op.id);
                                                        setFormData({ ...formData, installer_ids: newIds });
                                                    }}
                                                />
                                                <label htmlFor={`inst-${op.id}`} className="text-xs text-slate-700 cursor-pointer">
                                                    {op.full_name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Note: Created By is handled by RLS/Trigger or default value using auth.uid() if set in table definition, otherwise we assume default user context works or supabase handles it via RLS policies checking auth.uid() */}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                    aria-label="Cancelar"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                    aria-label="Confirmar Crear Orden"
                                >
                                    Crear Orden
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
