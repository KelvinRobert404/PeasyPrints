'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { name: 'Home', href: '/', icon: Store },
  { name: 'Orders', href: '/orders', icon: FileText },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_2px)] left-1/2 -translate-x-1/2 z-50">
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 backdrop-blur px-4 py-2 shadow-lg">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'inline-flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-gray-900'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-blue-700')} />
              <span className="leading-none">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
