import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Users, UserPlus, Search, Shield, Mail, Trash2, MoreVertical, Edit2, Key } from "lucide-react";
import { Modal } from "../ui/Modal";

export default function AdminUserManager() {
    // List State
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        full_name: "",
        role_id: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 0. Ensure current user has a profile (Self-healing for legacy accounts)
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', authUser.id)
                    .single();

                if (!existingProfile) {
                    console.log("Restaurando perfil faltante para el usuario actual...");
                    const { error: insError } = await supabase.from('profiles').insert({
                        id: authUser.id,
                        email: authUser.email,
                        full_name: authUser.user_metadata?.full_name || "Administrador"
                    });

                    if (insError) {
                        console.error("Error al restaurar perfil:", insError);
                    } else {
                        console.log("Perfil restaurado con éxito.");
                    }
                }
            }

            // 1. Fetch Profiles
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (pError) throw pError;
            console.log(`Fetched ${profiles?.length} profiles`);

            // 2. Fetch Assignments (user_id -> role info)
            const { data: assignments, error: aError } = await supabase
                .from('user_roles')
                .select(`
                    user_id,
                    roles ( id, name )
                `);

            if (aError) {
                console.error("Error fetching user roles:", aError);
            }

            // 3. Map roles to users
            const roleMap: Record<string, any[]> = {};
            assignments?.forEach(a => {
                if (!roleMap[a.user_id]) roleMap[a.user_id] = [];
                roleMap[a.user_id].push(a);
            });

            const enhancedUsers = profiles?.map(user => ({
                ...user,
                user_roles: roleMap[user.id] || []
            })) || [];

            setUsers(enhancedUsers);

            // 4. Fetch All Roles for the dropdown
            const { data: rolesData } = await supabase
                .from('roles')
                .select('*')
                .order('name');

            if (rolesData) {
                setRoles(rolesData);
                if (rolesData.length > 0) setFormData(prev => ({ ...prev, role_id: rolesData[0].id }));
            }
        } catch (err: any) {
            console.error("Error fetching admin user data:", err);
            alert("Error al cargar datos: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Note: In a real production app, we would call a backend API here
            // to use the Supabase Service Role Key and invite the user via Auth.
            // For now, we'll explain to the user they need to run this on their backend.

            // SIMULATED Invitation logic (requires service role key usually)
            // If we don't have a backend route, this is just a UI placeholder.

            const response = await fetch('/api/auth/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message || "Error al invitar usuario");

            alert("¡Usuario invitado con éxito! Se envió un correo para configurar la contraseña.");
            setIsModalOpen(false);
            setFormData({ email: "", full_name: "", role_id: roles[0]?.id || "" });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este usuario? Esto no borrará su cuenta de Auth (debe hacerse desde Supabase)")) return;
        await supabase.from('profiles').delete().eq('id', id);
        fetchData();
    };

    const handleResetPassword = async (email: string) => {
        if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) return;
        setLoading(true);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert(result.message);
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Total Usuarios</p>
                        <p className="text-2xl font-bold text-slate-800">{users.length}</p>
                        {searchTerm && (
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">
                                {filteredUsers.length} encontrados
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* List Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                >
                    <UserPlus className="w-5 h-5" /> Invitar Usuario
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Rol / Acceso</th>
                                <th className="px-6 py-4">Registrado el</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && users.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-12 text-slate-500">Cargando usuarios...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-12 text-slate-400 italic">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{user.full_name || "Sin nombre"}</p>
                                                <p className="text-xs text-slate-500">{user.email || "Sin email"}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {user.user_roles?.map((ur: any) => (
                                                <span key={ur.roles?.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] uppercase font-bold border border-blue-100">
                                                    {ur.roles?.name}
                                                </span>
                                            ))}
                                            {(!user.user_roles || user.user_roles.length === 0) && (
                                                <span className="text-xs text-slate-400">Sin rol asignado</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleResetPassword(user.email)}
                                                title="Restablecer Contraseña"
                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Key className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                title="Eliminar Perfil"
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Invitar Nuevo Usuario">
                <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="Ej: Juan Pérez"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="usuario@ejemplo.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Asignar Rol Inicial</label>
                        <select
                            required
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={formData.role_id}
                            onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                        >
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-2 px-1">
                            El usuario recibirá un correo para configurar su contraseña y activar su cuenta.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">
                            {loading ? "Enviando..." : "Enviar Invitación"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
