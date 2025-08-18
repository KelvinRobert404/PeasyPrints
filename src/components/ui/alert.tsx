export function Alert({ children }: { children?: React.ReactNode }) {
  return <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">{children}</div>;
}
export function AlertDescription({ children }: { children?: React.ReactNode }) {
  return <div>{children}</div>;
}


