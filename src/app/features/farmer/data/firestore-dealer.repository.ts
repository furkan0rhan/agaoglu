import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
  DocumentData, Timestamp,
} from '@angular/fire/firestore';
import {
  ApplicationLog, FarmerInvite, FarmerLink, FarmField, FARMER_INVITE_TTL_DAYS, PrescriberInfo, Recommendation, Season,
} from '../../../shared/models/farmer.model';
import { productRequiresPrescription, productTypeOf } from '../../../shared/utils/regulatory.utils';
import type { Product } from '../../../shared/models/product.model';
import { generateInviteCode } from '../utils/identity.util';
import type { DealerFarmerRepository, DealerProductOption, NewInvite, NewRecommendation } from './repositories';
import { fromDate, toField, toInvite, toLink, toLog, toRecommendation, toSeason } from './converters';

/** Bayi tarafı Firestore implementasyonu (müşteri detayındaki çiftçi paneli). Dinleyici yok, getDocs. */

type Data = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

@Injectable({ providedIn: 'root' })
export class FirestoreDealerFarmerRepository implements DealerFarmerRepository {
  private readonly fs = inject(Firestore);

  async getTenantName(tenantId: string): Promise<string> {
    try {
      const snap = await getDoc(doc(this.fs, 'tenants', tenantId));
      return (snap.exists() && str(snap.data()['name'])) || '';
    } catch {
      return '';
    }
  }

  async findLinkForCustomer(tenantId: string, customerId: string): Promise<FarmerLink | null> {
    const snap = await getDocs(query(collection(this.fs, 'farmerLinks'), where('tenantId', '==', tenantId), where('customerId', '==', customerId)));
    const links = snap.docs.map(d => toLink(d.id, d.data()));
    return links.find(l => l.status === 'active') ?? links[0] ?? null;
  }

  async listOpenInvites(tenantId: string, customerId: string): Promise<FarmerInvite[]> {
    const snap = await getDocs(query(
      collection(this.fs, 'farmerInvites'), where('tenantId', '==', tenantId), where('customerId', '==', customerId), where('used', '==', false),
    ));
    return snap.docs.map(d => toInvite(d.id, d.data())).filter(i => !i.revoked);
  }

