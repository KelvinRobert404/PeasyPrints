"use client";

import * as React from 'react';

export interface OrdersFiltersProps {
  className?: string;
  children?: React.ReactNode;
}

export function OrdersFilters({ className, children }: OrdersFiltersProps) {
  return (
    <div className={className} aria-label="Orders filters">
      {children}
    </div>
  );
}

export default OrdersFilters;


