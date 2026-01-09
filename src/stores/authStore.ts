import { atom } from 'nanostores';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export const user = atom<User | null>(null);
export const userRole = atom<string | null>(null);
export const userPermissions = atom<string[]>([]);
export const isLoading = atom<boolean>(true);

export async function checkSession() {
    isLoading.set(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
        user.set(session.user);
        await fetchUserRole(session.user.id);
    } else {
        user.set(null);
        userRole.set(null);
        userPermissions.set([]);
    }
    isLoading.set(false);
}

// Fetch role and permissions from our custom tables
async function fetchUserRole(userId: string) {
    try {
        // 1. Get Role ID
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role_id, roles(name)')
            .eq('user_id', userId)
            .single();

        if (roleError || !roleData) {
            console.error('Error fetching role:', roleError);
            return;
        }

        const startRole = roleData.roles;
        if (Array.isArray(startRole)) return; // Should be object due to single()
        // Type assertion or check might be needed depending on generation
        // For now assuming it returns object { name: ... }

        // @ts-ignore
        const roleName = startRole?.name;
        userRole.set(roleName);

        // 2. Get Permissions
        const { data: permData, error: permError } = await supabase
            .from('role_permissions')
            .select('permissions(code)')
            .eq('role_id', roleData.role_id);

        if (permError) {
            console.error('Error fetching permissions:', permError);
            return;
        }

        const perms = permData.map((p: any) => p.permissions.code);
        userPermissions.set(perms);

    } catch (error) {
        console.error('Auth load error:', error);
    }
}

/**
 * Checks if the current user has a specific permission.
 * Works both with individual permissions and admin override (if applicable).
 */
export function hasPermission(permissionCode: string): boolean {
    const perms = userPermissions.get();
    const role = userRole.get();

    // Admin always has all permissions
    if (role === 'Admin' || role === 'Administrador') return true;

    return perms.includes(permissionCode);
}

// Subscribe to auth changes
supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
        user.set(session.user);
        // Optimization: Don't re-fetch if we already have it? 
        // Ideally we re-fetch to be safe on login
        if (user.get()?.id !== session.user.id) {
            fetchUserRole(session.user.id);
        }
    } else {
        user.set(null);
        userRole.set(null);
        userPermissions.set([]);
    }
});
