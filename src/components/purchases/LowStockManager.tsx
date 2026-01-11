import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Plus, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface LowStockItem {
    id: string;
    type: 'aluminum_profile' | 'aluminum_accessory' | 'glass_accessory' | 'glass_type';
    code: string;
    description: string;
    quantity: number;
    min_stock: number;
}

interface Supplier {
    id: string;
    name: string;
}

export default function LowStockManager() {
    const [items, setItems] = useState<LowStockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Create PO State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchLowStockItems();
        fetchSuppliers();
    }, []);

    const typeLabels: Record<string, string> = {
        aluminum_profile: 'Perfil Aluminio',
        aluminum_accessory: 'Acc. Aluminio',
        glass_accessory: 'Acc. Vidrio',
        glass_type: 'Vidrio'
    };

    const fetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('id, name').order('name');
        setSuppliers(data || []);
    };

    const fetchLowStockItems = async () => {
        setLoading(true);
        const lowStock: LowStockItem[] = [];

        // 1. Aluminum Profiles
        const { data: profiles } = await supabase.from('aluminum_profiles').select('*');
        if (profiles) {
            profiles.forEach(p => {
                if (p.quantity <= p.min_stock) {
                    lowStock.push({
                        id: p.id,
                        type: 'aluminum_profile',
                        code: p.code,
                        description: p.description || '',
                        quantity: p.quantity,
                        min_stock: p.min_stock
                    });
                }
            });
        }

        // 2. Aluminum Accessories
        const { data: alAccessories } = await supabase.from('aluminum_accessories').select('*');
        if (alAccessories) {
            alAccessories.forEach(a => {
                if (a.quantity <= a.min_stock) {
                    lowStock.push({
                        id: a.id,
                        type: 'aluminum_accessory',
                        code: a.code,
                        description: a.description || '',
                        quantity: a.quantity,
                        min_stock: a.min_stock
                    });
                }
            });
        }

        // 3. Glass Accessories
        const { data: glAccessories } = await supabase.from('glass_accessories').select('*');
        if (glAccessories) {
            glAccessories.forEach(a => {
                if (a.quantity <= a.min_stock) {
                    lowStock.push({
                        id: a.id,
                        type: 'glass_accessory',
                        code: a.code,
                        description: a.description || '',
                        quantity: a.quantity,
                        min_stock: a.min_stock
                    });
                }
            });
        }

        // 4. Glass Sheets (Types)
        // We need to fetch types and sum up their sheets
        const { data: glassTypes } = await supabase.from('glass_types').select('*');
        const { data: glassSheets } = await supabase.from('glass_sheets').select('glass_type_id, quantity');

        if (glassTypes && glassSheets) {
            glassTypes.forEach(t => {
                const totalSheets = glassSheets
                    .filter(s => s.glass_type_id === t.id)
                    .reduce((sum, s) => sum + s.quantity, 0);

                if (totalSheets <= t.min_stock_sheets) {
                    lowStock.push({
                        id: t.id,
                        type: 'glass_type' as any, // Cast because LowStockItem type needs update
                        code: t.code,
                        description: t.description || `Espesor: ${t.thickness_mm}mm`,
                        quantity: totalSheets,
                        min_stock: t.min_stock_sheets
                    });
                }
            });
        }

        setItems(lowStock);
        setLoading(false);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const handleCreatePO = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId || selectedItems.size === 0) return;

        setCreating(true);
        try {
            // 1. Create Order
            const { data: order, error: orderError } = await supabase
                .from('purchase_orders')
                .insert([{
                    supplier_id: selectedSupplierId,
                    status: 'draft',
                    is_manual: false
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Add Items
            const itemsToAdd = items.filter(i => selectedItems.has(i.id));
            const poItems = itemsToAdd.map(item => ({
                purchase_order_id: order.id,
                product_type: item.type,
                product_id: item.id,
                quantity: Math.max(1, item.min_stock - item.quantity), // Default to replenishment qty
                unit_price: 0 // Will need to be filled
            }));

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(poItems);

            if (itemsError) throw itemsError;

            // Redirect
            window.location.href = `/purchases/orders/${order.id}`;
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error al crear la orden');
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">
                        {items.length} artículos por debajo del nivel mínimo de stock
                    </span>
                </div>
                {selectedItems.size > 0 && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Crear Orden ({selectedItems.size})
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Escaneando inventario...</div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedItems(new Set(items.map(i => i.id)));
                                            else setSelectedItems(new Set());
                                        }}
                                        checked={selectedItems.size === items.length && items.length > 0}
                                    />
                                </th>
                                <th className="px-6 py-3">Código / Descripción</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-center">Stock Actual</th>
                                <th className="px-6 py-3 text-center">Stock Mínimo</th>
                                <th className="px-6 py-3 text-center">Déficit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => toggleSelection(item.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{item.code}</div>
                                        <div className="text-slate-500 text-xs">{item.description}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{typeLabels[item.type] || item.type}</td>
                                    <td className="px-6 py-4 text-center font-medium text-red-600">{item.quantity}</td>
                                    <td className="px-6 py-4 text-center text-slate-600">{item.min_stock}</td>
                                    <td className="px-6 py-4 text-center font-medium text-amber-600">
                                        {item.min_stock - item.quantity}
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        Todos los niveles de stock están saludables.
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
                <form onSubmit={handleCreatePO} className="space-y-4">
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
                            Se creará una nueva orden borrador con los {selectedItems.size} artículos seleccionados.
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
                            {creating ? 'Creando...' : 'Crear Orden'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
