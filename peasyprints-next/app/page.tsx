'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IndexPage() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/dashboard');
    }, 500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-gray-500">Loading...</div>
    </div>
  );
}
