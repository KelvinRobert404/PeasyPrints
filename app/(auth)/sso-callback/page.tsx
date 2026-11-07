import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { SwoopLogo } from '@/components/swoop/Logo';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Google comes back here. Clerk finishes the OAuth handshake and sends the student to the
 * redirectUrlComplete set in useCollegeSignIn (/campus/verify?next=...). The fallbacks cover
 * a missing destination; an unfinished sign-up goes back to /login.
 */
export default async function SsoCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeRedirectPath(first(params.next) ?? first(params.redirect_url));
  const done = `/campus/verify?next=${encodeURIComponent(next)}`;

  return (
    <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-5">
      <SwoopLogo size={28} className="animate-pulse" />
      <p className="text-[12.5px] font-semibold text-slate">Signing you in…</p>
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/login"
        continueSignUpUrl="/login"
        signInFallbackRedirectUrl={done}
        signUpFallbackRedirectUrl={done}
      />
      {/* Clerk mounts its bot check here when Google creates a new account. */}
      <div id="clerk-captcha" />
    </div>
  );
}
