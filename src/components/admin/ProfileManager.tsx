import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { User, Mail, Calendar, Save, AlertCircle, Lock, ShieldCheck } from "lucide-react";

export default function ProfileManager() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Password State
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: ""
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(data || { id: user.id, email: user.email, full_name: "" });
        }
        setLoading(false);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('profiles')
            .update({ full_name: profile.full_name })
            .eq('id', profile.id);

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({ type: 'success', text: "¡Perfil actualizado correctamente!" });
        }
        setSaving(false);
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: "Las contraseñas no coinciden." });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: "La contraseña debe tener al menos 6 caracteres." });
            return;
        }

        setUpdatingPassword(true);
        const { error } = await supabase.auth.updateUser({
            password: passwordData.newPassword
        });

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({ type: 'success', text: "¡Contraseña actualizada con éxito!" });
            setPasswordData({ newPassword: "", confirmPassword: "" });
        }
        setUpdatingPassword(false);
    };

    if (loading) return <div className="text-center py-12 text-slate-500">Cargando perfil...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Profile Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
                <div className="px-8 pb-8">
                    <div className="relative -mt-12 flex items-end gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg">
                            <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <User className="w-12 h-12" />
                            </div>
                        </div>
                        <div className="pb-2">
                            <h2 className="text-2xl font-bold text-slate-800">{profile.full_name || "Usuario"}</h2>
                            <p className="text-slate-500 font-medium">{profile.email}</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdate} className="mt-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" /> Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                    value={profile.full_name || ""}
                                    onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                    placeholder="Tu nombre completo"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                                    <Mail className="w-4 h-4" /> Email (Solo lectura)
                                </label>
                                <input
                                    type="email"
                                    disabled
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 cursor-not-allowed text-sm"
                                    value={profile.email || ""}
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                Cuenta creada: {new Date(profile.created_at).toLocaleDateString()}
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Password Change Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg font-bold">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Seguridad</h3>
                        <p className="text-xs text-slate-500">Actualiza tu contraseña periódicamente para mantener tu cuenta segura.</p>
                    </div>
                </div>

                <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Nueva Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm"
                                value={passwordData.newPassword}
                                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Confirmar Contraseña</label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                            <input
                                type="password"
                                required
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm"
                                value={passwordData.confirmPassword}
                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={updatingPassword}
                            className="bg-slate-800 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-slate-900 disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                            {updatingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                        </button>
                    </div>
                </form>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-bold">{message.text}</p>
                </div>
            )}
        </div>
    );
}
