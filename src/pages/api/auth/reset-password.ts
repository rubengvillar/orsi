import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { email } = await request.json();

        if (!email) {
            return new Response(JSON.stringify({ message: "Email es requerido" }), { status: 400 });
        }

        // 1. Initialize Supabase Admin Client
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return new Response(JSON.stringify({
                message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor."
            }), { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 2. Trigger Password Reset Email
        // Note: Using resetPasswordForEmail sends the standard Supabase recovery email
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${new URL(request.url).origin}/auth/reset-password`
        });

        if (error) throw error;

        return new Response(JSON.stringify({
            message: "Enlace de restablecimiento enviado con éxito al correo del usuario."
        }), { status: 200 });

    } catch (error: any) {
        console.error("Reset Password Error:", error);
        return new Response(JSON.stringify({ message: error.message }), { status: 400 });
    }
}
