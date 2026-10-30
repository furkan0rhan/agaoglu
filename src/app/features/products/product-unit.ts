import type { Translations } from '../../core/i18n/translations';
import { isDecimalUnit, Product, PRODUCT_UNITS, productUnit, ProductUnit, ProductType } from '../../shared/models/product.model';
import { formatQty } from '../../shared/utils/product-form.utils';

/** Birimin ekranda görünen kısa adı ("adet", "kg", "çuval") */
export function unitText(unit: ProductUnit | null | undefined, p: Translations['products']): string {
  switch (unit) {
    case 'kg': return p.unitKg;
    case 'lt': return p.unitLt;
    case 'paket': return p.unitPaket;
    case 'cuval': return p.unitCuval;
    case 'metre': return p.unitMetre;
    case 'viyol': return p.unitViyol;
    case 'kasa': return p.unitKasa;
    case 'demet': return p.unitDemet;
    case 'sise': return p.unitSise;
    default: return p.unitAdet;
  }
}

/** p-select seçenekleri */
export function unitOptions(p: Translations['products']): { label: string; value: ProductUnit }[] {
  return PRODUCT_UNITS.map(u => ({ label: unitText(u, p), value: u }));
}

/** "12,5 kg" / "3 adet" */
export function qtyWithUnit(qty: number | null | undefined, product: Pick<Product, 'unit'> | null | undefined, p: Translations['products']): string {
  return `${formatQty(qty, p.locale)} ${unitText(productUnit(product), p)}`;
}

/** p-inputNumber için en fazla ondalık hane (kg / lt / metre: 3, diğerleri: 0) */
export function qtyFractionDigits(product: Pick<Product, 'unit'> | null | undefined): number {
  return isDecimalUnit(productUnit(product)) ? 3 : 0;
}

/** Ürün türünün (mevzuat) görünen adı */
export function productTypeLabel(type: ProductType | null | undefined, t: Translations): string {
  const c = t.compliance;
  switch (type) {
    case 'bitki_koruma': return c.typeBitkiKoruma;
    case 'gubre': return c.typeGubre;
    case 'tohum': return c.typeTohum;
    case 'fide': return c.typeFide;
    default: return c.typeDiger;
  }
}
