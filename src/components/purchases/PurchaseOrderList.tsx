
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Filter, Eye, Trash2, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Supplier {
    id: string;
    name: string;
}

interface PurchaseOrder {
    id: string;
    order_number: number;
    supplier_id: string;
    status: 'draft' | 'submitted' | 'partially_received' | 'completed' | 'cancelled';
    expected_delivery_date: string | null;
    total: number;
    created_at: string;
    supplier?: Supplier;
}

export default function PurchaseOrderList() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (isCreateModalOpen) {
            fetchSuppliers();
        }
    }, [isCreateModalOpen]);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('purchase_orders')
            .select('*, supplier:suppliers(id, name)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const fetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('id, name').order('name');
        setSuppliers(data || []);
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId) return;

        setCreating(true);
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .insert([{
                    supplier_id: selectedSupplierId,
                    status: 'draft',
                    is_manual: true
                }])
                .select()
                .single();

            if (error) throw error;

            // Redirect to the edit page
            window.location.href = `/purchases/orders/${data.id}`;
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error al crear la orden');
            setCreating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-100 text-slate-700';
            case 'submitted': return 'bg-blue-100 text-blue-700';
            case 'partially_received': return 'bg-orange-100 text-orange-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const statusLabels: Record<string, string> = {
        draft: 'Borrador',
        submitted: 'Enviada',
        partially_received: 'Parc. Recibida',
        completed: 'Completada',
        cancelled: 'Cancelada'
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.order_number.toString().includes(searchTerm) ||
            order.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-4 w-full md:w-auto flex-1">
                    <div className="relative flex-1 md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar órdenes..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos los Estados</option>
                        <option value="draft">Borrador</option>
                        <option value="submitted">Enviada</option>
                        <option value="partially_received">Recibida Parcialmente</option>
                        <option value="completed">Completada</option>
                        <option value="cancelled">Cancelada</option>
                    </select>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Orden
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Cargando órdenes...</div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">OC #</th>
                                <th className="px-6 py-3">Proveedor</th>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3 text-right">Total</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-slate-600">#{order.order_number}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{order.supplier?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                                            {statusLabels[order.status] || order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                                        ${order.total?.toLocaleString() || '0'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <a
                                            href={`/purchases/orders/${order.id}`}
                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                                        >
                                            Ver
                                        </a>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No se encontraron órdenes de compra.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Crear Orden de Compra"
                size="sm"
            >
                <form onSubmit={handleCreateOrder} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Proveedor</label>
                        <div className="relative">
                            <select
                                required
                                className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white font-medium text-slate-700"
                                value={selectedSupplierId}
                                onChange={(e) => setSelectedSupplierId(e.target.value)}
                            >
                                <option value="">-- Elija un proveedor --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                                <Search className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Se creará una nueva orden borrador para este proveedor. Podrá agregar artículos en el siguiente paso.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            disabled={creating}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={creating || !selectedSupplierId}
                        >
                            {creating ? 'Creando...' : 'Crear Borrador'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
