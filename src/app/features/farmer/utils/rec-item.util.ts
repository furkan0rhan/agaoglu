import type { ApplicationType, RecommendationItem } from '../../../shared/models/farmer.model';
import { FarmUnit, isFarmUnit } from './units';

/** Ürün kartındaki tür → çiftçi defteri kayıt türü */
const TYPE_BY_PRODUCT: Readonly<Record<string, ApplicationType>> = {
  bitki_koruma: 'pesticide', gubre: 'fertilizer', tohum: 'sowing', fide: 'sowing', diger: 'other',
};

/**
 * Öneri kaleminden defter kaydının türü ve birimi. Bilinmiyorsa (eski öneri, serbest metin ürün) null döner —
 * çiftçi kendisi seçer; varsayılan UYDURULMAZ (gübre önerisi "ilaç / lt" olarak düşmesin).
 */
export function recItemApplication(item: Pick<RecommendationItem, 'productType' | 'unit'> | null | undefined): {
  type: ApplicationType | null; unit: FarmUnit | null;
} {
  const pt = item?.productType ?? null;
  const type = pt && Object.prototype.hasOwnProperty.call(TYPE_BY_PRODUCT, pt) ? TYPE_BY_PRODUCT[pt] : null;
  const u = item?.unit ?? null;
  return { type, unit: isFarmUnit(u) ? u : null };
}
