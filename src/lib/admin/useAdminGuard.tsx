'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAdminEmail } from './config';

interface AdminGuardState {
    isAdmin: boolean;
    loading: boolean;
    email: string | null;
}

/**
 * Hook to check if the current user has admin access.
 * Automatically redirects non-admins to the home page.
 * 
 * @param redirectOnFail - Whether to redirect non-admins (default: true)
 * @returns { isAdmin, loading, email }
 */
export function useAdminGuard(redirectOnFail = true): AdminGuardState {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [state, setState] = useState<AdminGuardState>({
        isAdmin: false,
        loading: true,
        email: null,
    });

    useEffect(() => {
        if (!isLoaded) return;

        const email = user?.primaryEmailAddress?.emailAddress ?? null;
        const isAdmin = isAdminEmail(email);

        setState({
            isAdmin,
            loading: false,
            email,
        });

        if (!isAdmin && redirectOnFail) {
            router.replace('/');
        }
    }, [isLoaded, user, redirectOnFail, router]);

    return state;
}

/**
 * Higher-order component to wrap admin-only pages.
 * Shows loading state while checking access, redirects non-admins.
 */
export function withAdminGuard<P extends object>(
    WrappedComponent: React.ComponentType<P>
): React.FC<P> {
    return function AdminGuardedComponent(props: P) {
        const { isAdmin, loading } = useAdminGuard();

        if (loading) {
            return (
                <div className= "flex min-h-screen items-center justify-center" >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                    </div>
      );
        }

        if (!isAdmin) {
            return null; // Will redirect
        }

        return <WrappedComponent { ...props } />;
    };
}
