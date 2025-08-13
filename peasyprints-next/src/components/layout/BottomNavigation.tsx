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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[428px] bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-2 h-16">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center text-xs font-medium transition-colors min-h-[64px]',
                isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Icon className={cn('w-6 h-6 mb-1', isActive && 'text-blue-600')} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
