import { Timestamp } from '@angular/fire/firestore';
import { Batch } from '../models/product.model';

export function applyFEFO(batches: Batch[], quantity: number): Batch[] {
  const sorted = [...batches].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.toMillis() - b.expiryDate.toMillis();
  });
  let remaining = quantity;
  const result: Batch[] = [];
  for (const b of sorted) {
    if (remaining <= 0) { result.push(b); continue; }
    if (b.quantity <= remaining) { remaining -= b.quantity; }
    else { result.push({ ...b, quantity: b.quantity - remaining }); remaining = 0; }
  }
  return result;
}

export function nearestExpiry(batches: Batch[]): Timestamp | null {
  const active = batches.filter(b => b.expiryDate && b.quantity > 0);
  if (!active.length) return null;
  return active.sort((a, b) => a.expiryDate!.toMillis() - b.expiryDate!.toMillis())[0].expiryDate;
}
