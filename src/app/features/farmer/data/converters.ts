import { Timestamp } from '@angular/fire/firestore';
import {
  ApplicationLog, APPLICATION_TYPES, ApplicationType, FarmerConsent, FarmerInstallment, FarmerInvite, FarmerLink, FarmerProfile, FarmerPurchase,
  FarmerPurchaseItem, FarmField, FARMER_CONSENT_TEXT_VERSION, PhiSource, Recommendation, RecommendationItem, Season,
} from '../../../shared/models/farmer.model';

/** Firestore ↔ model dönüşümleri. `Timestamp` yalnızca bu dosyada ve repository'lerde görünür. */

type Data = Record<string, unknown>;

export function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

export function fromDate(d: Date | null | undefined): Timestamp | null {
  return d ? Timestamp.fromDate(d) : null;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Data => (v && typeof v === 'object' ? (v as Data) : {});

export function toFarmer(id: string, d: Data): FarmerProfile {
  return {
    id, ownerUids: strArr(d['ownerUids']), displayName: str(d['displayName']) ?? '', phone: str(d['phone']) ?? '',
    city: str(d['city']), district: str(d['district']), village: str(d['village']), cksNo: str(d['cksNo']),
    deletionRequestedAt: toDate(d['deletionRequestedAt']), createdAt: toDate(d['createdAt']), updatedAt: toDate(d['updatedAt']),
  };
}

export function toInvite(code: string, d: Data): FarmerInvite {
  return {
    code, tenantId: str(d['tenantId']) ?? '', tenantName: str(d['tenantName']) ?? '', customerId: str(d['customerId']) ?? '',
    customerName: str(d['customerName']) ?? '', phoneLast4: str(d['phoneLast4']) ?? '', farmerId: str(d['farmerId']),
    expiresAt: toDate(d['expiresAt']) ?? new Date(0), used: d['used'] === true, usedBy: str(d['usedBy']),
    usedFarmerId: str(d['usedFarmerId']), revoked: d['revoked'] === true, createdBy: str(d['createdBy']) ?? '',
    createdAt: toDate(d['createdAt']),
  };
}

export function toConsent(v: unknown): FarmerConsent {
  const c = obj(v);
  return {
    purchases: true, fields: c['fields'] === true, logs: c['logs'] === true, notifications: c['notifications'] === true,
    textVersion: str(c['textVersion']) ?? FARMER_CONSENT_TEXT_VERSION, grantedAt: toDate(c['grantedAt']), updatedAt: toDate(c['updatedAt']),
  };
}

export function consentToData(c: FarmerConsent): Data {
  return {
    purchases: true, fields: c.fields, logs: c.logs, notifications: c.notifications, textVersion: c.textVersion,
    grantedAt: fromDate(c.grantedAt) ?? Timestamp.now(), updatedAt: Timestamp.now(),
  };
}

export function toLink(id: string, d: Data): FarmerLink {
  return {
    id, tenantId: str(d['tenantId']) ?? '', farmerId: str(d['farmerId']) ?? '', customerId: str(d['customerId']) ?? '',
    inviteCode: str(d['inviteCode']) ?? '', status: d['status'] === 'active' ? 'active' : 'revoked', consent: toConsent(d['consent']),
    tenantName: str(d['tenantName']) ?? '', farmerName: str(d['farmerName']) ?? '', balance: num(d['balance']),
    balanceUpdatedAt: toDate(d['balanceUpdatedAt']), nextDue: toDue(d['nextDue']), overdueAmount: num(d['overdueAmount']),
    schedule: Array.isArray(d['schedule']) ? d['schedule'].map(toInstallment) : [], createdAt: toDate(d['createdAt']),
  };
}

function toDue(v: unknown): FarmerLink['nextDue'] {
  const o = obj(v);
  const date = toDate(o['date']), amount = num(o['amount']);
  return date && amount != null ? { date, amount } : null;
}

function toInstallment(v: unknown): FarmerInstallment {
  const i = obj(v);
  const amount = num(i['amount']) ?? 0;
  return {
    dueDate: toDate(i['dueDate']), amount, remaining: num(i['remaining']) ?? amount,
    no: num(i['no']) ?? 1, count: num(i['count']) ?? 1, saleNumber: str(i['saleNumber']),
  };
}

function toGeo(v: unknown): FarmField['location'] {
  const g = obj(v);
  const lat = num(g['lat']), lng = num(g['lng']);
  return lat != null && lng != null ? { lat, lng } : null;
}

export function toField(id: string, d: Data): FarmField {
  return {
    id, farmerId: str(d['farmerId']) ?? '', name: str(d['name']) ?? '', areaDecare: num(d['areaDecare']) ?? 0,
    city: str(d['city']), district: str(d['district']), village: str(d['village']), ada: str(d['ada']), parsel: str(d['parsel']),
    location: toGeo(d['location']), irrigation: d['irrigation'] === 'irrigated' ? 'irrigated' : 'dry',
    sharedTenantIds: strArr(d['sharedTenantIds']), isActive: d['isActive'] !== false,
    createdAt: toDate(d['createdAt']), updatedAt: toDate(d['updatedAt']),
  };
}

export function toSeason(id: string, d: Data): Season {
  const st = d['status'];
  return {
    id, farmerId: str(d['farmerId']) ?? '', fieldId: str(d['fieldId']) ?? '', crop: str(d['crop']) ?? 'other', variety: str(d['variety']),
    sowingDate: toDate(d['sowingDate']), expectedHarvestDate: toDate(d['expectedHarvestDate']), harvestDate: toDate(d['harvestDate']),
    status: st === 'planned' || st === 'harvested' ? st : 'active', sharedTenantIds: strArr(d['sharedTenantIds']),
    createdAt: toDate(d['createdAt']), updatedAt: toDate(d['updatedAt']),
  };
}

export function toLog(id: string, d: Data): ApplicationLog {
  const type = APPLICATION_TYPES.includes(d['type'] as ApplicationType) ? (d['type'] as ApplicationType) : 'other';
  const ps = d['phiSource'];
  return {
    id, farmerId: str(d['farmerId']) ?? '', fieldId: str(d['fieldId']) ?? '', seasonId: str(d['seasonId']), type,
    date: toDate(d['date']) ?? new Date(0), purchaseId: str(d['purchaseId']), purchaseItemIndex: num(d['purchaseItemIndex']),
    productName: str(d['productName']), quantity: num(d['quantity']), unit: str(d['unit']), areaDecare: num(d['areaDecare']),
    dosePerDecare: num(d['dosePerDecare']), appliedBy: str(d['appliedBy']), notes: str(d['notes']), phiDays: num(d['phiDays']),
    phiSource: ps === 'dealer' || ps === 'recommendation' || ps === 'manual' ? (ps as PhiSource) : null,
    earliestHarvestDate: toDate(d['earliestHarvestDate']), recommendationId: str(d['recommendationId']),
    sharedTenantIds: strArr(d['sharedTenantIds']), createdAt: toDate(d['createdAt']), updatedAt: toDate(d['updatedAt']),
  };
}

function toPurchaseItem(v: unknown): FarmerPurchaseItem {
  const i = obj(v);
  return {
    productId: str(i['productId']) ?? '', productName: str(i['productName']) ?? '', quantity: num(i['quantity']) ?? 0,
    unit: str(i['unit']) ?? 'adet', unitPrice: num(i['unitPrice']) ?? 0, totalPrice: num(i['totalPrice']) ?? 0,
    productType: str(i['productType']), requiresPrescription: i['requiresPrescription'] === true, prescriptionNo: str(i['prescriptionNo']),
    activeIngredient: str(i['activeIngredient']), licenseNo: str(i['licenseNo']), phiDays: num(i['phiDays']),
    gtsNos: strArr(i['gtsNos']), expiryDate: toDate(i['expiryDate']),
  };
}

export function toPurchase(id: string, d: Data): FarmerPurchase {
  const rem = obj(d['remaining']);
  const remaining: Record<string, number> = {};
  for (const k of Object.keys(rem)) { const n = num(rem[k]); if (n != null) remaining[k] = n; }
  const st = d['status'];
  return {
    id, farmerId: str(d['farmerId']) ?? '', tenantId: str(d['tenantId']) ?? '', tenantName: str(d['tenantName']) ?? '',
    saleId: str(d['saleId']) ?? id, saleNumber: str(d['saleNumber']) ?? '', purchasedAt: toDate(d['purchasedAt']) ?? new Date(0),
    status: st === 'cancelled' || st === 'refunded' ? st : 'completed',
    items: Array.isArray(d['items']) ? d['items'].map(toPurchaseItem) : [],
    totalAmount: num(d['totalAmount']) ?? 0, creditAmount: num(d['creditAmount']) ?? 0, remaining, syncedAt: toDate(d['syncedAt']),
  };
}

function toRecItem(v: unknown): RecommendationItem {
  const i = obj(v);
  return {
    productId: str(i['productId']), productName: str(i['productName']) ?? '', dose: str(i['dose']) ?? '',
    phiDays: num(i['phiDays']), requiresPrescription: i['requiresPrescription'] === true,
    productType: str(i['productType']), unit: str(i['unit']),
  };
}

export function toRecommendation(id: string, d: Data): Recommendation {
  return {
    id, tenantId: str(d['tenantId']) ?? '', tenantName: str(d['tenantName']) ?? '', farmerId: str(d['farmerId']) ?? '',
    fieldId: str(d['fieldId']), seasonId: str(d['seasonId']), target: str(d['target']) ?? '',
    items: Array.isArray(d['items']) ? d['items'].map(toRecItem) : [], prescriptionNo: str(d['prescriptionNo']),
    windowStart: toDate(d['windowStart']), windowEnd: toDate(d['windowEnd']), notes: str(d['notes']),
    authorUid: str(d['authorUid']) ?? '', authorName: str(d['authorName']) ?? '', authorLicenseNo: str(d['authorLicenseNo']) ?? '',
    status: d['status'] === 'withdrawn' ? 'withdrawn' : 'active', createdAt: toDate(d['createdAt']),
  };
}
