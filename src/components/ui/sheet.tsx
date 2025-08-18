import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const SheetContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(null);

export function Sheet({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children }: { asChild?: boolean; children?: React.ReactNode }) {
  const ctx = React.useContext(SheetContext)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, { onClick: () => ctx.setOpen(true) });
  }
  return <button onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function SheetContent({ side = 'left', className, children }: { side?: 'left'|'right'|'top'|'bottom'; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(SheetContext)!;
  if (!ctx.open) return null;
  return (
    <div className={cn('fixed inset-0 z-50', className)}>
      <div className="absolute inset-0 bg-black/40" onClick={() => ctx.setOpen(false)} />
      <div className={cn('absolute inset-y-0 w-64 bg-white shadow-lg', side === 'left' ? 'left-0' : 'right-0')}>
        {children}
      </div>
    </div>
  );
}


