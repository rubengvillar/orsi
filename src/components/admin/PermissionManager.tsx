import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Permission } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Key, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';

export default function PermissionManager() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [formData, setFormData] = useState({ code: '', description: '' });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data } = await supabase.from('permissions').select('*').order('code');
        if (data) setPermissions(data);
        setLoading(false);
    }

    function handleOpenModal(permission?: Permission) {
        if (permission) {
            setEditingPermission(permission);
            setFormData({ code: permission.code, description: permission.description || '' });
        } else {
            setEditingPermission(null);
            setFormData({ code: '', description: '' });
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingPermission) {
                // Update
                const { error } = await supabase
                    .from('permissions')
                    .update({ code: formData.code, description: formData.description })
                    .eq('id', editingPermission.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('permissions')
                    .insert({ code: formData.code, description: formData.description });
                if (error) throw error;
            }

            await fetchData();
            setIsModalOpen(false);
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este permiso? Esto podría afectar a los roles que lo utilizan.')) return;

        try {
            const { error } = await supabase.from('permissions').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        }
    }

    if (loading && permissions.length === 0) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">Permisos del Sistema</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Crear Permiso
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {permissions.map(perm => (
                    <div key={perm.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <Key className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(perm)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(perm.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-lg text-slate-800 font-mono">{perm.code}</h3>
                        <p className="text-slate-500 text-sm mt-1">{perm.description || 'Sin descripción'}</p>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPermission ? 'Editar Permiso' : 'Nuevo Permiso'}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-700 text-sm">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>
                            Los permisos definen qué acciones pueden realizar los usuarios.
                            El código debe ser único (ej: <code>inventory.write</code>).
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código del Permiso</label>
                        <input
                            type="text"
                            required
                            placeholder="ej: module.action"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
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
                            {loading ? 'Guardando...' : 'Guardar Permiso'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
