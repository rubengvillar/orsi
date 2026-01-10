import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Scissors, Plus, Trash2, Layers } from "lucide-react";
import { Modal } from "../ui/Modal";

interface OrderCutsListProps {
    orderId: string;
}

export default function OrderCutsList({ orderId }: OrderCutsListProps) {
    const [cuts, setCuts] = useState<any[]>([]);
    const [glassTypes, setGlassTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        glass_type_id: "",
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
        const { data: types } = await supabase.from('glass_types').select('*').order('code');
        setGlassTypes(types || []);

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
            glass_type_id: formData.glass_type_id,
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
                                    <div className="font-medium text-slate-800">{cut.glass_types?.code}</div>
                                    <div className="text-xs text-slate-400">{cut.glass_types?.thickness_mm}mm {cut.glass_types?.color}</div>
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
                                <td className="px-4 py-3 text-right">
                                    {cut.status === 'pending' && (
                                        <button onClick={() => handleDelete(cut.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
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
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Vidrio</label>
                        <select
                            required
                            className="w-full px-3 py-2 border rounded-lg"
                            value={formData.glass_type_id}
                            onChange={e => setFormData({ ...formData, glass_type_id: e.target.value })}
                        >
                            {glassTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.code} - {t.thickness_mm}mm {t.color}</option>
                            ))}
                        </select>
                    </div>
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
