import type { ApplicationLog, FarmerInvite, FarmerLink, FarmField, Season } from '../../shared/models/farmer.model';
import { activePhiWarnings, daysUntil } from '../farmer/utils/phi.util';

/**
 * Bayi "Çiftçiler" sayfası ve ana sayfa kutusu için saf hesaplar (TASKS 14.9).
 * Girdi yalnızca çiftçinin bu işletmeyle PAYLAŞTIĞI veridir (kural zorlar); paylaşılmayan alan "yok" sayılır.
 */

export interface CustomerBrief { id: string; name: string; phone: string | null; village: string | null }

export interface FarmerRow {
  link: FarmerLink;
  name: string;
  phone: string | null;
  village: string | null;
  /** Paylaşılan aktif tarla sayısı / toplam dekar. Çiftçi tarla paylaşmıyorsa null. */
  fieldCount: number | null;
  areaDecare: number | null;
  /** Bilinen en son hareket (paylaşılan defter kaydı, tarla güncellemesi veya bağlantı tarihi). */
  lastActivity: Date | null;
}

const maxDate = (...ds: (Date | null | undefined)[]): Date | null =>
  ds.reduce<Date | null>((m, d) => (d && (!m || d.getTime() > m.getTime()) ? d : m), null);

export function buildFarmerRows(
  links: readonly FarmerLink[],
  fields: readonly FarmField[],
  logs: readonly ApplicationLog[],
  customers: ReadonlyMap<string, CustomerBrief>,
): FarmerRow[] {
  return links
    .map(link => {
      const c = customers.get(link.customerId);
      const own = fields.filter(f => f.farmerId === link.farmerId && f.isActive);
      const shared = link.status === 'active' && link.consent.fields;
      const lastLog = logs.filter(l => l.farmerId === link.farmerId).reduce<Date | null>((m, l) => maxDate(m, l.date), null);
      const lastField = own.reduce<Date | null>((m, f) => maxDate(m, f.updatedAt, f.createdAt), null);
      return {
        link,
        name: c?.name || link.farmerName || '',
        phone: c?.phone ?? null,
        village: c?.village || own.find(f => f.village)?.village || null,
        fieldCount: shared ? own.length : null,
        areaDecare: shared ? Math.round(own.reduce((a, f) => a + (f.areaDecare || 0), 0) * 10) / 10 : null,
        lastActivity: maxDate(lastLog, lastField, link.createdAt),
      };
    })
    .sort((a, b) => Number(b.link.status === 'active') - Number(a.link.status === 'active') || a.name.localeCompare(b.name, 'tr'));
}

/** Davetin kalan günü (0 = bugün biter, < 0 = süresi doldu). */
export function inviteDaysLeft(inv: Pick<FarmerInvite, 'expiresAt'>, now: Date = new Date()): number {
  if (inv.expiresAt.getTime() <= now.getTime()) return -1;
  return daysUntil(inv.expiresAt, now);
}

/**
 * "Bu hafta hasat bekleme uyarısı" olan tarla sayısı: hasat bekleme süresi (PHI) hâlâ süren ve
 * ya 7 gün içinde biten ya da beklenen hasat tarihiyle çakışan (hasat < PHI bitişi) paylaşılan tarlalar.
 */
export function phiWarningFieldCount(
  logs: readonly ApplicationLog[],
  seasons: readonly Season[],
  today: Date = new Date(),
  windowDays = 7,
): number {
  const expected: Record<string, Date | null> = {};
  for (const s of seasons) expected[s.id] = s.expectedHarvestDate;
  const warnings = activePhiWarnings(logs, expected, today);
  return new Set(warnings.filter(w => w.conflict || w.daysLeft <= windowDays).map(w => w.fieldId)).size;
}
