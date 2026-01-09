import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { user, userPermissions, userRole, hasPermission, isLoading, checkSession } from '../../stores/authStore';
import { PATH_PERMISSIONS } from '../../lib/permissions';

interface PageGuardProps {
    children: React.ReactNode;
    currentPath: string;
}

export default function PageGuard({ children, currentPath }: PageGuardProps) {
    const session = useStore(user);
    const perms = useStore(userPermissions);
    const role = useStore(userRole);
    const loading = useStore(isLoading);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    // Initialize auth on mount
    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        // Wait for auth to finish loading
        if (loading) {
            setIsAuthorized(null);
            return;
        }

        // If no session after loading, redirect to login
        if (!session) {
            window.location.href = '/login';
            return;
        }

        // Check permission for current path
        let requiredPermission = PATH_PERMISSIONS[currentPath];

        // If no exact match, try prefix match (for dynamic routes like /orders/[id])
        if (!requiredPermission) {
            const prefixPath = Object.keys(PATH_PERMISSIONS).find(path =>
                path.endsWith('/') && currentPath.startsWith(path)
            );
            if (prefixPath) {
                requiredPermission = PATH_PERMISSIONS[prefixPath];
            }
        }

        if (!requiredPermission) {
            // Path doesn't require specific permission, or it's not defined
            setIsAuthorized(true);
            return;
        }

        // Use hasPermission check (which includes Admin override)
        if (hasPermission(requiredPermission)) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            // Redirect to dashboard or show error
            window.location.href = '/dashboard?error=unauthorized';
        }
    }, [session, perms, role, loading, currentPath]);

    if (isAuthorized === null) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!isAuthorized) return null;

    return <>{children}</>;
}