  async createInvite(input: NewInvite): Promise<FarmerInvite> {
    const open = await this.listOpenInvites(input.tenantId, input.customerId);
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + FARMER_INVITE_TTL_DAYS * 24 * 3600 * 1000);
    const batch = writeBatch(this.fs);
    for (const o of open) batch.update(doc(this.fs, 'farmerInvites', o.code), { revoked: true });
    batch.set(doc(this.fs, 'farmerInvites', code), {
      tenantId: input.tenantId, tenantName: input.tenantName, customerId: input.customerId, customerName: input.customerName,
      phoneLast4: input.phoneLast4, farmerId: input.farmerId, expiresAt: Timestamp.fromDate(expiresAt),
      used: false, usedBy: null, usedFarmerId: null, revoked: false, createdBy: input.createdBy, createdAt: serverTimestamp(),
    });
    await batch.commit();
    return {
      code, ...input, expiresAt, used: false, usedBy: null, usedFarmerId: null, revoked: false, createdAt: new Date(),
    };
  }

  async listSharedFields(tenantId: string, farmerId: string): Promise<FarmField[]> {
    const snap = await getDocs(query(collection(this.fs, 'fields'), where('farmerId', '==', farmerId), where('sharedTenantIds', 'array-contains', tenantId)));
    return snap.docs.map(d => toField(d.id, d.data())).filter(f => f.isActive);
  }

  async listSharedSeasons(tenantId: string, farmerId: string): Promise<Season[]> {
    const snap = await getDocs(query(collection(this.fs, 'seasons'), where('farmerId', '==', farmerId), where('sharedTenantIds', 'array-contains', tenantId)));
    return snap.docs.map(d => toSeason(d.id, d.data()));
  }

  async listSharedLogs(tenantId: string, farmerId: string, max: number): Promise<ApplicationLog[]> {
    const snap = await getDocs(query(
      collection(this.fs, 'applicationLogs'), where('farmerId', '==', farmerId), where('sharedTenantIds', 'array-contains', tenantId),
      orderBy('date', 'desc'), limit(max),
    ));
    return snap.docs.map(d => toLog(d.id, d.data()));
  }

  async listRecommendations(tenantId: string, farmerId: string): Promise<Recommendation[]> {
    const snap = await getDocs(query(
      collection(this.fs, 'recommendations'), where('tenantId', '==', tenantId), where('farmerId', '==', farmerId),
      orderBy('createdAt', 'desc'), limit(20),
    ));
    return snap.docs.map(d => toRecommendation(d.id, d.data()));
  }

  async createRecommendation(r: NewRecommendation): Promise<string> {
    const ref = doc(collection(this.fs, 'recommendations'));
    const batch = writeBatch(this.fs);
    batch.set(ref, {
      tenantId: r.tenantId, tenantName: r.tenantName, farmerId: r.farmerId, fieldId: r.fieldId, seasonId: r.seasonId,
      target: r.target.trim(),
      items: r.items.map(i => ({
        productId: i.productId, productName: i.productName.trim(), dose: i.dose.trim(), phiDays: i.phiDays, requiresPrescription: i.requiresPrescription,
      })),
      prescriptionNo: r.prescriptionNo?.trim() || null,
      windowStart: fromDate(r.windowStart), windowEnd: fromDate(r.windowEnd), notes: r.notes?.trim() || null,
      authorUid: r.authorUid, authorName: r.authorName, authorLicenseNo: r.authorLicenseNo,
      status: 'active', createdAt: serverTimestamp(),
    });
    await batch.commit();
    return ref.id;
  }

  async withdrawRecommendation(id: string, uid: string): Promise<void> {
    await updateDoc(doc(this.fs, 'recommendations', id), { status: 'withdrawn', withdrawnAt: serverTimestamp(), withdrawnBy: uid });
  }

  async getPrescriber(uid: string): Promise<PrescriberInfo | null> {
    const snap = await getDoc(doc(this.fs, 'users', uid));
    return snap.exists() ? toPrescriber(snap.id, snap.data()) : null;
  }

  async listTenantStaff(tenantId: string): Promise<PrescriberInfo[]> {
    const snap = await getDocs(query(collection(this.fs, 'users'), where('tenantId', '==', tenantId)));
    return snap.docs.map(d => toPrescriber(d.id, d.data())).sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
  }

  async setPrescriber(uid: string, canPrescribe: boolean, licenseNo: string | null): Promise<void> {
    await updateDoc(doc(this.fs, 'users', uid), { canPrescribe, prescriberLicenseNo: canPrescribe ? (licenseNo?.trim() || null) : null });
  }

  async listPrescriptionProducts(tenantId: string): Promise<DealerProductOption[]> {
    const snap = await getDocs(query(collection(this.fs, 'products'), where('tenantId', '==', tenantId), where('isActive', '==', true), orderBy('name')));
    return snap.docs.map(d => toProductOption(d.id, d.data() as Partial<Product>));
  }

  async syncCustomerToFarmer(link: FarmerLink, tenantName: string): Promise<number> {
    if (link.status !== 'active') return 0;
    const [custSnap, salesSnap, existingSnap] = await Promise.all([
      getDoc(doc(this.fs, 'customers', link.customerId)),
      getDocs(query(
        collection(this.fs, 'sales'), where('tenantId', '==', link.tenantId), where('customerId', '==', link.customerId),
        orderBy('createdAt', 'desc'), limit(50),
      )),
      getDocs(query(collection(this.fs, 'farmerPurchases'), where('tenantId', '==', link.tenantId), where('farmerId', '==', link.farmerId))),
    ]);

    const existing = new Map(existingSnap.docs.map(d => [d.id, str(d.data()['status'])]));
    const toWrite = salesSnap.docs.filter(s => existing.get(s.id) !== (str(s.data()['status']) ?? 'completed'));

    const productIds = new Set<string>();
    for (const s of toWrite) for (const it of (s.data()['items'] as Data[] | undefined) ?? []) { const id = str(it['productId']); if (id) productIds.add(id); }
    const products = new Map<string, Partial<Product>>();
    await Promise.all([...productIds].map(async id => {
      try {
        const p = await getDoc(doc(this.fs, 'products', id));
        if (p.exists()) products.set(id, p.data() as Partial<Product>);
      } catch { /* ürün silinmiş olabilir */ }
    }));

    const batch = writeBatch(this.fs);
    for (const s of toWrite) {
      batch.set(doc(this.fs, 'farmerPurchases', s.id), saleToPurchase(s.id, s.data(), link, tenantName, products), { merge: true });
    }
    const balance = custSnap.exists() ? num(custSnap.data()['balance']) : null;
    batch.update(doc(this.fs, 'farmerLinks', link.id), { balance, balanceUpdatedAt: serverTimestamp(), tenantName });
    await batch.commit();
    return toWrite.length;
  }
}

