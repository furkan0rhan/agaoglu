import { CartState } from './cart.store';

/** Askıya alınmış (bekletilen) sepet. */
export interface HeldCart {
  id: string;
  name: string;
  /** Epoch ms. */
  heldAt: number;
  state: CartState;
}

export const HELD_CARTS_KEY = 'tm.heldCarts.v1';
export const MAX_HELD_CARTS = 5;

/** Bekleyen sepetler (yeniden eskiye). Depolama yoksa / bozuksa boş liste. */
export function loadHeldCarts(storage: Pick<Storage, 'getItem'> | null = safeStorage()): HeldCart[] {
  try {
    const raw = storage?.getItem(HELD_CARTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HeldCart[];
    return Array.isArray(list)
      ? list.filter(h => h && typeof h.id === 'string' && Array.isArray(h.state?.items)).sort((a, b) => b.heldAt - a.heldAt)
      : [];
  } catch {
    return [];
  }
}

function save(list: HeldCart[], storage: Pick<Storage, 'setItem' | 'removeItem'> | null): boolean {
  try {
    if (!storage) return false;
    if (list.length) storage.setItem(HELD_CARTS_KEY, JSON.stringify(list));
    else storage.removeItem(HELD_CARTS_KEY);
    return true;
  } catch {
    return false;
  }
}

export type HoldResult = { ok: true; cart: HeldCart } | { ok: false; reason: 'full' | 'empty' | 'storage' };

/** Sepeti adıyla bekletir (en fazla MAX_HELD_CARTS). */
export function holdCart(
  name: string, state: CartState, now = Date.now(), storage: Storage | null = safeStorage(),
): HoldResult {
  if (!state.items.length) return { ok: false, reason: 'empty' };
  const list = loadHeldCarts(storage);
  if (list.length >= MAX_HELD_CARTS) return { ok: false, reason: 'full' };
  const cart: HeldCart = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 60),
    heldAt: now,
    state: structuredClone(state),
  };
  return save([cart, ...list], storage) ? { ok: true, cart } : { ok: false, reason: 'storage' };
}

/** Bekleyen sepeti listeden çıkarıp döndürür. */
export function takeHeldCart(id: string, storage: Storage | null = safeStorage()): HeldCart | null {
  const list = loadHeldCarts(storage);
  const hit = list.find(h => h.id === id) ?? null;
  if (hit) save(list.filter(h => h.id !== id), storage);
  return hit;
}

export function removeHeldCart(id: string, storage: Storage | null = safeStorage()): void {
  save(loadHeldCarts(storage).filter(h => h.id !== id), storage);
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
