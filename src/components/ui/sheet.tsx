import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const SheetContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(null);

export function Sheet({
  children,
  open: controlledOpen,
  onOpenChange
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback((newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
  }, [onOpenChange, isControlled]);

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children, className }: { asChild?: boolean; children?: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SheetContext)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: (e: any) => {
        children.props.onClick?.(e);
        ctx.setOpen(true);
      },
      className: cn(className, children.props.className)
    });
  }
  return <button className={className} onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function SheetContent({ side = 'left', className, children }: { side?: 'left' | 'right' | 'top' | 'bottom'; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(SheetContext)!;
  if (!ctx.open) return null;
  return (
    <div className={cn('fixed inset-0 z-50 flex', className)}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-all duration-100 ease-in-out data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" onClick={() => ctx.setOpen(false)} />
      <div className={cn(
        'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out',
        side === 'left' ? 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm' : '',
        side === 'right' ? 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm' : '',
        className
      )}>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-foreground', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}


