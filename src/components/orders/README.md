# Orders Section Components

UI-only components for rendering the Orders section to align with the attached V0 design while using local UI primitives and brand utilities.

## Files
- `OrdersList.tsx`: Container rendering the orders list with grouping (Today / Older), loading, empty, and error states. Optional density prop.
- `OrderRow.tsx`: Memoized single-row renderer using the shared Table primitives and `Badge` for status.
- `OrdersFilters.tsx`: Placeholder wrapper to host filters UI if needed later.

## Props
### OrdersList
```
interface OrdersListProps {
  orders: OrderDoc[];
  isLoading?: boolean;
  error?: string | null;
  enableSelection?: boolean; // reserved for future use
  onOrderClick?: (order: OrderDoc) => void;
  density?: 'regular' | 'compact';
}
```

### OrderRow
```
interface OrderRowProps {
  order: OrderDoc & { status?: OrderDoc['status'] | 'printed_ready' };
  density?: 'regular' | 'compact';
  onClick?: (order: OrderDoc) => void;
}
```

## Behavior and assumptions
- No data fetching in components; data is provided by the existing stores/selectors.
- Grouping: the list splits into Today and Older based on `timestamp`.
- Status badge variants map as follows: printed/printed_ready/completed → default; cancelled → destructive; others → secondary.
- Responsiveness: some columns are hidden on small screens; key information remains visible.
- Performance: `OrderRow` is `React.memo`-wrapped; table rows use stable keys where available.
- Accessibility: semantic table elements are used; additional ARIA hooks can be added if/when sorting/filtering become interactive.

## Integration
- Import and render in `app/orders/page.tsx` with the existing store values:
```
<OrdersList orders={orders} isLoading={loading} error={error} />
```

## Notes
- UI-only; no changes to store shapes or API calls.
- If the V0 design introduces fields or behaviors not present in data, surface them for review before implementing.

