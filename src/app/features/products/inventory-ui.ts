import type { Product } from '../../shared/models/product.model';
import { productTypeOf } from '../../shared/utils/regulatory.utils';
import type { UiTone } from '../../shared/ui';

/**
 * Tasarım v2 (C) ürün/stok/alış ekranlarının ortak görünüm yardımcıları.
 * Sınıf adları TAM yazılır (Tailwind tarayıcısı görsün diye).
 */

/** C "chip": 40px, 8px köşe, güçlü kenarlık; seçili = koyu dolu. `danger` seçiliyken kırmızı yumuşak zemin. */
export function chipClass(active: boolean, danger = false): string {
  const base = 'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-token-md border px-3.5 text-sm font-semibold transition-colors';
  if (!active) return `${base} border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover hover:text-fg`;
  if (danger) return `${base} border-danger bg-danger-soft text-danger-text`;
  return `${base} border-fg bg-fg text-surface`;
}

/** Çip içindeki sayaç (seçiliyken metin rengini alır). */
export function chipCountClass(active: boolean): string {
  return active ? 'num text-xs font-bold opacity-75' : 'num text-xs font-bold text-fg-muted';
}

/** Stok seviyesi tonu: 0 / kritik = danger, eşiğin 1,5 katına kadar = warning, üstü = brand. */
export function stockTone(p: Pick<Product, 'stock' | 'minStock'>): UiTone {
  const s = p.stock ?? 0;
  const m = p.minStock ?? 0;
  if (s <= 0 || s <= m) return 'danger';
  if (s <= m * 1.5) return 'warning';
  return 'brand';
}

/** Stok çubuğu dolgu oranı (%): eşiğin 3 katı = dolu. */
export function stockPct(p: Pick<Product, 'stock' | 'minStock'>): number {
  const s = p.stock ?? 0;
  if (s <= 0) return 0;
  const m = p.minStock ?? 0;
  if (m <= 0) return 100;
  return Math.max(4, Math.min(100, (s / (m * 3)) * 100));
}

export const STOCK_BAR: Record<'danger' | 'warning' | 'brand', string> = {
  danger: 'bg-danger', warning: 'bg-warning', brand: 'bg-brand',
};

export function stockBarClass(p: Pick<Product, 'stock' | 'minStock'>): string {
  return STOCK_BAR[stockTone(p) as 'danger' | 'warning' | 'brand'];
}

/** Kritik satır (C: kırmızı sol kenar). */
export function isCritical(p: Pick<Product, 'stock' | 'minStock'>): boolean {
  return (p.stock ?? 0) <= (p.minStock ?? 0);
}

/** Ürün türüne göre ikon (PrimeIcons). */
export function productIcon(p: Pick<Product, 'productType' | 'category'>): string {
  switch (productTypeOf(p)) {
    case 'bitki_koruma': return 'pi-shield';
    case 'gubre': return 'pi-box';
    case 'tohum': return 'pi-sparkles';
    case 'fide': return 'pi-sun';
    default: return 'pi-wrench';
  }
}

/** Kâr oranı (maliyete göre, tam sayı %) — alış 0 ise null. */
export function markupPct(p: Pick<Product, 'purchasePrice' | 'salePrice'>): number | null {
  if (!(p.purchasePrice > 0)) return null;
  return Math.round(((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100);
}

/** Satır içi kritik kenar sınıfı (README: `shadow-[inset_3px_0_0_var(--danger)]`). */
export const CRIT_EDGE = 'shadow-[inset_3px_0_0_var(--danger)]';
