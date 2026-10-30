/**
 * Yedekleme / geri yükleme saf yardımcıları (Firestore'a bağımlı değil → test edilebilir).
 * Yedek biçimi: { format, version, exportedAt, tenantId, collections: { ad: [{ id, data }] } }
 * Timestamp alanları JSON'da { "__type": "timestamp", "seconds", "nanoseconds" } olarak saklanır.
 */

/** Yedeklenen tenant koleksiyonları (hepsinde `tenantId` alanı var). */
export const BACKUP_COLLECTIONS = [
  'products', 'customers', 'sales', 'creditTransactions', 'stockMovements', 'expenses',
  'suppliers', 'supplierTransactions', 'purchases',
] as const;
export type BackupCollection = typeof BACKUP_COLLECTIONS[number];

export const BACKUP_FORMAT = 'tarim-market-backup';
export const BACKUP_VERSION = 1;
/** Firestore yazma grubu sınırı */
export const WRITE_BATCH_LIMIT = 500;
/** Otomatik yedek hatırlatması eşiği (gün) */
export const BACKUP_REMINDER_DAYS = 7;

export interface BackupDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tenantId: string;
  /** Bilgi amaçlı (işletme adı vb.) — geri yüklemede yazılmaz */
  tenant: Record<string, unknown> | null;
  collections: Partial<Record<BackupCollection, BackupDoc[]>>;
}

export interface SerializedTimestamp {
  __type: 'timestamp';
  seconds: number;
  nanoseconds: number;
}

interface TimestampLike { seconds: number; nanoseconds: number; toDate(): Date }

export function isTimestampLike(v: unknown): v is TimestampLike {
  return !!v && typeof v === 'object'
    && typeof (v as TimestampLike).seconds === 'number'
    && typeof (v as TimestampLike).nanoseconds === 'number'
    && typeof (v as TimestampLike).toDate === 'function';
}

export function isSerializedTimestamp(v: unknown): v is SerializedTimestamp {
  return !!v && typeof v === 'object' && (v as SerializedTimestamp).__type === 'timestamp'
    && typeof (v as SerializedTimestamp).seconds === 'number';
}

/** Firestore değerini JSON'a uygun hale getirir (Timestamp → işaretli nesne). */
export function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (isTimestampLike(v)) return { __type: 'timestamp', seconds: v.seconds, nanoseconds: v.nanoseconds } satisfies SerializedTimestamp;
  if (v instanceof Date) return { __type: 'timestamp', seconds: Math.floor(v.getTime() / 1000), nanoseconds: (v.getTime() % 1000) * 1e6 };
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = serializeValue(val);
    return out;
  }
  return v;
}

/** JSON değerini Firestore'a geri çevirir. `makeTimestamp` = (s, n) => new Timestamp(s, n). */
export function deserializeValue(v: unknown, makeTimestamp: (seconds: number, nanoseconds: number) => unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (isSerializedTimestamp(v)) return makeTimestamp(v.seconds, v.nanoseconds ?? 0);
  if (Array.isArray(v)) return v.map(x => deserializeValue(x, makeTimestamp));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = deserializeValue(val, makeTimestamp);
    return out;
  }
  return v;
}

export class BackupFormatError extends Error {
  constructor(readonly code: 'invalid-json' | 'invalid-format' | 'unsupported-version' | 'empty-zip') {
    super(code);
    this.name = 'BackupFormatError';
  }
}

