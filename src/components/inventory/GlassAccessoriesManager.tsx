import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { GlassAccessory } from '../../types/database';
import { StockTable, type Column } from './StockTable';
import { Modal } from '../ui/Modal';
import { Plus, Package } from 'lucide-react';

export default function GlassAccessoriesManager() {
    const [items, setItems] = useState<GlassAccessory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<GlassAccessory>>({
        code: '', description: '', quantity: 0, min_stock: 0
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const columns: Column<GlassAccessory>[] = [
        { key: 'code', label: 'Código' },
        { key: 'description', label: 'Descripción' },
        { key: 'description', label: 'Descripción' },
        {
            key: 'quantity',
            label: 'Cantidad',
            render: (val, item) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{val}</span>
                    <button
                        onClick={() => {
                            const qty = prompt('Nuevo stock:', String(val));
                            if (qty !== null && !isNaN(parseInt(qty))) {
                                handleUpdateStock(item, parseInt(qty));
                            }
                        }}
                        className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 border border-slate-300 transition-colors"
                        title="Ajuste Rápido"
                    >
                        Adjust
                    </button>
                </div>
            )
        },
        { key: 'min_stock', label: 'Stock Mínimo' },
        { key: 'min_stock', label: 'Stock Mínimo' },
    ];

    useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        setLoading(true);
        const { data } = await supabase.from('glass_accessories').select('*').order('code');
        if (data) setItems(data);
        setLoading(false);
    }

    function handleOpenModal(item?: GlassAccessory) {
        if (item) {
            setEditingId(item.id);
            setFormData(item);
        } else {
            setEditingId(null);
            setFormData({ code: '', description: '', quantity: 0, min_stock: 0 });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('glass_accessories')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('glass_accessories')
                    .insert(formData);
                if (error) throw error;
            }
            await fetchItems();
            setIsModalOpen(false);
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(item: GlassAccessory) {
        if (!confirm(`¿Eliminar ${item.code}?`)) return;
        await supabase.from('glass_accessories').delete().eq('id', item.id);
        fetchItems();
    }

    async function handleUpdateStock(item: GlassAccessory, newQty: number) {
        setLoading(true);
        const { error } = await supabase
            .from('glass_accessories')
            .update({ quantity: newQty })
            .eq('id', item.id);

        if (error) alert('Error updating stock: ' + error.message);
        else await fetchItems();
        setLoading(false);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Insumos de Vidrio
                </h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Insumo
                </button>
            </div>

            <StockTable
                data={items}
                columns={columns}
                onEdit={handleOpenModal}
                onDelete={handleDelete}
                isLoading={loading}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Insumo' : 'Nuevo Insumo'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                            <input
                                type="number"
                                required
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <input
                            type="text"
                            required
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                        <input
                            type="number"
                            required
                            value={formData.min_stock}
                            onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
