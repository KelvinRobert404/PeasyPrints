'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, House } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { name: 'Home', href: '/', icon: House },
  { name: 'Orders', href: '/orders', icon: FileText },
];

export function BottomNavigation() {
  const pathname = usePathname();

  // Do not render on homepage
  if (pathname === '/') return null;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_12px)] z-50 mx-auto w-full max-w-[428px] px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-[20px] bg-ink p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'campus-press flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-[13px] font-extrabold transition-colors',
                isActive ? 'bg-cream text-ink' : 'text-white/55'
              )}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className="leading-none">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
