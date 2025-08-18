import * as React from 'react';
import { FormProvider, useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

export function Form({ children, ...props }: React.ComponentProps<typeof FormProvider>) {
  return <FormProvider {...props}>{children}</FormProvider>;
}

export function FormField({ name, render }: { name: string; render: (ctx: any) => React.ReactNode }) {
  const methods = useFormContext();
  return <Controller name={name as any} control={methods.control} render={render as any} />;
}

export function FormItem({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('space-y-1', className)}>{children}</div>;
}
export function FormLabel({ children }: { children?: React.ReactNode }) { return <label className="text-sm">{children}</label>; }
export function FormControl({ children }: { children?: React.ReactNode }) { return <div>{children}</div>; }
export function FormMessage({ children }: { children?: React.ReactNode }) { return <p className="text-xs text-red-600">{children}</p>; }


