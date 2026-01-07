import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Users, User as UserIcon, Shield, Edit2 } from 'lucide-react';

interface Profile {
    id: string;
    email: string;
    full_name: string | null;
}

interface Role {
    id: string;
    name: string;
}

export default function UserManager() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [userRoles, setUserRoles] = useState<Record<string, string>>({}); // userId -> roleName
    const [loading, setLoading] = useState(true);

    // Modal State
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        // Fetch profiles
        const { data: profiles } = await supabase.from('profiles').select('*');
        if (profiles) setUsers(profiles);

        // Fetch roles
        const { data: rolesData } = await supabase.from('roles').select('id, name');
        if (rolesData) setRoles(rolesData);

        // Fetch current assignments
        const { data: assignments } = await supabase
            .from('user_roles')
            .select('user_id, roles(name)');

        if (assignments) {
            const mapping: Record<string, string> = {};
            assignments.forEach((a: any) => {
                mapping[a.user_id] = a.roles?.name || 'Unknown';
            });
            setUserRoles(mapping);
        }
        setLoading(false);
    }

    function handleEdit(user: Profile) {
        setSelectedUser(user);
        // Find current role id? A bit tricky with just name map, but manageable.
        // Ideally we fetched role_id in user_roles map too.
        setSelectedRoleId(''); // Reset for now
        setIsModalOpen(true);
    }

    async function handleSave() {
        if (!selectedUser || !selectedRoleId) return;

        // 1. Remove existing role
        await supabase.from('user_roles').delete().eq('user_id', selectedUser.id);

        // 2. Insert new role
        const { error } = await supabase.from('user_roles').insert({
            user_id: selectedUser.id,
            role_id: selectedRoleId
        });

        if (error) {
            alert('Error updating role: ' + error.message);
        } else {
            await fetchData(); // Refresh
            setIsModalOpen(false);
        }
    }

    if (loading && users.length === 0) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Usuarios Registrados
                </h2>
                {/* Potentially Add Invite User button here */}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3">Usuario</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Rol Actual</th>
                            <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                            <UserIcon className="w-4 h-4" />
                                        </div>
                                        {user.full_name || 'Sin Nombre'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{user.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                    ${userRoles[user.id] ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {userRoles[user.id] || 'Sin Rol'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Asignar Rol
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No hay usuarios registrados</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Asignar Rol a ${selectedUser?.email}`}
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Rol</label>
                        <div className="space-y-2">
                            {roles.map(role => (
                                <label key={role.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                  ${selectedRoleId === role.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="role"
                                            value={role.id}
                                            checked={selectedRoleId === role.id}
                                            onChange={(e) => setSelectedRoleId(e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-slate-900">{role.name}</span>
                                    </div>
                                    <Shield className={`w-4 h-4 ${selectedRoleId === role.id ? 'text-blue-600' : 'text-slate-300'}`} />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
