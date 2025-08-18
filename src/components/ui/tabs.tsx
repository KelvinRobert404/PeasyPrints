import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Tabs({ defaultValue, children, className }: { defaultValue: string; children?: React.ReactNode; className?: string }) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <div className={className} data-tabs>
      {React.Children.map(children, (child: any) => {
        if (!child) return child;
        return React.cloneElement(child, { value, setValue });
      })}
    </div>
  );
}

export function TabsList({ children, className, value, setValue }: any) {
  return <div className={cn('inline-grid rounded-md bg-gray-100 p-1 text-sm', className)}>{React.Children.map(children, (child: any) => React.cloneElement(child, { value, setValue }))}</div>;
}

export function TabsTrigger({ value: v, children, value, setValue }: any) {
  const active = value === v;
  return (
    <button onClick={() => setValue(v)} className={cn('px-3 py-1 rounded-md', active ? 'bg-white shadow' : 'opacity-70 hover:opacity-100')}>{children}</button>
  );
}

export function TabsContent({ value: v, children, value }: any) {
  if (value !== v) return null;
  return <div className="mt-4">{children}</div>;
}


