import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { List, Plus, Trash2, Edit2, Check, X, Move } from "lucide-react";
import { Modal } from "../ui/Modal";

interface OrderStatus {
    id: string;
    name: string;
    label: string;
    description?: string;
    color: string;
    is_active: boolean;
    sort_order: number;
}

const COLORS = [
    { value: 'gray', label: 'Gris' },
    { value: 'blue', label: 'Azul' },
    { value: 'indigo', label: 'Índigo' },
    { value: 'green', label: 'Verde' },
    { value: 'red', label: 'Rojo' },
    { value: 'yellow', label: 'Amarillo' },
    { value: 'orange', label: 'Naranja' },
    { value: 'teal', label: 'Verde Azulado' },
    { value: 'purple', label: 'Morado' },
    { value: 'pink', label: 'Rosa' },
];

export default function OrderStatusManager() {
    const [statuses, setStatuses] = useState<OrderStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<OrderStatus | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<OrderStatus>>({
        name: "",
        label: "",
        description: "",
        color: "gray",
        is_active: true,
        sort_order: 0
    });

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('order_statuses')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            setStatuses(data || []);
        } catch (err: any) {
            console.error("Error fetching order statuses:", err);
            alert("Error al cargar estados: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (status: OrderStatus) => {
        setEditingStatus(status);
        setFormData({
            name: status.name,
            label: status.label,
            description: status.description || "",
            color: status.color,
            is_active: status.is_active,
            sort_order: status.sort_order
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingStatus(null);
        // Find max sort order to append to the end by default
        const maxSort = statuses.length > 0 ? Math.max(...statuses.map(s => s.sort_order)) : 0;
        setFormData({
            name: "",
            label: "",
            description: "",
            color: "gray",
            is_active: true,
            sort_order: maxSort + 10
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el estado "${name}"? Si hay órdenes usándolo, esto fallará.`)) return;

        try {
            const { error } = await supabase
                .from('order_statuses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchStatuses();
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingStatus) {
                // Update
                const { error } = await supabase
                    .from('order_statuses')
                    .update(formData)
                    .eq('id', editingStatus.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('order_statuses')
                    .insert([formData]);

                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchStatuses();
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getColorClass = (color: string) => {
        // Simple mapping for Tailwind classes based on the stored color string
        // Assuming we use standard tailwind colors in the DB or the dropdown
        // This is a basic implementation, can be enhanced with a proper map
        const map: Record<string, string> = {
            gray: 'bg-gray-100 text-gray-800 border-gray-200',
            blue: 'bg-blue-100 text-blue-800 border-blue-200',
            indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            green: 'bg-green-100 text-green-800 border-green-200',
            red: 'bg-red-100 text-red-800 border-red-200',
            yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            orange: 'bg-orange-100 text-orange-800 border-orange-200',
            teal: 'bg-teal-100 text-teal-800 border-teal-200',
            purple: 'bg-purple-100 text-purple-800 border-purple-200',
            pink: 'bg-pink-100 text-pink-800 border-pink-200',
        };
        return map[color] || map['gray'];
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Estados de Orden</h2>
                    <p className="text-slate-500">Administra los estados posibles para las órdenes.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Nuevo Estado
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-16">Orden</th>
                                <th className="px-6 py-4">Etiqueta (Label)</th>
                                <th className="px-6 py-4">Clave (Internal Name)</th>
                                <th className="px-6 py-4">Color</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && statuses.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-500">Cargando estados...</td></tr>
                            ) : statuses.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400 italic">No hay estados configurados.</td></tr>
                            ) : statuses.map(status => (
                                <tr key={status.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-400">{status.sort_order}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">{status.label}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 bg-slate-100 rounded px-2 py-1 w-fit">
                                        {status.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getColorClass(status.color)}`}>
                                            {status.color}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {status.is_active ? (
                                            <span className="flex items-center gap-1 text-green-600 font-medium text-xs">
                                                <Check className="w-3 h-3" /> Activo
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                                                <X className="w-3 h-3" /> Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(status)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(status.id, status.name)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingStatus ? "Editar Estado" : "Crear Nuevo Estado"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Etiqueta Visible <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="Ej: En Proceso"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Clave Interna (ID) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                disabled={!!editingStatus} // Prevent changing ID of existing status to avoid breaking constraints
                                className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all ${editingStatus ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: In Progress"
                            />
                            {editingStatus && <p className="text-[10px] text-slate-400 mt-1">La clave interna no se puede cambiar una vez creada.</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                        <textarea
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            placeholder="Descripción opcional..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Color</label>
                            <select
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                            >
                                {COLORS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Orden de Clasificación</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={formData.sort_order}
                                onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            checked={formData.is_active}
                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                            Estado Activo (Visible en selectores)
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">
                            {loading ? "Guardando..." : "Guardar Estado"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
