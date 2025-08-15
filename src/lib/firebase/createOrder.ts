import { db } from '@/lib/firebase/config';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { OrderDoc } from '@/types/models';

export async function createOrderDoc(order: Omit<OrderDoc, 'timestamp' | 'status'> & { status?: OrderDoc['status'] }) {
  const payload: OrderDoc = {
    ...order,
    status: order.status ?? 'pending',
    timestamp: serverTimestamp() as any,
  };
  const ref = await addDoc(collection(db, 'orders'), payload);
  return ref.id;
}
