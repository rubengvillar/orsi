import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { StockTable, type Column } from './StockTable';
import type { GlassType, GlassRemnant, GlassSheet } from '../../types/database'; // Import GlassSheet
import { Modal } from '../ui/Modal';
import { Plus, Package, Layers, Grid, Trash2 } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { hasPermission } from '../../stores/authStore';
import { PERMISSIONS } from '../../lib/permissions';

export default function GlassManager() {
    const [activeTab, setActiveTab] = useState<'types' | 'sheets' | 'remnants'>('types');
    const [glassTypes, setGlassTypes] = useState<(GlassType & { quantity: number; min_stock: number })[]>([]);
    const [allSheets, setAllSheets] = useState<(GlassSheet & { glass_types?: GlassType })[]>([]);
    const [remnants, setRemnants] = useState<(GlassRemnant & { glass_types?: GlassType })[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [isRemnantModalOpen, setIsRemnantModalOpen] = useState(false);

    // Forms
    const [typeForm, setTypeForm] = useState<any>({
        code: '', thickness_mm: '', color: '', description: '', // Removed min_stock_sheets
        structure: 'Simple', initial_stock: 0
    });
    const [remnantForm, setRemnantForm] = useState<Partial<GlassRemnant>>({
        glass_type_id: '', width_mm: 0, height_mm: 0, quantity: 1, location: ''
    });

    // Sheet Management
    const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
    const [selectedTypeSheets, setSelectedTypeSheets] = useState<GlassType | null>(null);
    const [sheetsList, setSheetsList] = useState<any[]>([]);
    const [sheetForm, setSheetForm] = useState({ width_mm: 2400, height_mm: 3210, quantity: 0, min_stock: 0 });

    const [editingId, setEditingId] = useState<string | null>(null);

    const canWrite = hasPermission(PERMISSIONS.INVENTORY_GLASS_WRITE);

    // Auto-generation is now handled by database triggers

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
                // Sum all quantities from all sheet records for this type
                quantity: t.glass_sheets?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0,
                // min_stock: t.min_stock_sheets // Removed from type summary
            }));
            setGlassTypes(processed);
        }

        // Fetch Remnants
        const { data: rems } = await supabase
            .from('glass_remnants')
            .select('*, glass_types(code, color, thickness_mm, structure)')
            .order('created_at', { ascending: false });

        if (rems) setRemnants(rems);

        // Fetch All Sheets (for the new tab)
        const { data: sheets } = await supabase
            .from('glass_sheets')
            .select('*, glass_types(code, color, thickness_mm, structure)')
            .order('created_at', { ascending: false });

        if (sheets) setAllSheets(sheets);

        setLoading(false);
    }

    // --- HANDLERS FOR GLASS TYPES ---

    function handleOpenTypeModal(item?: GlassType) {
        if (item) {
            setEditingId(item.id);
            const { quantity, min_stock_sheets, glass_sheets, ...formData } = item as any; // Exclude computed props
            setTypeForm({ ...formData, initial_stock: 0 }); // Stock is managed separately now
        } else {
            setEditingId(null);
            setTypeForm({
                code: '', thickness_mm: '', color: '', description: '',
                structure: 'Simple', initial_stock: 0
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
                thickness_mm: cleanForm.thickness_mm, // Keep as text
                structure: cleanForm.structure || 'Simple',
                min_stock_sheets: 0 // Deprecated/Unused
            };

            if (editingId) {
                const { error } = await supabase.from('glass_types').update(payload).eq('id', editingId);
                if (error) throw error;

                // Optionally update stock if it's an edit? 
                // For now we just focus on the type info as per user request.
                await handleUpdateStock({ id: editingId } as any, initial_stock);
            } else {
                const typePayload = { ...payload };
                if (!typePayload.code) delete typePayload.code;

                const { data, error } = await supabase.from('glass_types').insert(typePayload).select().single();
                if (error) throw error;
                if (data && initial_stock > 0) {
                    // Default 2400x3210 for initial stock if added via this simple form
                    await supabase.from('glass_sheets').insert({
                        glass_type_id: data.id,
                        quantity: initial_stock || 0,
                        width_mm: 2400,
                        height_mm: 3210,
                        min_stock: 0
                    });
                }
            }
            await fetchData();
            setIsTypeModalOpen(false);
        } catch (err: any) { alert("Error al guardar: " + err.message); }
        setLoading(false);
    }

    async function handleUpdateStock(type: GlassType) {
        // Open Sheet Manager instead
        setSelectedTypeSheets(type);
        await fetchSheetsForType(type.id);
        setIsSheetModalOpen(true);
    }

    async function fetchSheetsForType(typeId: string) {
        const { data } = await supabase.from('glass_sheets').select('*').eq('glass_type_id', typeId);
        setSheetsList(data || []);
    }

    // Generic Add Sheet Handler
    async function handleAddGenericSheet(e: React.FormEvent) {
        e.preventDefault();
        // Check if type selected
        if (!selectedTypeSheets) return alert("Seleccione un tipo de vidrio");

        await supabase.from('glass_sheets').insert({
            glass_type_id: selectedTypeSheets.id,
            width_mm: sheetForm.width_mm,
            height_mm: sheetForm.height_mm,
            quantity: sheetForm.quantity,
            min_stock: sheetForm.min_stock
        });

        setSheetForm({ ...sheetForm, quantity: 0, min_stock: 0 });
        fetchData(); // Refresh all lists
        setIsSheetModalOpen(false);
    }

    async function handleDeleteSheet(id: string) {
        if (!confirm("Eliminar este stock?")) return;
        await supabase.from('glass_sheets').delete().eq('id', id);
        if (selectedTypeSheets) fetchSheetsForType(selectedTypeSheets.id);
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
        { key: 'structure', label: 'Estructura' },
        { key: 'description', label: 'Descripción' },
        // Removed Stock Count and Min Stock from Types view as per request
    ];

    const remnantColumns: Column<any>[] = [
        { key: 'glass_types', label: 'Tipo', render: (val) => `${val?.code || '?'} (${val?.thickness_mm}mm ${val?.color} ${val?.structure || ''})` },
        { key: 'width_mm', label: 'Ancho (mm)' },
        { key: 'height_mm', label: 'Alto (mm)' },
        { key: 'quantity', label: 'Cant' },
        { key: 'location', label: 'Ubicación' },
    ];

    const sheetColumns: Column<any>[] = [
        { key: 'glass_types', label: 'Tipo', render: (val) => `${val?.code || '?'} (${val?.thickness_mm}mm ${val?.color} ${val?.structure || ''})` },
        { key: 'width_mm', label: 'Ancho (mm)' },
        { key: 'height_mm', label: 'Alto (mm)' },
        {
            key: 'quantity', label: 'Stock Total', render: (val, item) =>
                <span className={val <= (item.min_stock || 0) ? 'text-red-600 font-bold' : ''}>{val}</span>
        },
        { key: 'min_stock', label: 'Stock Mínimo' },
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
                            onClick={() => setActiveTab('sheets')}
                            className={`pb-2 px-1 font-medium text-sm transition-colors border-b-2 ${activeTab === 'sheets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4" /> Hojas (Detalle)</div>
                        </button>
                        <button
                            onClick={() => setActiveTab('remnants')}
                            className={`pb-2 px-1 font-medium text-sm transition-colors border-b-2 ${activeTab === 'remnants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2"><Grid className="w-4 h-4" /> Rezagos / Recortes</div>
                        </button>
                    </div>
                </div>

                {canWrite && (
                    <button
                        onClick={() => {
                            if (activeTab === 'types') handleOpenTypeModal();
                            else if (activeTab === 'sheets') {
                                setSelectedTypeSheets(null); // Clear selection for generic add
                                setIsSheetModalOpen(true);
                            }
                            else handleOpenRemnantModal();
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {activeTab === 'types' ? 'Nuevo Tipo Vidrio' : activeTab === 'sheets' ? 'Cargar Stock Hoja' : 'Cargar Rezago'}
                    </button>
                )}
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
                    canEdit={canWrite}
                    canDelete={canWrite}
                />
            ) : activeTab === 'sheets' ? (
                <div className="space-y-4">
                    {/* No "Add Button" here, users should add via Type > Manage or we could add a "Quick Add Sheet" button later. 
                         For now, users requested primarily to SEE the info. */}
                    <StockTable
                        data={allSheets}
                        columns={sheetColumns}
                        onEdit={(item) => {
                            // Edit sheet? Maybe just redirect to the type manager modal or simple edit modal?
                            // For now, let's just allow deleting or updating quantity via direct action if needed
                            // Re-using handleUpdateStock logic or custom
                            // Simple: Open Manage Modal for this type
                            if (item.glass_types) handleUpdateStock(item.glass_types);
                        }}
                        onDelete={async (item) => {
                            await handleDeleteSheet(item.id);
                        }}
                        isLoading={loading}
                        canEdit={canWrite}
                        canDelete={canWrite}
                    />
                </div>
            ) : (
                <StockTable
                    data={remnants}
                    columns={remnantColumns}
                    onEdit={handleOpenRemnantModal}
                    onDelete={handleDeleteRemnant}
                    isLoading={loading}
                    canEdit={canWrite}
                    canDelete={canWrite}
                />
            )}

            {/* MODAL TYPES */}
            <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title="Tipo de Vidrio">
                <form onSubmit={handleTypeSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                            <input type="text" value={typeForm.code} onChange={e => setTypeForm({ ...typeForm, code: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Auto-generar" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Espesor (mm)</label>
                            <input type="text" required value={typeForm.thickness_mm} onChange={e => setTypeForm({ ...typeForm, thickness_mm: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="Ej. 4, 3+3, DVH" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                            <input type="text" value={typeForm.color || ''} onChange={e => setTypeForm({ ...typeForm, color: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Estructura</label>
                            <select
                                value={typeForm.structure || 'Simple'}
                                onChange={e => setTypeForm({ ...typeForm, structure: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg"
                            >
                                <option value="Simple">Simple</option>
                                <option value="Laminado">Laminado</option>
                                <option value="DVH">DVH</option>
                            </select>
                        </div>
                    </div>



                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial (Hojas)</label>
                            <input type="number" required={!editingId} value={typeForm.initial_stock} onChange={e => setTypeForm({ ...typeForm, initial_stock: parseInt(e.target.value) })} className="w-full px-4 py-2 border rounded-lg bg-blue-50 border-blue-100" />
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

            {/* MODAL SHEET MANAGER */}
            <Modal isOpen={isSheetModalOpen} onClose={() => setIsSheetModalOpen(false)} title="Cargar Stock de Hojas">
                <div className="space-y-6">
                    {/* Add Form */}
                    <form onSubmit={handleAddGenericSheet} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Agregar Nuevo Lote
                        </h4>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vidrio</label>
                            <select
                                required
                                value={selectedTypeSheets?.id || ''}
                                onChange={e => {
                                    const t = glassTypes.find(type => type.id === e.target.value);
                                    setSelectedTypeSheets(t || null);
                                }}
                                className="w-full px-4 py-2 border rounded-lg"
                            >
                                <option value="">Seleccione un tipo...</option>
                                {glassTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color} {t.structure}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Ancho (mm)</label>
                                <input type="number" required value={sheetForm.width_mm} onChange={e => setSheetForm({ ...sheetForm, width_mm: parseInt(e.target.value) })} className="w-full px-3 py-1.5 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Alto (mm)</label>
                                <input type="number" required value={sheetForm.height_mm} onChange={e => setSheetForm({ ...sheetForm, height_mm: parseInt(e.target.value) })} className="w-full px-3 py-1.5 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
                                <input type="number" required value={sheetForm.quantity} onChange={e => setSheetForm({ ...sheetForm, quantity: parseInt(e.target.value) })} className="w-full px-3 py-1.5 border rounded font-bold text-blue-600" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Stock Mínimo</label>
                                <input type="number" value={sheetForm.min_stock} onChange={e => setSheetForm({ ...sheetForm, min_stock: parseInt(e.target.value) })} className="w-full px-3 py-1.5 border rounded" />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button type="submit" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors">Guardar Stock</button>
                        </div>
                    </form>

                    {/* Removed List from Modal - it's now in the main tab */}
                </div>
            </Modal>
        </div >
    );
}
