import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";

export default function UserMenu() {
    const [profile, setProfile] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(data || { email: user.email });
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    if (!profile) return <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>;

    const initials = (profile.full_name || profile.email || "U")
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg transition-colors group"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                        {profile.full_name || "Usuario"}
                    </p>
                    <p className="text-xs text-slate-500">
                        {profile.email}
                    </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm group-hover:shadow transition-all relative overflow-hidden">
                    {initials}
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in slide-in-from-top-2">
                        <a
                            href="/profile"
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <User className="w-4 h-4" /> Mi Perfil
                        </a>
                        <hr className="my-2 border-slate-100" />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                        >
                            <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
