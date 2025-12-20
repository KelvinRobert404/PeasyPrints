/**
 * Admin Access Control Configuration
 * 
 * This file contains the whitelist of email addresses that have admin access
 * to the Godview dashboard. Add or remove emails as needed.
 */

export const ADMIN_EMAILS: string[] = [
    // Add admin emails here - these users will have access to /godview
    'kelvinrobert091@gmail.com',
    'siyonmaster008@gmail.com',
];

/**
 * Check if an email address has admin access
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
}
