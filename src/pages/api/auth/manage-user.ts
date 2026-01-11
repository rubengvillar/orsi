
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, userId } = body;

        if (!userId) {
            return new Response(JSON.stringify({ message: "userId es requerido" }), { status: 400 });
        }

        // Initialize Supabase Admin Client
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return new Response(JSON.stringify({
                message: "Error de configuración: Falta SUPABASE_SERVICE_ROLE_KEY."
            }), { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        if (action === 'toggle_access') {
            const { active } = body;

            // 1. Update Auth Status (Ban/Unban)
            const banDuration = active ? 'none' : '876000h'; // ~100 years or 'none' to unban
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: banDuration
            });

            if (authError) throw authError;

            // 2. If deactivating, force sign out
            if (!active) {
                await supabaseAdmin.auth.admin.signOut(userId);
            }

            // 3. Update Profile Status
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ is_active: active })
                .eq('id', userId);

            if (profileError) throw profileError;

            return new Response(JSON.stringify({
                message: active ? "Usuario activado correctamente." : "Usuario desactivado y sesión cerrada."
            }), { status: 200 });

        } else if (action === 'update_profile') {
            const { full_name, phone, role_id } = body;

            // 1. Update Profile Data
            const updates: any = {};
            if (full_name !== undefined) updates.full_name = full_name;
            if (phone !== undefined) updates.phone = phone;

            if (Object.keys(updates).length > 0) {
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update(updates)
                    .eq('id', userId);

                if (profileError) throw profileError;

                // Sync full_name to Auth Metadata
                if (full_name) {
                    await supabaseAdmin.auth.admin.updateUserById(userId, {
                        user_metadata: { full_name }
                    });
                }
            }

            // 2. Update Role (if provided)
            if (role_id) {
                // Remove existing roles
                const { error: deleteError } = await supabaseAdmin
                    .from('user_roles')
                    .delete()
                    .eq('user_id', userId);

                if (deleteError) throw deleteError;

                // Insert new role
                const { error: insertError } = await supabaseAdmin
                    .from('user_roles')
                    .insert({ user_id: userId, role_id });

                if (insertError) throw insertError;
            }

            return new Response(JSON.stringify({ message: "Datos actualizados correctamente." }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: "Acción no válida" }), { status: 400 });

    } catch (error: any) {
        console.error("Manage User Error:", error);
        return new Response(JSON.stringify({ message: error.message || "Error interno del servidor" }), { status: 500 });
    }
}
