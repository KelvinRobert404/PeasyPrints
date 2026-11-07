import { redirect } from 'next/navigation';
import { safeRedirectPath } from '@/lib/utils/safeRedirect';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Sign-up and sign-in are one flow now: send /register to /login, keeping redirect_url. */
export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).redirect_url;
  const target = Array.isArray(raw) ? raw[0] : raw;
  redirect(target ? `/login?redirect_url=${encodeURIComponent(safeRedirectPath(target))}` : '/login');
}
