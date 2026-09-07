export const ORDER_ACTIONS = ['printing', 'printed', 'processing', 'complete', 'cancel', 'undo_complete', 'undo_cancel'] as const;
export type OrderAction = typeof ORDER_ACTIONS[number];

const transitions: Record<OrderAction, string[]> = {
  printing: ['processing'],
  printed: ['processing', 'printing'],
  processing: ['printing', 'printed'],
  cancel: ['processing', 'printing', 'printed'],
  complete: ['printed', 'collected'],
  undo_complete: ['completed'],
  undo_cancel: ['cancelled'],
};

export function canApplyOrderAction(status: string, action: OrderAction) {
  return transitions[action].includes(status);
}

export function isOrderActionAlreadyApplied(status: string, action: OrderAction) {
  return (action === 'complete' && status === 'completed') || (action === 'cancel' && status === 'cancelled');
}
