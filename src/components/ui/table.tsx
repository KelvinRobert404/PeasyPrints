import * as React from 'react';

export function Table({ children }: { children?: React.ReactNode }) { return <table className="w-full text-sm">{children}</table>; }
export function TableHeader({ children }: { children?: React.ReactNode }) { return <thead className="text-left text-gray-500">{children}</thead>; }
export function TableBody({ children }: { children?: React.ReactNode }) { return <tbody className="divide-y divide-gray-200">{children}</tbody>; }
export function TableRow({ children }: { children?: React.ReactNode }) { return <tr className="hover:bg-gray-50">{children}</tr>; }
export function TableHead({ children }: { children?: React.ReactNode }) { return <th className="px-3 py-2 font-medium">{children}</th>; }
export function TableCell({ children }: { children?: React.ReactNode }) { return <td className="px-3 py-2">{children}</td>; }


