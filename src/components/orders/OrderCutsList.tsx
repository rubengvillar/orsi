import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Scissors, Plus, Trash2, Layers, CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";

interface OrderCutsListProps {
    orderId: string;
}

export default function OrderCutsList({ orderId }: OrderCutsListProps) {
    const [cuts, setCuts] = useState<any[]>([]);
    const [glassTypes, setGlassTypes] = useState<any[]>([]); // Missing
    const [glassAccessories, setGlassAccessories] = useState<any[]>([]); // New
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Updated Form State
    const [formData, setFormData] = useState({
        cut_type: 'simple', // simple | dvh
        glass_type_id: "",
        dvh_outer_glass_id: "",
        dvh_inner_glass_id: "",
        dvh_chamber_id: "",
        width_mm: "",
        height_mm: "",
        quantity: "1",
        notes: ""
    });

    useEffect(() => {
        fetchData();
    }, [orderId]);

    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch glass types for the dropdown
        // 1. Fetch glass types & accessories
        const { data: types } = await supabase.from('glass_types').select('*').order('code');
        setGlassTypes(types || []);

        const { data: acc } = await supabase.from('glass_accessories').select('*').order('code');
        setGlassAccessories(acc || []);

        // Pre-selection if needed logic...
        if (types && types.length > 0 && !formData.glass_type_id) {
            setFormData(prev => ({ ...prev, glass_type_id: types[0].id }));
        }

        // 2. Fetch existing cuts
        const { data: cutsData } = await supabase
            .from("order_cuts")
            .select("*, glass_types(code, thickness_mm, color)")
            .eq("order_id", orderId)
            .order("created_at", { ascending: false });

        setCuts(cutsData || []);
        setLoading(false);
    };

    const handleAddCut = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.from("order_cuts").insert({
            order_id: orderId,
            cut_type: formData.cut_type,
            glass_type_id: formData.cut_type === 'simple' ? formData.glass_type_id : null,
            dvh_outer_glass_id: formData.cut_type === 'dvh' ? formData.dvh_outer_glass_id : null,
            dvh_inner_glass_id: formData.cut_type === 'dvh' ? formData.dvh_inner_glass_id : null,
            dvh_chamber_id: formData.cut_type === 'dvh' ? formData.dvh_chamber_id : null,
            width_mm: parseInt(formData.width_mm),
            height_mm: parseInt(formData.height_mm),
            quantity: parseInt(formData.quantity),
            notes: formData.notes,
            status: 'pending'
        });

        if (error) alert(error.message);
        else {
            setIsModalOpen(false);
            setFormData({ ...formData, width_mm: "", height_mm: "", quantity: "1", notes: "" });
            fetchData();
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este requerimiento de corte?")) return;
        await supabase.from("order_cuts").delete().eq("id", id);
        fetchData();
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic update
        setCuts(cuts.map(c => c.id === id ? { ...c, status: newStatus } : c));

        const { error } = await supabase.from("order_cuts").update({ status: newStatus }).eq("id", id);

        if (error) {
            alert("Error updating status: " + error.message);
            fetchData(); // Revert on error
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-orange-500" /> Requerimientos de Corte
                </h3>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="text-xs flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 transition-colors"
                >
                    <Plus className="w-3 h-3" /> Agregar Corte
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-2">Vidrio</th>
                            <th className="px-4 py-2">Medidas (mm)</th>
                            <th className="px-4 py-2 text-center">Cant</th>
                            <th className="px-4 py-2 text-center">Estado</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && cuts.length === 0 ? (
                            <tr><td colSpan={5} className="p-4 text-center text-slate-400">Cargando...</td></tr>
                        ) : cuts.map((cut) => (
                            <tr key={cut.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    {cut.cut_type === 'dvh' ? (
                                        <div>
                                            <div className="font-bold text-slate-800 text-xs uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded inline-block mb-1">DVH</div>
                                            <div className="text-xs space-y-0.5">
                                                <div><span className="font-semibold text-slate-500">Ext:</span> {glassTypes.find(g => g.id === cut.dvh_outer_glass_id)?.code}</div>
                                                <div><span className="font-semibold text-slate-500">Cam:</span> {glassAccessories.find(a => a.id === cut.dvh_chamber_id)?.description}</div>
                                                <div><span className="font-semibold text-slate-500">Int:</span> {glassTypes.find(g => g.id === cut.dvh_inner_glass_id)?.code}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="font-medium text-slate-800">{cut.glass_types?.code}</div>
                                            <div className="text-xs text-slate-400">{cut.glass_types?.thickness_mm}mm {cut.glass_types?.color}</div>
                                        </>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono">
                                    {cut.width_mm} x {cut.height_mm}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-slate-700">
                                    {cut.quantity}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${cut.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {cut.status === 'pending' ? 'Pendiente' : 'Cortado'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                    {cut.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusChange(cut.id, 'cut')}
                                                className="text-emerald-500 hover:text-emerald-700 transition-colors p-1 hover:bg-emerald-50 rounded"
                                                title="Marcar como Cortado"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-slate-200 my-auto"></div>
                                            <button
                                                onClick={() => handleDelete(cut.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {cut.status === 'cut' && (
                                        <button
                                            onClick={() => handleStatusChange(cut.id, 'pending')}
                                            className="text-slate-300 hover:text-amber-500 transition-colors p-1 hover:bg-amber-50 rounded"
                                            title="Volver a Pendiente"
                                        >
                                            <Layers className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {cuts.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                    No hay requerimientos de corte cargados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar Requerimiento de Corte">
                <form onSubmit={handleAddCut} className="space-y-4">
                    {/* Cut Type Selection */}
                    <div className="flex gap-4 border-b border-slate-200 pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="modal_cut_type"
                                checked={formData.cut_type === 'simple'}
                                onChange={() => setFormData({ ...formData, cut_type: 'simple' })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Simple</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="modal_cut_type"
                                checked={formData.cut_type === 'dvh'}
                                onChange={() => setFormData({ ...formData, cut_type: 'dvh' })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">DVH (Doble Vidrio)</span>
                        </label>
                    </div>

                    {formData.cut_type === 'simple' ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vidrio</label>
                            <select
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                                value={formData.glass_type_id}
                                onChange={e => setFormData({ ...formData, glass_type_id: e.target.value })}
                            >
                                <option value="">- Seleccionar -</option>
                                {glassTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-3 bg-slate-50 p-3 rounded border">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Vidrio Exterior</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={formData.dvh_outer_glass_id}
                                    onChange={e => setFormData({ ...formData, dvh_outer_glass_id: e.target.value })}
                                >
                                    <option value="">- Ext -</option>
                                    {glassTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Vidrio Interior</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={formData.dvh_inner_glass_id}
                                    onChange={e => setFormData({ ...formData, dvh_inner_glass_id: e.target.value })}
                                >
                                    <option value="">- Int -</option>
                                    {glassTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Cámara</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={formData.dvh_chamber_id}
                                    onChange={e => setFormData({ ...formData, dvh_chamber_id: e.target.value })}
                                >
                                    <option value="">- Cámara -</option>
                                    {glassAccessories.map(a => (
                                        <option key={a.id} value={a.id}>{a.description} ({a.code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ancho (mm)</label>
                            <input
                                type="number"
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                                value={formData.width_mm}
                                onChange={e => setFormData({ ...formData, width_mm: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Alto (mm)</label>
                            <input
                                type="number"
                                required
                                className="w-full px-3 py-2 border rounded-lg"
                                value={formData.height_mm}
                                onChange={e => setFormData({ ...formData, height_mm: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad de piezas iguales</label>
                        <input
                            type="number"
                            required
                            min="1"
                            className="w-full px-3 py-2 border rounded-lg"
                            value={formData.quantity}
                            onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
                        <textarea
                            className="w-full px-3 py-2 border rounded-lg"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Ej: Ventana Living..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                        >
                            {loading ? 'Agregando...' : 'Agregar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
