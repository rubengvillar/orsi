import React, { useState, useEffect } from "react";
import { Plus, Search, User, Trash2, Edit2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Operator {
    id: string;
    full_name: string;
    user_id: string | null;
    is_active: boolean;
    created_at: string;
}

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
}

export default function OperatorManager() {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [systemUsers, setSystemUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        user_id: "",
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [opsRes, usersRes] = await Promise.all([
                supabase.from("operators").select("*").order("full_name"),
                supabase.from("profiles").select("id, full_name, email").order("full_name")
            ]);

            if (opsRes.error) throw opsRes.error;
            if (usersRes.error) throw usersRes.error;

            setOperators(opsRes.data || []);
            setSystemUsers(usersRes.data || []);
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError("Error al cargar datos: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const data = {
            full_name: formData.full_name,
            user_id: formData.user_id || null,
            is_active: formData.is_active
        };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from("operators")
                    .update(data)
                    .eq("id", editingId);
                if (error) throw error;
                setSuccess("Operario actualizado con éxito");
            } else {
                const { error } = await supabase
                    .from("operators")
                    .insert([data]);
                if (error) throw error;
                setSuccess("Operario creado con éxito");
            }
            setIsModalOpen(false);
            resetForm();
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este operario?")) return;

        try {
            const { error } = await supabase.from("operators").delete().eq("id", id);
            if (error) throw error;
            setSuccess("Operario eliminado");
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const resetForm = () => {
        setFormData({ full_name: "", user_id: "", is_active: true });
        setEditingId(null);
        setError(null);
    };

    const openEditModal = (op: Operator) => {
        setFormData({
            full_name: op.full_name,
            user_id: op.user_id || "",
            is_active: op.is_active
        });
        setEditingId(op.id);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Operarios</h2>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors font-medium shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Operario
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{success}</p>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-900">Nombre Completo</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-900">Usuario Asociado</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-900">Estado</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Cargando operarios...</td>
                            </tr>
                        ) : operators.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No hay operarios registrados.</td>
                            </tr>
                        ) : (
                            operators.map((op) => (
                                <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{op.full_name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {op.user_id ? (
                                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                                                <User className="w-4 h-4" />
                                                {systemUsers.find(u => u.id === op.user_id)?.full_name || "Usuario Sistema"}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">Sin usuario</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${op.is_active
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-red-50 text-red-700 border-red-200"
                                            }`}>
                                            {op.is_active ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(op)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(op.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">
                            {editingId ? "Editar Operario" : "Nuevo Operario"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Vincular a Usuario del Sistema (Opcional)
                                </label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                >
                                    <option value="">No vincular</option>
                                    {systemUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.full_name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm text-slate-700 font-medium">
                                    Operario Activo
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                                >
                                    {editingId ? "Guardar Cambios" : "Crear Operario"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
