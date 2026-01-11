
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Plus, Trash2, Save, Send, CheckCircle, ArrowLeft, PackageCheck } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderItem } from '../../types/database';

interface Props {
    orderId: string;
}

// Helper types for the add item modal
interface InventoryItem {
    id: string;
    type: 'aluminum_accessory' | 'aluminum_profile' | 'glass_type' | 'glass_accessory' | 'tool';
    name: string; // Combined code/description
    code: string;
}

export default function PurchaseOrderDetail({ orderId }: Props) {
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Item State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryResults, setInventoryResults] = useState<InventoryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemPrice, setNewItemPrice] = useState(0);

    // Receive State
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receiveData, setReceiveData] = useState<Record<string, { qty: number, price: number, updatePrice: boolean }>>({});

    useEffect(() => {
        fetchOrderDetails();
    }, [orderId]);

    const fetchOrderDetails = async () => {
        setLoading(true);
        // Fetch Order
        const { data: orderData, error: orderError } = await supabase
            .from('purchase_orders')
            .select('*, supplier:suppliers(*)')
            .eq('id', orderId)
            .single();

        if (orderError) {
            console.error('Error fetching order:', orderError);
            setLoading(false);
            return;
        }
        setOrder(orderData);

        const { data: itemsData, error: itemsError } = await supabase
            .from('purchase_order_items')
            .select('*')
            .eq('purchase_order_id', orderId);

        if (itemsError) console.error(itemsError);

        // Enrich items with names
        if (itemsData) {
            const enrichedItems = await Promise.all(itemsData.map(async (item) => {
                const name = await fetchItemName(item.product_type, item.product_id);
                return { ...item, _name: name };
            }));
            setItems(enrichedItems);
        }

        setLoading(false);
    };

    const fetchItemName = async (type: string, id: string) => {
        let table = '';
        let columns = 'code, description';
        if (type === 'aluminum_profile') table = 'aluminum_profiles';
        if (type === 'aluminum_accessory') table = 'aluminum_accessories';
        if (type === 'glass_accessory') table = 'glass_accessories';
        if (type === 'tool') { table = 'tools'; columns = 'name, description'; }
        if (type === 'glass_type') { table = 'glass_types'; columns = 'code, description'; }

        const { data } = await supabase.from(table).select(columns).eq('id', id).single();
        if (data) {
            const item = data as any;
            if (type === 'tool') return item.name;
            return `${item.code} ${item.description ? '- ' + item.description : ''}`;
        }
        return 'Articulo Desconocido';
    };

    const handleAddItem = async () => {
        if (!order || !selectedItem) return;

        try {
            const { error } = await supabase.from('purchase_order_items').insert({
                purchase_order_id: order.id,
                product_type: selectedItem.type,
                product_id: selectedItem.id,
                quantity: newItemQty,
                unit_price: newItemPrice
            });

            if (error) throw error;
            setIsAddModalOpen(false);
            setSelectedItem(null);
            fetchOrderDetails(); // Refresh
        } catch (e) {
            console.error(e);
            alert('Error al agregar artículo');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;
        const { error } = await supabase
            .from('purchase_orders')
            .update({ status: newStatus })
            .eq('id', order.id);

        if (error) {
            alert('Error al actualizar el estado');
        } else {
            fetchOrderDetails();
        }
    };

    const handleReceiveSubmit = async () => {
        // Prepare JSON for RPC
        // Structure: { id, quantity_received, updates_price, new_price }
        const itemsPayload = Object.entries(receiveData)
            .filter(([_, data]) => data.qty > 0)
            .map(([id, data]) => ({
                id,
                quantity_received: data.qty,
                updates_price: data.updatePrice,
                new_price: data.price
            }));

        if (itemsPayload.length === 0) return;

        try {
            const { error } = await supabase.rpc('receive_purchase_order_items', {
                p_purchase_order_id: orderId,
                p_items: itemsPayload
            });

            if (error) throw error;

            setIsReceiveModalOpen(false);
            fetchOrderDetails();
            alert('Artículos recibidos con éxito');
        } catch (e) {
            console.error(e);
            alert('Error al recibir artículos');
        }
    };

    // Helper for Add Item Modal
    const [searchType, setSearchType] = useState('aluminum_profile');
    const executeSearch = async () => {
        let table = '';
        let query = supabase.from('aluminum_profiles').select('id, code, description'); // Default

        if (searchType === 'aluminum_profile') query = supabase.from('aluminum_profiles').select('id, code, description');
        if (searchType === 'aluminum_accessory') query = supabase.from('aluminum_accessories').select('id, code, description');
        if (searchType === 'glass_accessory') query = supabase.from('glass_accessories').select('id, code, description');
        if (searchType === 'glass_type') query = supabase.from('glass_types').select('id, code, description');
        if (searchType === 'tool') query = supabase.from('tools').select('id, name, description');

        // Filter
        if (searchType === 'tool') {
            query = query.ilike('name', `%${inventorySearch}%`);
        } else {
            query = query.ilike('code', `%${inventorySearch}%`);
        }

        const { data } = await query.limit(10);

        if (data) {
            setInventoryResults(data.map((d: any) => ({
                id: d.id,
                type: searchType as any,
                name: (d.name || d.code) + (d.description ? ` - ${d.description}` : ''),
                code: d.code || d.name
            })));
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;
    if (!order) return <div className="p-8 text-center text-red-500">Orden no encontrada</div>;

    const statusLabels: Record<string, string> = {
        draft: 'Borrador',
        submitted: 'Enviada',
        partially_received: 'Recibida Parcialmente',
        completed: 'Completada',
        cancelled: 'Cancelada'
    };

    const itemStatusLabels: Record<string, string> = {
        pending: 'Pendiente',
        received: 'Recibido'
    };

    const isEditable = order.status === 'draft';
    const isReceivable = order.status === 'submitted' || order.status === 'partially_received';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <a href="/purchases/orders" className="text-slate-400 hover:text-blue-600">
                            <ArrowLeft className="w-5 h-5" />
                        </a>
                        <h1 className="text-2xl font-bold text-slate-800">OC #{order.order_number}</h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">
                            {statusLabels[order.status] || order.status.replace('_', ' ')}
                        </span>
                    </div>
                    <p className="text-slate-500">
                        Proveedor: <span className="font-semibold text-slate-700">{order.supplier?.name}</span>
                        {order.expected_delivery_date && <span className="ml-4">Entrega Esperada: {order.expected_delivery_date}</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isEditable && (
                        <button
                            onClick={() => handleStatusChange('submitted')}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                            <Send className="w-4 h-4" />
                            Enviar Orden
                        </button>
                    )}
                    {isReceivable && (
                        <button
                            onClick={() => {
                                // Initialize receive data
                                const initialData: any = {};
                                items.forEach(i => {
                                    if (i.status === 'pending') {
                                        initialData[i.id] = { qty: 0, price: i.unit_price, updatePrice: false };
                                    }
                                });
                                setReceiveData(initialData);
                                setIsReceiveModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                            <PackageCheck className="w-4 h-4" />
                            Recibir Artículos
                        </button>
                    )}
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-800">Artículos de la Orden</h2>
                    {isEditable && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                            <Plus className="w-4 h-4" /> Agregar Artículo
                        </button>
                    )}
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3">Artículo</th>
                            <th className="px-6 py-3 text-center">Cant. Pedida</th>
                            <th className="px-6 py-3 text-center">Cant. Recibida</th>
                            <th className="px-6 py-3 text-right">Precio Unitario</th>
                            <th className="px-6 py-3 text-right">Total</th>
                            <th className="px-6 py-3 text-right">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item: any) => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 font-medium text-slate-800">{item._name}</td>
                                <td className="px-6 py-4 text-center">{item.quantity}</td>
                                <td className="px-6 py-4 text-center">{item.quantity_received}</td>
                                <td className="px-6 py-4 text-right">${item.unit_price}</td>
                                <td className="px-6 py-4 text-right font-medium">${item.quantity * item.unit_price}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${item.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {itemStatusLabels[item.status] || item.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Item Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Agregar Artículo a la Orden">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <select
                            className="px-3 py-2 border rounded-lg"
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value)}
                        >
                            <option value="aluminum_profile">Perfil</option>
                            <option value="aluminum_accessory">Acc. Aluminio</option>
                            <option value="glass_type">Hoja de Vidrio</option>
                            <option value="glass_accessory">Acc. Vidrio</option>
                            <option value="tool">Herramienta</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Buscar código/nombre..."
                            className="flex-1 px-3 py-2 border rounded-lg"
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                        />
                        <button onClick={executeSearch} className="px-3 py-2 bg-slate-100 rounded-lg">Buscar</button>
                    </div>

                    {inventoryResults.length > 0 && (
                        <ul className="border rounded-lg max-h-40 overflow-y-auto">
                            {inventoryResults.map(res => (
                                <li
                                    key={res.id}
                                    className={`p-2 cursor-pointer hover:bg-blue-50 ${selectedItem?.id === res.id ? 'bg-blue-50 text-blue-700' : ''}`}
                                    onClick={() => setSelectedItem(res)}
                                >
                                    {res.name}
                                </li>
                            ))}
                        </ul>
                    )}

                    {selectedItem && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Cantidad</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={newItemQty}
                                    onChange={(e) => setNewItemQty(Number(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Precio Unitario</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={newItemPrice}
                                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                        <button
                            onClick={handleAddItem}
                            disabled={!selectedItem}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                        >
                            Agregar a la Orden
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Receive Modal */}
            <Modal isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} title="Recibir Artículos" size="lg">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-4">
                        Ingrese la cantidad recibida para cada artículo. Esto actualizará su stock inmediatamente.
                    </p>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        {items.filter((i: any) => i.status === 'pending').map((item: any) => (
                            <div key={item.id} className="p-4 border rounded-lg bg-slate-50">
                                <div className="flex justify-between font-medium mb-2">
                                    <span>{item._name}</span>
                                    <span className="text-sm text-slate-500">Pedido: {item.quantity}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700">Cant. Recibida</label>
                                        <input
                                            type="number"
                                            className="w-full px-2 py-1 border rounded"
                                            value={receiveData[item.id]?.qty || 0}
                                            onChange={(e) => setReceiveData(prev => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], qty: Number(e.target.value) }
                                            }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700">Precio Confirmado</label>
                                        <input
                                            type="number"
                                            className="w-full px-2 py-1 border rounded"
                                            value={receiveData[item.id]?.price || 0}
                                            onChange={(e) => setReceiveData(prev => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], price: Number(e.target.value) }
                                            }))}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2 text-xs">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={receiveData[item.id]?.updatePrice || false}
                                            onChange={(e) => setReceiveData(prev => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], updatePrice: e.target.checked }
                                            }))}
                                        />
                                        Actualizar precio del proveedor
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <button onClick={() => setIsReceiveModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                        <button
                            onClick={handleReceiveSubmit}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg"
                        >
                            Confirmar Recepción
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
