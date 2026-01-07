import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Role, Permission, RolePermission } from '../../types/database';
import { Modal } from '../ui/Modal';
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react';

export default function RoleManager() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data: rolesData } = await supabase.from('roles').select('*').order('name');
        const { data: permsData } = await supabase.from('permissions').select('*').order('code');

        if (rolesData) setRoles(rolesData);
        if (permsData) setPermissions(permsData);
        setLoading(false);
    }

    async function handleOpenModal(role?: Role) {
        if (role) {
            setEditingRole(role);
            setFormData({ name: role.name, description: role.description || '' });
            // Fetch permissions for this role
            const { data } = await supabase.from('role_permissions').select('permission_id').eq('role_id', role.id);
            if (data) {
                setSelectedPerms(new Set(data.map(p => p.permission_id)));
            }
        } else {
            setEditingRole(null);
            setFormData({ name: '', description: '' });
            setSelectedPerms(new Set());
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            let roleId = editingRole?.id;

            if (editingRole) {
                // Update Role
                const { error } = await supabase
                    .from('roles')
                    .update({ name: formData.name, description: formData.description })
                    .eq('id', roleId);
                if (error) throw error;
            } else {
                // Create Role
                const { data, error } = await supabase
                    .from('roles')
                    .insert({ name: formData.name, description: formData.description })
                    .select()
                    .single();
                if (error) throw error;
                roleId = data.id;
            }

            // Update Permissions (Delete all and re-insert is easiest for MVP)
            if (roleId) {
                await supabase.from('role_permissions').delete().eq('role_id', roleId);

                const newPerms = Array.from(selectedPerms).map(permId => ({
                    role_id: roleId!,
                    permission_id: permId
                }));

                if (newPerms.length > 0) {
                    const { error: permError } = await supabase.from('role_permissions').insert(newPerms);
                    if (permError) throw permError;
                }
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
        if (!confirm('¿Estás seguro de eliminar este rol?')) return;
        await supabase.from('roles').delete().eq('id', id);
        fetchData();
    }

    const togglePerm = (id: string) => {
        const newSet = new Set(selectedPerms);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPerms(newSet);
    };

    if (loading && roles.length === 0) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">Roles del Sistema</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Crear Rol
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => (
                    <div key={role.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(role.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-lg text-slate-800">{role.name}</h3>
                        <p className="text-slate-500 text-sm mt-1">{role.description || 'Sin descripción'}</p>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingRole ? 'Editar Rol' : 'Nuevo Rol'}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Rol</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">Permisos</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                            {permissions.map(perm => (
                                <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-md cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedPerms.has(perm.id)}
                                        onChange={() => togglePerm(perm.id)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                    <div>
                                        <div className="font-medium text-sm text-slate-900">{perm.code}</div>
                                        <div className="text-xs text-slate-500">{perm.description}</div>
                                    </div>
                                </label>
                            ))}
                            {permissions.length === 0 && <div className="text-sm text-slate-400 text-center py-2">No hay permisos definidos</div>}
                        </div>
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
                            {loading ? 'Guardando...' : 'Guardar Rol'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
