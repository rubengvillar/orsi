import React, { useState, useEffect } from "react";
import { Clock, User, Package, Calendar, Edit2, Save, X, Scissors, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import MaterialUsageForm from "./MaterialUsageForm";
import OrderCutsList from "./OrderCutsList";
import OrderAttachments from "./OrderAttachments";
import { useStore } from '@nanostores/react';
import { userPermissions, userRole } from '../../stores/authStore';
import { PERMISSIONS } from '../../lib/permissions';

interface OrderDetailsProps {
    orderId: string;
}

export default function OrderDetails({ orderId }: OrderDetailsProps) {
    const [order, setOrder] = useState<any>(null);
    const [usage, setUsage] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [allOperators, setAllOperators] = useState<any[]>([]);

    // Permissions
    const perms = useStore(userPermissions);
    const role = useStore(userRole);
    const canEditUsage = role === 'Admin' || role === 'Administrador' || perms.includes(PERMISSIONS.ORDERS_MATERIAL_EDIT);
    const canDeleteUsage = role === 'Admin' || role === 'Administrador' || perms.includes(PERMISSIONS.ORDERS_MATERIAL_DELETE);

    // Usage Editing State
    const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
    const [editUsageData, setEditUsageData] = useState({
        quantity: 0,
        operator_id: ""
    });

    const [editFormData, setEditFormData] = useState({
        client_name: "",
        legacy_order_number: "",
        address: "",
        manufactured_at: "",
        installed_at: "",
        estimated_installation_time: "",
        description: "",
        cutter_ids: [] as string[],
        installer_ids: [] as string[]
    });

    useEffect(() => {
        fetchData();
        fetchOperators();
    }, [orderId]);

    const fetchData = async () => {
        setLoading(true);
        console.log("Fetching order data for ID:", orderId);

        // 1. Fetch Basic Order Data
        const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderError) {
            console.error("Error fetching basic order data:", orderError);
            // If the error is "PGRST116" it means no rows found (single() fail)
            if (orderError.code === 'PGRST116') {
                setOrder(null);
            } else {
                alert("Error loading order: " + orderError.message);
            }
            setLoading(false);
            return;
        }

        if (orderData) {
            // 2. Fetch Operators Separately (to avoid failing the whole query if schema is off)
            const { data: opData, error: opError } = await supabase
                .from("order_operators")
                .select(`
                    role,
                    operator:operator_id ( id, full_name )
                `)
                .eq("order_id", orderId);

            if (opError) {
                console.error("Error fetching order operators:", opError);
                // We don't alert here to allow the order to at least show basic info
            }

            const enhancedOrder = {
                ...orderData,
                operators: opData || []
            };

            setOrder(enhancedOrder);
            setEditFormData({
                client_name: enhancedOrder.client_name || "",
                legacy_order_number: enhancedOrder.legacy_order_number || "",
                address: enhancedOrder.address || "",
                manufactured_at: enhancedOrder.manufactured_at || "",
                installed_at: enhancedOrder.installed_at || "",
                estimated_installation_time: enhancedOrder.estimated_installation_time || "",
                description: enhancedOrder.description || "",
                cutter_ids: (opData || [])
                    ?.filter((op: any) => op.role === 'Cutter')
                    .map((op: any) => op.operator?.id)
                    .filter(Boolean) || [],
                installer_ids: (opData || [])
                    ?.filter((op: any) => op.role === 'Installer')
                    .map((op: any) => op.operator?.id)
                    .filter(Boolean) || []
            });
        }

        // Fetch Usage
        fetchUsage();
    };

    const fetchOperators = async () => {
        const { data } = await supabase.from("operators").select("id, full_name").eq("is_active", true);
        if (data) setAllOperators(data);
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            // 1. Update Order
            const { error: orderError } = await supabase
                .from("orders")
                .update({
                    client_name: editFormData.client_name,
                    legacy_order_number: editFormData.legacy_order_number || null,
                    address: editFormData.address || null,
                    manufactured_at: editFormData.manufactured_at || null,
                    installed_at: editFormData.installed_at || null,
                    estimated_installation_time: editFormData.estimated_installation_time || null,
                    description: editFormData.description || null
                })
                .eq("id", orderId);

            if (orderError) throw orderError;

            // 2. Clear and Reset Operators
            const { error: deleteError } = await supabase
                .from("order_operators")
                .delete()
                .eq("order_id", orderId);

            if (deleteError) throw deleteError;

            const operatorLinks: any[] = [];
            editFormData.cutter_ids.forEach(id => {
                operatorLinks.push({ order_id: orderId, operator_id: id, role: 'Cutter' });
            });
            editFormData.installer_ids.forEach(id => {
                operatorLinks.push({ order_id: orderId, operator_id: id, role: 'Installer' });
            });

            if (operatorLinks.length > 0) {
                const { error: insertError } = await supabase
                    .from("order_operators")
                    .insert(operatorLinks);
                if (insertError) throw insertError;
            }

            setIsEditing(false);
            fetchData();
        } catch (err: any) {
            alert("Error updating order: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setLoading(true);

        const updates: any = { status: newStatus };

        // Auto-update manufacturing date if status is 'Cut'
        if (newStatus === 'Cut') {
            updates.manufactured_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from("orders")
            .update(updates)
            .eq("id", orderId);

        if (error) alert(error.message);
        else setOrder({ ...order, ...updates });
        setLoading(false);
    };

    const handleEditUsageClick = (record: any) => {
        setEditingUsageId(record.id);
        setEditUsageData({
            quantity: record.quantity,
            operator_id: record.operator_id || ""
        });
    };

    const handleCancelUsageEdit = () => {
        setEditingUsageId(null);
        setEditUsageData({ quantity: 0, operator_id: "" });
    };

    const handleSaveUsageEdit = async (record: any) => {
        if (editUsageData.quantity <= 0) {
            alert("Quantity must be positive");
            return;
        }

        try {
            setLoading(true);

            // 1. Update Quantity if changed
            if (editUsageData.quantity !== record.quantity) {
                const { error: qtyError } = await supabase.rpc('update_material_usage_quantity', {
                    p_usage_id: record.id,
                    p_new_quantity: editUsageData.quantity
                });
                if (qtyError) throw qtyError;
            }

            // 2. Update Details (Operator)
            if (editUsageData.operator_id !== record.operator_id) {
                const { error: detError } = await supabase.rpc('update_material_usage_details', {
                    p_usage_id: record.id,
                    p_operator_id: editUsageData.operator_id || null
                });
                if (detError) throw detError;
            }

            alert("Material updated successfully");
            setEditingUsageId(null);
            fetchUsage();
        } catch (err: any) {
            console.error(err);
            alert("Error updating material: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUsage = async (record: any) => {
        if (!window.confirm(`Are you sure you want to delete this usage record?\n\n${record.material_name}\nQuantity: ${record.quantity}\n\nThis will return the items to STOCK.`)) {
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.rpc('delete_material_usage', {
                p_usage_id: record.id
            });

            if (error) throw error;

            fetchUsage();
        } catch (err: any) {
            console.error(err);
            alert("Error deleting usage: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsage = async () => {
        try {
            // 1. Fetch Basic Usage Data (Resilient select)
            const { data: usageData, error: usageError } = await supabase
                .from("material_usage")
                .select("*")
                .eq("order_id", orderId)
                .order("used_at", { ascending: false });

            if (usageError) throw usageError;

            if (!usageData || usageData.length === 0) {
                setUsage([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Workers (profiles)
            const workerIds = [...new Set(usageData.map(u => u.worker_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', workerIds);
            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            // 3. Fetch Operators (delivered_to)
            const operatorIds = [...new Set(usageData.map(u => u.operator_id).filter(Boolean))];
            let operatorMap = new Map();
            if (operatorIds.length > 0) {
                const { data: ops } = await supabase
                    .from('operators')
                    .select('id, full_name')
                    .in('id', operatorIds);
                operatorMap = new Map(ops?.map(o => [o.id, o]) || []);
            }

            // 4. Fetch Material Info from View
            const materialIds = usageData.map(u => u.material_id);
            const { data: names } = await supabase
                .from('v_material_info')
                .select('id, display_name, code')
                .in('id', materialIds);
            const infoMap = new Map(names?.map(n => [n.id, { name: n.display_name, code: n.code }]) || []);

            // 5. Enhance Data
            const enhancedUsage = usageData.map(u => ({
                ...u,
                worker: profileMap.get(u.worker_id) || { full_name: "Unknown", email: "" },
                delivered_to: u.operator_id ? operatorMap.get(u.operator_id) : null,
                material_name: infoMap.get(u.material_id)?.name || `Item (${u.material_id.substring(0, 8)})`,
                material_code: infoMap.get(u.material_id)?.code
            }));

            setUsage(enhancedUsage);
        } catch (err: any) {
            console.error("Error in fetchUsage:", err);
            setUsage([]);
        } finally {
            setLoading(false);
        }
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
                        <div className="flex-1">
                            {isEditing ? (
                                <div className="space-y-3 mr-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nombre Cliente</label>
                                            <input
                                                type="text"
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                value={editFormData.client_name}
                                                onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nro. Antiguo</label>
                                            <input
                                                type="text"
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                value={editFormData.legacy_order_number}
                                                onChange={(e) => setEditFormData({ ...editFormData, legacy_order_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dirección de Obra</label>
                                        <input
                                            type="text"
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                            value={editFormData.address}
                                            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h1 className="text-2xl font-bold text-slate-800">{order.client_name}</h1>
                                        {order.legacy_order_number && (
                                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-100 uppercase tracking-tight">
                                                Nro. Antiguo: {order.legacy_order_number}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 font-mono text-sm">NO. Orden: {order.order_number}</p>
                                    {order.address && (
                                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                                            <span className="font-semibold">Dirección:</span> {order.address}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={handleUpdate}
                                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                                        >
                                            <Save className="w-3.5 h-3.5" /> Guardar
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" /> Cancelar
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors border border-slate-200"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" /> Editar
                                        </button>

                                        {(order.status === 'Ready for Cutting' || order.status === 'Pending') && (
                                            <button
                                                onClick={() => handleStatusChange("Cut")}
                                                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <Scissors className="w-3.5 h-3.5" /> Marcar como Cortado
                                            </button>
                                        )}

                                        <select
                                            value={order.status}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                            disabled={loading}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border focus:ring-2 focus:ring-offset-1 transition-all ${order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' :
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
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="mt-4">
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Descripción / Notas</label>
                            <textarea
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                                value={editFormData.description}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            />
                        </div>
                    ) : (
                        order.description && <p className="mt-4 text-slate-600 text-sm whitespace-pre-wrap">{order.description}</p>
                    )}

                    <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Creado</span>
                                    {new Date(order.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Fabricación</span>
                                    {isEditing ? (
                                        <input
                                            type="datetime-local"
                                            className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                                            value={editFormData.manufactured_at ? new Date(editFormData.manufactured_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, manufactured_at: new Date(e.target.value).toISOString() })}
                                        />
                                    ) : (
                                        order.manufactured_at ? new Date(order.manufactured_at).toLocaleString() : 'Pendiente'
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Colocación</span>
                                    {isEditing ? (
                                        <input
                                            type="datetime-local"
                                            className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                                            value={editFormData.installed_at ? new Date(editFormData.installed_at).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, installed_at: new Date(e.target.value).toISOString() })}
                                        />
                                    ) : (
                                        order.installed_at ? new Date(order.installed_at).toLocaleString() : 'Pendiente'
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Tiempo Est.</span>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            placeholder="2 días..."
                                            className="w-full px-1 py-0.5 border border-slate-300 rounded text-xs"
                                            value={editFormData.estimated_installation_time}
                                            onChange={(e) => setEditFormData({ ...editFormData, estimated_installation_time: e.target.value })}
                                        />
                                    ) : (
                                        order.estimated_installation_time || 'No especificado'
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-start gap-2 text-sm">
                                <span className="font-bold text-slate-400 text-[10px] uppercase w-20 mt-1">Corte:</span>
                                {isEditing ? (
                                    <div className="flex-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                                        {allOperators.map((op) => (
                                            <div key={`edit-cutter-${op.id}`} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`edit-cutter-${op.id}`}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3 w-3"
                                                    checked={editFormData.cutter_ids.includes(op.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...editFormData.cutter_ids, op.id]
                                                            : editFormData.cutter_ids.filter(id => id !== op.id);
                                                        setEditFormData({ ...editFormData, cutter_ids: newIds });
                                                    }}
                                                />
                                                <label htmlFor={`edit-cutter-${op.id}`} className="text-[11px] text-slate-700 cursor-pointer">
                                                    {op.full_name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {order.operators && order.operators.filter((op: any) => op.role === 'Cutter').length > 0 ? (
                                            order.operators.filter((op: any) => op.role === 'Cutter').map((op: any) => (
                                                <span key={op.operator.id} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs border border-indigo-100 font-medium">
                                                    {op.operator.full_name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">No asignado</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-start gap-2 text-sm">
                                <span className="font-bold text-slate-400 text-[10px] uppercase w-20 mt-1">Colocación:</span>
                                {isEditing ? (
                                    <div className="flex-1 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                                        {allOperators.map((op) => (
                                            <div key={`edit-inst-${op.id}`} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`edit-inst-${op.id}`}
                                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                                                    checked={editFormData.installer_ids.includes(op.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked
                                                            ? [...editFormData.installer_ids, op.id]
                                                            : editFormData.installer_ids.filter(id => id !== op.id);
                                                        setEditFormData({ ...editFormData, installer_ids: newIds });
                                                    }}
                                                />
                                                <label htmlFor={`edit-inst-${op.id}`} className="text-[11px] text-slate-700 cursor-pointer">
                                                    {op.full_name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {order.operators && order.operators.filter((op: any) => op.role === 'Installer').length > 0 ? (
                                            order.operators.filter((op: any) => op.role === 'Installer').map((op: any) => (
                                                <span key={op.operator.id} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-xs border border-emerald-100 font-medium">
                                                    {op.operator.full_name}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">No asignado</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attachments Section */}
                <div className="mb-6">
                    <OrderAttachments orderId={orderId} />
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
                                    {(canEditUsage || canDeleteUsage) && <th className="px-4 py-3 text-right">Acciones</th>}
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
                                            {editingUsageId === record.id ? (
                                                <select
                                                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                                    value={editUsageData.operator_id}
                                                    onChange={(e) => setEditUsageData({ ...editUsageData, operator_id: e.target.value })}
                                                >
                                                    <option value="">No especificado</option>
                                                    {allOperators.map(op => (
                                                        <option key={op.id} value={op.id}>{op.full_name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                record.delivered_to?.full_name || <span className="text-slate-400 italic font-normal">No especificado</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{record.material_name}</span>
                                                {record.material_code && <span className="text-[10px] font-mono text-slate-400">COD: {record.material_code}</span>}
                                                <span className="text-[10px] text-slate-400 capitalize">{record.material_type.replace('_', ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-700">
                                            {editingUsageId === record.id ? (
                                                <input
                                                    type="number"
                                                    min="0.1"
                                                    step="0.1"
                                                    className="w-20 px-2 py-1 border border-slate-300 rounded text-xs"
                                                    value={editUsageData.quantity}
                                                    onChange={(e) => setEditUsageData({ ...editUsageData, quantity: parseFloat(e.target.value) })}
                                                />
                                            ) : (
                                                record.quantity
                                            )}
                                        </td>
                                        {(canEditUsage || canDeleteUsage) && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {editingUsageId === record.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveUsageEdit(record)}
                                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                title="Guardar"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelUsageEdit}
                                                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                                title="Cancelar"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {canEditUsage && (
                                                                <button
                                                                    onClick={() => handleEditUsageClick(record)}
                                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDeleteUsage && (
                                                                <button
                                                                    onClick={() => handleDeleteUsage(record)}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                    title="Eliminar (Devolver a Stock)"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {usage.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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
