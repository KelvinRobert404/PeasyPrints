import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children?: React.ReactNode; className?: string }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className={className} data-tabs>
      {React.Children.map(children, (child: any) => {
        if (!child) return child;
        return React.cloneElement(child, { activeValue: value, setValue });
      })}
    </div>
  );
}

export function TabsList({ children, className, activeValue, setValue, variant = 'pills' }: any) {
  // variant: 'pills' | 'underline'
  const base = variant === 'underline' ? 'flex gap-6 border-b border-gray-200 text-sm' : 'inline-grid rounded-md bg-gray-100 p-1 text-sm';
  return <div className={cn(base, className)} role="tablist">{React.Children.map(children, (child: any) => React.cloneElement(child, { activeValue, setValue, variant }))}</div>;
}

export function TabsTrigger({ value: v, children, activeValue, setValue, variant = 'pills' }: any) {
  const active = activeValue === v;
  if (variant === 'underline') {
    return (
      <button
        onClick={() => setValue(v)}
        className={cn(
          'relative -mb-px px-1 py-2 text-gray-600 hover:text-gray-900',
          active ? 'text-gray-900 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[2px] after:bg-blue-600' : 'opacity-80'
        )}
        role="tab"
        aria-selected={active}
      >
        {children}
      </button>
    );
  }
  return <button onClick={() => setValue(v)} className={cn('px-3 py-1 rounded-md', active ? 'bg-white shadow' : 'opacity-70 hover:opacity-100')} role="tab" aria-selected={active}>{children}</button>;
}

export function TabsContent({ value: v, children, activeValue }: any) {
  if (activeValue !== v) return null;
  return <div className="mt-4">{children}</div>;
}


