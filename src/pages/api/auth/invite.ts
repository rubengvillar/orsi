import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { email, full_name, role_id } = await request.json();

        // 1. Initialize Supabase Admin Client
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseServiceKey) {
            return new Response(JSON.stringify({
                message: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
            }), { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 2. Invite User
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { full_name }
        });

        if (inviteError) throw inviteError;

        const userId = inviteData.user.id;

        // 3. Assign Role
        if (role_id) {
            const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert({ user_id: userId, role_id });

            if (roleError) console.error("Error al asignar rol:", roleError);
        }

        // 4. Create Profile (Trigger usually does this, but we can ensure it)
        // Note: The handle_new_user trigger in db/update_profiles.sql 
        // will handle this when the user is created in Auth.

        return new Response(JSON.stringify({
            message: "Invitación enviada con éxito.",
            user: inviteData.user
        }), { status: 200 });

    } catch (error: any) {
        console.error("Invite Error:", error);
        return new Response(JSON.stringify({ message: error.message }), { status: 400 });
    }
}
