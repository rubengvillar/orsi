import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Toolbox, ToolboxItem, Tool, Team } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Box, Plus, Settings, Trash2, ArrowRightLeft, AlertTriangle } from 'lucide-react';

export default function ToolboxManager() {
    const [toolboxes, setToolboxes] = useState<Toolbox[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBox, setSelectedBox] = useState<Toolbox & { items?: ToolboxItem[] } | null>(null);
    const [availableTools, setAvailableTools] = useState<Tool[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isManageOpen, setIsManageOpen] = useState(false);

    // Create Form
    const [formData, setFormData] = useState({ name: '', description: '', team_id: '' });

    // Manage Item Form
    const [selectedToolId, setSelectedToolId] = useState('');
    const [itemQuantity, setItemQuantity] = useState(1);

    // Loss Report State
    const [reportingLossItem, setReportingLossItem] = useState<ToolboxItem | null>(null);
    const [lossReason, setLossReason] = useState('');
    const [lossQuantity, setLossQuantity] = useState(1);

    useEffect(() => {
        fetchToolboxes();
        fetchTools();
        fetchTeams();
    }, []);

    const fetchToolboxes = async () => {
        setLoading(true);
        // Fetch with Team ref and nested members
        const { data } = await supabase.from('toolboxes')
            .select(`
                *, 
                team:teams(
                    name, 
                    color, 
                    team_members(
                        operator:operators(full_name)
                    )
                )
            `)
            .eq('is_active', true)
            .order('name');
        setToolboxes(data || []);
        setLoading(false);
    };

    const fetchTools = async () => {
        const { data } = await supabase.from('tools').select('*').eq('is_active', true).gt('quantity_available', 0);
        setAvailableTools(data || []);
    };

    const fetchTeams = async () => {
        const { data } = await supabase.from('teams').select('*').order('name');
        setTeams(data || []);
    };

    const fetchBoxDetails = async (boxId: string) => {
        const { data } = await supabase
            .from('toolbox_items')
            .select('*, tool:tools(*)')
            .eq('toolbox_id', boxId);

        if (selectedBox && selectedBox.id === boxId) {
            setSelectedBox({ ...selectedBox, items: data || [] });
        }
        return data || [];
    };

    const handleCreateBox = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            description: formData.description,
            team_id: formData.team_id || null,
            // Fallback for legacy text field if needed, or ignore
            assigned_to_team: null
        };
        const { error } = await supabase.from('toolboxes').insert(payload);
        if (error) alert(error.message);
        else {
            setIsCreateOpen(false);
            setFormData({ name: '', description: '', team_id: '' });
            fetchToolboxes();
        }
    };

    const handleOpenManage = async (box: Toolbox) => {
        setSelectedBox(box);
        const items = await fetchBoxDetails(box.id);
        setSelectedBox({ ...box, items });
        setIsManageOpen(true);
    };

    const handleAddItem = async () => {
        if (!selectedBox || !selectedToolId) return;
        try {
            const { error } = await supabase.rpc('manage_toolbox_item', {
                p_toolbox_id: selectedBox.id,
                p_tool_id: selectedToolId,
                p_quantity_change: itemQuantity
            });
            if (error) throw error;

            // Refresh
            await fetchBoxDetails(selectedBox.id);
            fetchTools(); // Update stock availability
            setSelectedToolId('');
            setItemQuantity(1);
        } catch (err: any) {
            alert('Error adding tool: ' + err.message);
        }
    };

    const handleRemoveItem = async (itemId: string, toolId: string, currentQty: number) => {
        // Just remove 1 for simplicity or ask? Let's just remove 1.
        if (!selectedBox) return;
        try {
            const { error } = await supabase.rpc('manage_toolbox_item', {
                p_toolbox_id: selectedBox.id,
                p_tool_id: toolId,
                p_quantity_change: -1
            });
            if (error) throw error;
            await fetchBoxDetails(selectedBox.id);
            fetchTools();
        } catch (err: any) {
            alert('Error removing tool: ' + err.message);
        }
    };

    const handleReportLoss = async () => {
        if (!selectedBox || !reportingLossItem) return;
        try {
            const { error } = await supabase.rpc('report_tool_loss', {
                p_toolbox_id: selectedBox.id,
                p_tool_id: reportingLossItem.tool_id,
                p_quantity: lossQuantity,
                p_reason: lossReason,
                p_reported_by: null // In real app, use auth.user.id or let user select Operator
            });
            if (error) throw error;

            alert('Pérdida reportada correctamente. Stock total ajustado.');
            setReportingLossItem(null);
            setLossReason('');
            setLossQuantity(1);
            await fetchBoxDetails(selectedBox.id);
        } catch (err: any) {
            alert('Error reporting loss: ' + err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Box className="w-6 h-6 text-amber-600" />
                    Cajones de Herramientas
                </h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Cajón
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {toolboxes.map(box => (
                    <div key={box.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-slate-800">{box.name}</h3>
                            <button onClick={() => handleOpenManage(box)} className="text-slate-400 hover:text-blue-600">
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4 h-10 overflow-hidden">{box.description || 'Sin descripción'}</p>
                        <div className="bg-slate-50 rounded-lg p-3 text-xs flex justify-between items-center">
                            <div className="w-full">
                                <span className="font-bold uppercase text-slate-400 block mb-1">Asignado a:</span>
                                {box.team ? (
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 font-medium text-slate-700 mb-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: box.team.color }} />
                                            {box.team.name}
                                        </div>
                                        {(box.team as any).team_members?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(box.team as any).team_members.map((m: any, idx: number) => (
                                                    <span key={idx} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-600 shadow-sm">
                                                        {m.operator?.full_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {((box.team as any).team_members || []).length === 0 && (
                                            <div className="text-[10px] text-slate-400 italic">Sin miembros</div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">Sin asignar</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Box Modal */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo Cajón de Herramientas">
                <form onSubmit={handleCreateBox} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Ej. Cajón Carpintería A" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Equipo Responsable</label>
                        <select
                            value={formData.team_id}
                            onChange={e => setFormData({ ...formData, team_id: e.target.value })}
                            className="w-full border rounded px-3 py-2 bg-white"
                        >
                            <option value="">(Sin asignar)</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end pt-4"><button className="bg-blue-600 text-white px-4 py-2 rounded">Crear</button></div>
                </form>
            </Modal>

            {/* Manage Box Modal */}
            {isManageOpen && selectedBox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-lg">Gestionar {selectedBox.name}</h3>
                                {(selectedBox as any).team && (
                                    <div className="flex flex-col gap-1 mt-1">
                                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 inline-flex items-center gap-1 w-fit">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (selectedBox as any).team.color }} />
                                            {(selectedBox as any).team.name}
                                        </span>
                                        {(selectedBox as any).team.team_members?.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                                {(selectedBox as any).team.team_members.map((m: any, idx: number) => (
                                                    <span key={idx} className="text-[10px] text-slate-500 bg-slate-50 border px-1 rounded">
                                                        {m.operator?.full_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setIsManageOpen(false)}><Settings className="w-5 h-5 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6">
                            {/* Inventory List */}
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <Box className="w-4 h-4" /> Contenido Actual
                                </h4>
                                <div className="space-y-2">
                                    {selectedBox.items?.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div>
                                                <div className="font-bold text-sm">{item.tool?.name}</div>
                                                <div className="text-xs text-slate-500">Cant: {item.quantity}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setReportingLossItem(item)}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-100 rounded text-xs flex items-center gap-1 font-medium"
                                                    title="Reportar Pérdida / Rotura"
                                                >
                                                    <AlertTriangle className="w-3 h-3" /> Reportar
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveItem(item.id, item.tool_id, item.quantity)}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                                                    title="Devolver al Stock"
                                                >
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedBox.items || selectedBox.items.length === 0) && (
                                        <div className="text-center text-slate-400 py-8 italic bg-slate-50/50 rounded-lg dashed border border-slate-200">
                                            Cajón vacío. Agrega herramientas desde el panel derecho.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Add Item Panel */}
                            <div className="w-full md:w-80 bg-slate-50 p-4 rounded-xl h-fit border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-4">Agregar Herramienta</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Herramienta</label>
                                        <select
                                            value={selectedToolId}
                                            onChange={e => setSelectedToolId(e.target.value)}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {availableTools.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} (Disp: {t.quantity_available})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Cantidad</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={itemQuantity}
                                            onChange={e => setItemQuantity(parseInt(e.target.value))}
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddItem}
                                        disabled={!selectedToolId}
                                        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Agregar al Cajón
                                    </button>
                                    <p className="text-[10px] text-slate-500 text-center mt-2">
                                        Al agregar, se descontará del stock disponible general.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Loss Modal */}
            {reportingLossItem && (
                <Modal isOpen={!!reportingLossItem} onClose={() => setReportingLossItem(null)} title="Reportar Pérdida / Rotura">
                    <div className="space-y-4">
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200">
                            Estás reportando una <strong>baja definitiva</strong> de inventario.
                            <div className="font-bold mt-1">{reportingLossItem.tool?.name}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Cantidad Afectada</label>
                            <input type="number" min="1" max={reportingLossItem.quantity} value={lossQuantity} onChange={e => setLossQuantity(parseInt(e.target.value))} className="w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Motivo / Causa</label>
                            <textarea rows={3} value={lossReason} onChange={e => setLossReason(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Ej. Se rompió durante la instalación en Obra X..." />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <button onClick={() => setReportingLossItem(null)} className="px-4 py-2 text-slate-600">Cancelar</button>
                            <button onClick={handleReportLoss} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Confirmar Baja</button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
}