function toPrescriber(uid: string, d: Data): PrescriberInfo {
  return {
    uid, displayName: str(d['displayName']) ?? str(d['email']) ?? uid, role: str(d['role']) ?? '',
    canPrescribe: d['canPrescribe'] === true, prescriberLicenseNo: str(d['prescriberLicenseNo']),
  };
}

function toProductOption(id: string, p: Partial<Product>): DealerProductOption {
  return {
    id, name: p.name ?? '', productType: productTypeOf({ productType: p.productType, category: p.category ?? '' }),
    requiresPrescription: productRequiresPrescription({ requiresPrescription: p.requiresPrescription, productType: p.productType }),
    phiDays: num(p.phiDays), activeIngredient: str(p.activeIngredient),
  };
}

/** Satış → çiftçi ambarı kaydı. Alış/maliyet fiyatı (costPrice) ve bayi iç alanları AKTARILMAZ. */
function saleToPurchase(saleId: string, s: Data, link: FarmerLink, tenantName: string, products: Map<string, Partial<Product>>): DocumentData {
  const items = ((s['items'] as Data[] | undefined) ?? []).map(it => {
    const pid = str(it['productId']) ?? '';
    const p = products.get(pid) ?? {};
    const batches = (it['batches'] as Data[] | undefined) ?? [];
    const gts = Array.isArray(it['gtsNos']) ? (it['gtsNos'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : batches.map(b => str(b['gtsNo'])).filter((x): x is string => !!x);
    const expiries = batches.map(b => b['expiryDate']).filter((x): x is Timestamp => x instanceof Timestamp)
      .sort((a, b) => a.toMillis() - b.toMillis());
    const productType = productTypeOf({ productType: p.productType, category: p.category ?? '' });
    // Veri minimizasyonu: bitki koruma ürünlerinde fiyat çiftçi tarafına hiç aktarılmaz (md. 7 ihtiyatlı yorum)
    const hidePrice = productType === 'bitki_koruma';
    return {
      productId: pid, productName: str(it['productName']) ?? p.name ?? '', quantity: num(it['quantity']) ?? 0,
      unit: str(it['unit']) ?? p.unit ?? 'adet',
      unitPrice: hidePrice ? 0 : num(it['unitPrice']) ?? 0, totalPrice: hidePrice ? 0 : num(it['totalPrice']) ?? 0,
      productType,
      requiresPrescription: typeof it['requiresPrescription'] === 'boolean' ? it['requiresPrescription']
        : productRequiresPrescription({ requiresPrescription: p.requiresPrescription, productType: p.productType }),
      prescriptionNo: str(it['prescriptionNo']) ?? str(s['prescriptionNo']),
      activeIngredient: str(p.activeIngredient), licenseNo: str(it['licenseNo']) ?? str(p.licenseNo),
      phiDays: num(p.phiDays), gtsNos: [...new Set(gts)], expiryDate: expiries[0] ?? null,
    };
  });
  const status = str(s['status']);
  return {
    farmerId: link.farmerId, tenantId: link.tenantId, tenantName, saleId, saleNumber: str(s['saleNumber']) ?? '',
    purchasedAt: s['createdAt'] instanceof Timestamp ? s['createdAt'] : Timestamp.now(),
    status: status === 'cancelled' || status === 'refunded' ? status : 'completed',
    items, totalAmount: num(s['totalAmount']) ?? 0, creditAmount: num(s['creditAmount']) ?? 0, syncedAt: serverTimestamp(),
  };
}