/** JSON metnini doğrular ve yedek nesnesine çevirir. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new BackupFormatError('invalid-json'); }
  const b = raw as Partial<BackupFile>;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT || typeof b.collections !== 'object' || !b.collections) {
    throw new BackupFormatError('invalid-format');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupFormatError('unsupported-version');
  for (const name of Object.keys(b.collections)) {
    const list = (b.collections as Record<string, unknown>)[name];
    if (!Array.isArray(list) || list.some(d => !d || typeof (d as BackupDoc).id !== 'string' || typeof (d as BackupDoc).data !== 'object')) {
      throw new BackupFormatError('invalid-format');
    }
  }
  return b as BackupFile;
}

/** Önizleme: koleksiyon başına kayıt sayısı (yalnız bilinen koleksiyonlar) ve toplam */
export function countRecords(b: Pick<BackupFile, 'collections'>): { perCollection: Record<BackupCollection, number>; total: number } {
  const perCollection = {} as Record<BackupCollection, number>;
  let total = 0;
  for (const c of BACKUP_COLLECTIONS) {
    const n = b.collections[c]?.length ?? 0;
    perCollection[c] = n;
    total += n;
  }
  return { perCollection, total };
}

export interface RestoreWrite {
  collection: BackupCollection;
  id: string;
  data: Record<string, unknown>;
}

/** Değer içinde, eski belge kimliğine birebir eşit tüm metinleri yeni kimlikle değiştirir. */
function remapIds(v: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (typeof v === 'string') return idMap.get(v) ?? v;
  if (Array.isArray(v)) return v.map(x => remapIds(x, idMap));
  if (v && typeof v === 'object' && !isSerializedTimestamp(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = remapIds(val, idMap);
    return out;
  }
  return v;
}

/**
 * Geri yükleme yazmalarını hazırlar:
 *  - `tenantId` her belgede mevcut işletmeyle değiştirilir
 *  - belge kimlikleri yenilenir (aynı projede eski işletme hâlâ varsa çakışma/üzerine yazma olmaz) ve
 *    tüm referanslar (productId, customerId, saleId, supplierId, purchaseId, reference …) yeni kimliklere çevrilir
 *  - Timestamp'ler `makeTimestamp` ile yeniden oluşturulur
 */
export function prepareRestore(
  b: Pick<BackupFile, 'collections'>,
  newTenantId: string,
  makeTimestamp: (seconds: number, nanoseconds: number) => unknown,
  newId: () => string,
): RestoreWrite[] {
  const idMap = new Map<string, string>();
  for (const c of BACKUP_COLLECTIONS) for (const d of b.collections[c] ?? []) if (!idMap.has(d.id)) idMap.set(d.id, newId());

  const writes: RestoreWrite[] = [];
  for (const c of BACKUP_COLLECTIONS) {
    for (const d of b.collections[c] ?? []) {
      const remapped = remapIds(d.data, idMap) as Record<string, unknown>;
      const data = deserializeValue(remapped, makeTimestamp) as Record<string, unknown>;
      delete data['id'];
      data['tenantId'] = newTenantId;
      writes.push({ collection: c, id: idMap.get(d.id)!, data });
    }
  }
  return writes;
}

/** Diziyi en fazla `size` elemanlı parçalara böler. */
export function chunk<T>(items: readonly T[], size: number = WRITE_BATCH_LIMIT): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Excel hücre sınırı */
const CELL_LIMIT = 32_000;

function cellValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (isSerializedTimestamp(v)) return new Date(v.seconds * 1000).toISOString();
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > CELL_LIMIT ? v.slice(0, CELL_LIMIT) : v;
  const json = JSON.stringify(v);
  return json.length > CELL_LIMIT ? json.slice(0, CELL_LIMIT) : json;
}

/** Bir koleksiyonu Excel satırlarına çevirir: ilk satır başlıklar (id + tüm alanların birleşimi). */
export function toSheetRows(docs: readonly BackupDoc[]): (string | number | boolean | null)[][] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const d of docs) for (const k of Object.keys(d.data)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  return [['id', ...keys], ...docs.map(d => [d.id, ...keys.map(k => cellValue(d.data[k]))])];
}

/** Son yedek `days` günden eskiyse (veya hiç yoksa) true */
export function backupOverdue(lastBackupAt: Date | null, now: Date = new Date(), days: number = BACKUP_REMINDER_DAYS): boolean {
  if (!lastBackupAt) return true;
  return now.getTime() - lastBackupAt.getTime() > days * 86_400_000;
}

/** Dosya adı için yerel tarih: 2026-10-27 */
export function dateStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
