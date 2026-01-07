import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { GlassType, GlassRemnant } from '../../types/database';
import { StockTable, type Column } from './StockTable';
import { Modal } from '../ui/Modal';
import { Plus, Package, Layers, Grid } from 'lucide-react';

export default function GlassManager() {
    const [activeTab, setActiveTab] = useState<'types' | 'remnants'>('types');
    const [glassTypes, setGlassTypes] = useState<(GlassType & { quantity: number; min_stock: number })[]>([]);
    const [remnants, setRemnants] = useState<(GlassRemnant & { glass_types?: GlassType })[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [isRemnantModalOpen, setIsRemnantModalOpen] = useState(false);

    // Forms
    const [typeForm, setTypeForm] = useState<any>({
        code: '', thickness_mm: '', color: '', description: '', min_stock_sheets: 0,
        std_width_mm: 2400, std_height_mm: 3210, initial_stock: 0
    });
    const [remnantForm, setRemnantForm] = useState<Partial<GlassRemnant>>({
        glass_type_id: '', width_mm: 0, height_mm: 0, quantity: 1, location: ''
    });

    const [editingId, setEditingId] = useState<string | null>(null);

    // Auto-generate code and description
    useEffect(() => {
        if (!isTypeModalOpen || editingId) return; // Only auto-gen for NEW items

        const thickness = typeForm.thickness_mm?.toString() || "";
        const color = typeForm.color || "";

        if (thickness) {
            const colorPrefix = color ? color.substring(0, 3).toUpperCase() : "";
            const generatedCode = `${thickness}${colorPrefix ? "-" + colorPrefix : ""}`;
            const generatedDesc = `Vidrio Float ${thickness}mm ${color}`.trim();

            setTypeForm((prev: any) => ({
                ...prev,
                code: prev.code === "" || prev.code === undefined || prev.code.match(/^\d+(-[A-Z]{0,3})?$/) ? generatedCode : prev.code,
                description: prev.description === "" || prev.description === undefined || prev.description?.startsWith("Vidrio Float") ? generatedDesc : prev.description
            }));
        }
    }, [typeForm.thickness_mm, typeForm.color, isTypeModalOpen]);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        // Fetch Types and their sheet counts
        const { data: types } = await supabase
            .from('glass_types')
            .select('*, glass_sheets(quantity)')
            .order('code');

        if (types) {
            const processed = types.map(t => ({
                ...t,
                quantity: t.glass_sheets?.[0]?.quantity || 0,
                min_stock: t.min_stock_sheets
            }));
            setGlassTypes(processed);
        }

        // Fetch Remnants
        const { data: rems } = await supabase
            .from('glass_remnants')
            .select('*, glass_types(code, color, thickness_mm)')
            .order('created_at', { ascending: false });

        if (rems) setRemnants(rems);
        setLoading(false);
    }

    // --- HANDLERS FOR GLASS TYPES ---

    function handleOpenTypeModal(item?: GlassType) {
        if (item) {
            setEditingId(item.id);
            const { quantity, min_stock, glass_sheets, ...formData } = item as any; // Exclude computed props
            setTypeForm({ ...formData, initial_stock: quantity });
        } else {
            setEditingId(null);
            setTypeForm({
                code: '', thickness_mm: '', color: '', description: '', min_stock_sheets: 0,
                std_width_mm: 2400, std_height_mm: 3210, initial_stock: 0
            });
        }
        setIsTypeModalOpen(true);
    }

    async function handleTypeSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const { initial_stock, quantity, min_stock, glass_sheets, id, created_at, ...cleanForm } = typeForm;

            // Explicitly ensure numeric types for dimensions
            const payload = {
                ...cleanForm,
                thickness_mm: parseFloat(cleanForm.thickness_mm),
                std_width_mm: parseInt(cleanForm.std_width_mm),
                std_height_mm: parseInt(cleanForm.std_height_mm),
                min_stock_sheets: parseInt(cleanForm.min_stock_sheets)
            };

            if (editingId) {
                const { error } = await supabase.from('glass_types').update(payload).eq('id', editingId);
                if (error) throw error;

                // Optionally update stock if it's an edit? 
                // For now we just focus on the type info as per user request.
                await handleUpdateStock({ id: editingId } as any, initial_stock);
            } else {
                const { data, error } = await supabase.from('glass_types').insert(payload).select().single();
                if (error) throw error;
                if (data) {
                    await supabase.from('glass_sheets').insert({ glass_type_id: data.id, quantity: initial_stock || 0 });
                }
            }
            await fetchData();
            setIsTypeModalOpen(false);
        } catch (err: any) { alert("Error al guardar: " + err.message); }
        setLoading(false);
    }

    async function handleUpdateStock(type: GlassType, newQty: number) {
        // Check if entry exists
        const { data } = await supabase.from('glass_sheets').select('id').eq('glass_type_id', type.id).single();
        if (data) {
            await supabase.from('glass_sheets').update({ quantity: newQty }).eq('id', data.id);
        } else {
            await supabase.from('glass_sheets').insert({ glass_type_id: type.id, quantity: newQty });
        }
        fetchData();
    }

    // --- HANDLERS FOR REMNANTS ---

    function handleOpenRemnantModal(item?: GlassRemnant) {
        if (item) {
            setEditingId(item.id);
            setRemnantForm(item);
        } else {
            setEditingId(null);
            // Default to first glass type if available
            setRemnantForm({
                glass_type_id: glassTypes[0]?.id || '',
                width_mm: 0, height_mm: 0, quantity: 1, location: ''
            });
        }
        setIsRemnantModalOpen(true);
    }

    async function handleRemnantSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await supabase.from('glass_remnants').update(remnantForm).eq('id', editingId);
            } else {
                await supabase.from('glass_remnants').insert(remnantForm);
            }
            await fetchData();
            setIsRemnantModalOpen(false);
        } catch (err: any) { alert(err.message); }
        setLoading(false);
    }

    async function handleDeleteRemnant(item: GlassRemnant) {
        if (!confirm('Eliminar este rezago?')) return;
        await supabase.from('glass_remnants').delete().eq('id', item.id);
        fetchData();
    }

    // --- COLUMNS ---

    const typeColumns: Column<any>[] = [
        { key: 'code', label: 'Código' },
        { key: 'thickness_mm', label: 'Espesor (mm)' },
        { key: 'color', label: 'Color' },
        {
            key: 'dimensions',
            label: 'Medidas (mm)',
            render: (_, item) => `${item.std_width_mm} x ${item.std_height_mm}`
        },
        {
            key: 'quantity', label: 'Stock Hojas Enteras', render: (val, item) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{val}</span>
                    <button
                        onClick={() => {
                            const qty = prompt('Nuevo stock de hojas enteras:', val);
                            if (qty !== null) handleUpdateStock(item, parseInt(qty) || 0);
                        }}
                        className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600"
                    >
                        Ajustar
                    </button>
                </div>
            )
        },
        { key: 'min_stock', label: 'Min Stock' },
    ];

    const remnantColumns: Column<any>[] = [
        { key: 'glass_types', label: 'Tipo', render: (val) => `${val?.code} (${val?.thickness_mm}mm ${val?.color})` },
        { key: 'width_mm', label: 'Ancho (mm)' },
        { key: 'height_mm', label: 'Alto (mm)' },
        { key: 'quantity', label: 'Cant' },
        { key: 'location', label: 'Ubicación' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        Inventario de Vidrios
                    </h2>
                    <div className="flex gap-4 mt-4 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('types')}
                            className={`pb-2 px-1 font-medium text-sm transition-colors border-b-2 ${activeTab === 'types' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4" /> Tipos y Hojas Enteras</div>
                        </button>
                        <button
                            onClick={() => setActiveTab('remnants')}
                            className={`pb-2 px-1 font-medium text-sm transition-colors border-b-2 ${activeTab === 'remnants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2"><Grid className="w-4 h-4" /> Rezagos / Recortes</div>
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => activeTab === 'types' ? handleOpenTypeModal() : handleOpenRemnantModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    {activeTab === 'types' ? 'Nuevo Tipo Vidrio' : 'Cargar Rezago'}
                </button>
            </div>

            {activeTab === 'types' ? (
                <StockTable
                    data={glassTypes}
                    columns={typeColumns}
                    onEdit={handleOpenTypeModal}
                    // Disable delete for safety or implement logic
                    onDelete={async (item) => {
                        if (confirm(`Peligro: Eliminar ${item.code} borrará también todo el stock de hojas enteras asociado.\n\n¿Estás seguro?`)) {
                            setLoading(true);
                            await supabase.from('glass_types').delete().eq('id', item.id);
                            await fetchData();
                            setLoading(false);
                        }
                    }}
                    isLoading={loading}
                />
            ) : (
                <StockTable
                    data={remnants}
                    columns={remnantColumns}
                    onEdit={handleOpenRemnantModal}
                    onDelete={handleDeleteRemnant}
                    isLoading={loading}
                />
            )}

            {/* MODAL TYPES */}
            <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title="Tipo de Vidrio">
                <form onSubmit={handleTypeSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                            <input type="text" required value={typeForm.code} onChange={e => setTypeForm({ ...typeForm, code: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Espesor (mm)</label>
                            <input type="number" required value={typeForm.thickness_mm} onChange={e => setTypeForm({ ...typeForm, thickness_mm: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                        <input type="text" value={typeForm.color || ''} onChange={e => setTypeForm({ ...typeForm, color: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <p className="text-xs font-bold text-slate-500 uppercase">Dimensiones Hoja Estándar</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ancho (mm)</label>
                                <input type="number" required value={typeForm.std_width_mm} onChange={e => setTypeForm({ ...typeForm, std_width_mm: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Alto (mm)</label>
                                <input type="number" required value={typeForm.std_height_mm} onChange={e => setTypeForm({ ...typeForm, std_height_mm: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg bg-white" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial (Hojas)</label>
                            <input type="number" required={!editingId} value={typeForm.initial_stock} onChange={e => setTypeForm({ ...typeForm, initial_stock: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg bg-blue-50 border-blue-100" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo (Hojas)</label>
                            <input type="number" value={typeForm.min_stock_sheets} onChange={e => setTypeForm({ ...typeForm, min_stock_sheets: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">
                            {editingId ? 'Actualizar' : 'Crear Tipo de Vidrio'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL REMNANTS */}
            <Modal isOpen={isRemnantModalOpen} onClose={() => setIsRemnantModalOpen(false)} title="Cargar Rezago">
                <form onSubmit={handleRemnantSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vidrio</label>
                        <select
                            value={remnantForm.glass_type_id}
                            onChange={e => setRemnantForm({ ...remnantForm, glass_type_id: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg"
                        >
                            {glassTypes.map(t => <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ancho (mm)</label>
                            <input type="number" required value={remnantForm.width_mm} onChange={e => setRemnantForm({ ...remnantForm, width_mm: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Alto (mm)</label>
                            <input type="number" required value={remnantForm.height_mm} onChange={e => setRemnantForm({ ...remnantForm, height_mm: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                            <input type="number" required value={remnantForm.quantity} onChange={e => setRemnantForm({ ...remnantForm, quantity: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                            <input type="text" value={remnantForm.location || ''} onChange={e => setRemnantForm({ ...remnantForm, location: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Estante A1" />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
                    </div>
                </form>
            </Modal>

        </div>
    );
}
