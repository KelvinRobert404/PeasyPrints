import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Avatar({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100', className)}>{children}</div>;
}
export function AvatarImage({ src, alt }: { src?: string; alt?: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}
export function AvatarFallback({ children }: { children?: React.ReactNode }) {
  return <div className="text-gray-500">{children}</div>;
}


