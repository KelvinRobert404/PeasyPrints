"use client";
import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
