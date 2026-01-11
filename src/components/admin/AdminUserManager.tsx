import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Users, UserPlus, Search, Shield, Mail, Trash2, MoreVertical, Edit2, Key, Phone, Ban, CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";

export default function AdminUserManager() {
    // List State
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'invite' | 'edit'>('invite');
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        full_name: "",
        role_id: "",
        phone: ""
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

                    if (insError) console.error("Error al restaurar perfil:", insError);
                }
            }

            // 1. Fetch Profiles
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (pError) throw pError;

            // 2. Fetch Assignments (user_id -> role info)
            const { data: assignments, error: aError } = await supabase
                .from('user_roles')
                .select(`
                    user_id,
                    roles ( id, name )
                `);

            if (aError) console.error("Error fetching user roles:", aError);

            // 3. Map roles to users
            const roleMap: Record<string, any[]> = {};
            assignments?.forEach(a => {
                if (!roleMap[a.user_id]) roleMap[a.user_id] = [];
                roleMap[a.user_id].push(a);
            });

            const enhancedUsers = profiles?.map(user => ({
                ...user,
                user_roles: roleMap[user.id] || [],
                // Helper to get primary role ID easily
                primary_role_id: roleMap[user.id]?.[0]?.roles?.id || ""
            })) || [];

            setUsers(enhancedUsers);

            // 4. Fetch All Roles for the dropdown
            const { data: rolesData } = await supabase
                .from('roles')
                .select('*')
                .order('name');

            if (rolesData) {
                setRoles(rolesData);
                if (rolesData.length > 0 && modalMode === 'invite') {
                    setFormData(prev => ({ ...prev, role_id: rolesData[0].id }));
                }
            }
        } catch (err: any) {
            console.error("Error fetching admin user data:", err);
            alert("Error al cargar datos: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenInvite = () => {
        setModalMode('invite');
        setFormData({ email: "", full_name: "", role_id: roles[0]?.id || "", phone: "" });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: any) => {
        setModalMode('edit');
        setSelectedUser(user);
        setFormData({
            email: user.email,
            full_name: user.full_name || "",
            role_id: user.primary_role_id || roles[0]?.id || "",
            phone: user.phone || ""
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (modalMode === 'invite') {
                const response = await fetch('/api/auth/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Error al invitar usuario");
                alert("¡Usuario invitado con éxito!");
            } else {
                // Edit Mode
                const response = await fetch('/api/auth/manage-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_profile',
                        userId: selectedUser.id,
                        full_name: formData.full_name,
                        phone: formData.phone,
                        role_id: formData.role_id
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Error al actualizar usuario");
                alert("Usuario actualizado correctamente.");
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (user: any) => {
        const newStatus = !user.is_active;
        const confirmMsg = newStatus
            ? `¿Reactivar acceso para ${user.full_name}?`
            : `¿Desactivar a ${user.full_name}? Esto cerrará todas sus sesiones activas.`;

        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const response = await fetch('/api/auth/manage-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_access',
                    userId: user.id,
                    active: newStatus
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            // Refetch to see changes
            fetchData();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
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
                    onClick={handleOpenInvite}
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
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Registrado el</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && users.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-500">Cargando usuarios...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-400 italic">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${!user.is_active ? 'bg-slate-50/80 grayscale-[0.5]' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden relative">
                                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || "?"}
                                                {/* Status Indicator overlapping avatar */}
                                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${user.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{user.full_name || "Sin nombre"}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{user.email}</span>
                                                    {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</span>}
                                                </div>
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
                                    <td className="px-6 py-4">
                                        {user.is_active !== false ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                <Ban className="w-3 h-3" />
                                                Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                title="Editar Datos y Rol"
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>

                                            <button
                                                onClick={() => handleToggleStatus(user)}
                                                title={user.is_active !== false ? "Desactivar Usuario" : "Activar Usuario"}
                                                className={`p-2 rounded-lg transition-colors ${user.is_active !== false
                                                        ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                        : 'text-red-500 bg-red-50 hover:bg-green-50 hover:text-green-600'
                                                    }`}
                                            >
                                                {user.is_active !== false ? <Ban className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                            </button>

                                            <button
                                                onClick={() => handleResetPassword(user.email)}
                                                title="Restablecer Contraseña"
                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Key className="w-5 h-5" />
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
                title={modalMode === 'invite' ? "Invitar Nuevo Usuario" : "Editar Usuario"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
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
                            disabled={modalMode === 'edit'}
                            className={`w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all ${modalMode === 'edit' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="usuario@ejemplo.com"
                        />
                        {modalMode === 'edit' && <p className="text-[10px] text-slate-400 mt-1">El correo no se puede editar.</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
                        <input
                            type="tel"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+54 9 11 ..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Rol de Usuario</label>
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
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">
                            {loading ? "Guardando..." : (modalMode === 'invite' ? "Enviar Invitación" : "Guardar Cambios")}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
