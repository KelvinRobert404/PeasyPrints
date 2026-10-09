import 'server-only';

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

/**
 * Check if an email address has admin access
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

type ClerkUserEmails = {
    primaryEmailAddressId: string | null;
    emailAddresses: Array<{ id: string; emailAddress: string; verification: { status: string } | null }>;
};

/**
 * The user's primary email, only when Clerk has verified ownership of it.
 * Admin access must never be granted on an address the user merely typed in.
 */
export function verifiedPrimaryEmail(user: ClerkUserEmails | null | undefined): string | null {
    const primary = user?.emailAddresses.find((item) => item.id === user.primaryEmailAddressId);
    return primary?.verification?.status === 'verified' ? primary.emailAddress : null;
}

export function isAdminUser(user: ClerkUserEmails | null | undefined): boolean {
    return isAdminEmail(verifiedPrimaryEmail(user));
}
