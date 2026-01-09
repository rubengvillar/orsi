import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { AluminumProfile } from '../../types/database';
import { StockTable, type Column } from './StockTable';
import { Modal } from '../ui/Modal';
import { Plus, Package } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { hasPermission } from '../../stores/authStore';
import { PERMISSIONS } from '../../lib/permissions';

export default function ProfilesManager() {
    const [items, setItems] = useState<AluminumProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<AluminumProfile>>({
        code: '', description: '', quantity: 0, min_stock: 0, typology: '', color: '', length_mm: 6000
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const canWrite = hasPermission(PERMISSIONS.INVENTORY_PROFILES_WRITE);

    const columns: Column<AluminumProfile>[] = [
        { key: 'code', label: 'Código' },
        { key: 'typology', label: 'Tipología' },
        { key: 'color', label: 'Color' },
        {
            key: 'quantity',
            label: 'Barras',
            render: (val, item) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{val}</span>
                    {canWrite && (
                        <button
                            onClick={() => {
                                const qty = prompt('Nuevo stock de barras:', String(val));
                                if (qty !== null && !isNaN(parseInt(qty))) {
                                    handleUpdateStock(item, parseInt(qty));
                                }
                            }}
                            className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 border border-slate-300 transition-colors"
                            title="Ajuste Rápido"
                        >
                            Adjust
                        </button>
                    )}
                </div>
            )
        },
        { key: 'description', label: 'Descripción' },
        { key: 'min_stock', label: 'Mínimo' },
    ];

    useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        setLoading(true);
        const { data } = await supabase.from('aluminum_profiles').select('*').order('code');
        if (data) setItems(data);
        setLoading(false);
    }

    function handleOpenModal(item?: AluminumProfile) {
        if (item) {
            setEditingId(item.id);
            setFormData(item);
        } else {
            setEditingId(null);
            setFormData({ code: '', description: '', quantity: 0, min_stock: 0, typology: '', color: '', length_mm: 6000 });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('aluminum_profiles')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('aluminum_profiles')
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

    async function handleDelete(item: AluminumProfile) {
        if (!confirm(`¿Eliminar ${item.code}?`)) return;
        await supabase.from('aluminum_profiles').delete().eq('id', item.id);
        fetchItems();
    }

    async function handleUpdateStock(item: AluminumProfile, newQty: number) {
        setLoading(true);
        const { error } = await supabase
            .from('aluminum_profiles')
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
                    Inventario de Perfiles
                </h2>
                {canWrite && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Perfil
                    </button>
                )}
            </div>

            <StockTable
                data={items}
                columns={columns}
                onEdit={handleOpenModal}
                onDelete={handleDelete}
                isLoading={loading}
                canEdit={canWrite}
                canDelete={canWrite}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Perfil' : 'Nuevo Perfil'}
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipología</label>
                            <input
                                type="text"
                                value={formData.typology || ''}
                                onChange={e => setFormData({ ...formData, typology: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Modena, A30..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                            <input
                                type="text"
                                value={formData.color || ''}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Largo Std (mm)</label>
                            <input
                                type="number"
                                value={formData.length_mm}
                                onChange={e => setFormData({ ...formData, length_mm: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock (Barras)</label>
                            <input
                                type="number"
                                required
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
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
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <input
                            type="text"
                            required
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
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
