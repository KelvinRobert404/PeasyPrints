import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Table({ children, className }: { children?: React.ReactNode, className?: string }) { 
  return <table className={cn("w-full text-sm", className)}>{children}</table>; 
}

export function TableHeader({ children, className }: { children?: React.ReactNode, className?: string }) { 
  return <thead className={cn("text-left text-gray-500", className)}>{children}</thead>; 
}

export function TableBody({ children, className }: { children?: React.ReactNode, className?: string }) { 
  return <tbody className={cn("divide-y divide-gray-200", className)}>{children}</tbody>; 
}

export function TableRow({ children, className }: { children?: React.ReactNode, className?: string }) { 
  return <tr className={cn("hover:bg-gray-50", className)}>{children}</tr>; 
}

export function TableHead({ children, className }: { children?: React.ReactNode, className?: string }) { 
  return <th className={cn("px-3 py-2 font-medium", className)}>{children}</th>; 
}

export function TableCell({ children, className, ...props }: React.ComponentPropsWithoutRef<'td'>) { 
  return <td className={cn("px-3 py-2", className)} {...props}>{children}</td>; 
}


