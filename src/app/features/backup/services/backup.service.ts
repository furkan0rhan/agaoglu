import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch,
} from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LoggerService } from '../../../core/logging/logger.service';
import {
  BACKUP_COLLECTIONS, BACKUP_FORMAT, BACKUP_VERSION, BackupCollection, BackupDoc, BackupFile, BackupFormatError,
  backupOverdue, chunk, dateStamp, parseBackup, prepareRestore, serializeValue, toSheetRows,
} from './backup.utils';

export class RestoreNotAllowedError extends Error {
  constructor(readonly nonEmpty: BackupCollection[]) {
    super('TENANT_NOT_EMPTY');
    this.name = 'RestoreNotAllowedError';
  }
}

export interface RestoreProgress {
  written: number;
  total: number;
}

/**
 * Tenant verisinin yedeği (JSON.zip + Excel), boş işletmeye geri yükleme ve yedek hatırlatması.
 * Okuma/yazma kuralları: tüm koleksiyonlar `inTenant` — yeni koleksiyon kuralı gerekmez.
 * `tenants.lastBackupAt` yalnız admin tarafından yazılabilir (tenants update = isTenantAdmin).
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  /** Tenant'ın tüm koleksiyonlarını okuyup yedek nesnesi üretir. */
  async exportAll(): Promise<BackupFile> {
    const tenantId = this.auth.currentTenantId();
    const collections: Partial<Record<BackupCollection, BackupDoc[]>> = {};
    await Promise.all(BACKUP_COLLECTIONS.map(async c => {
      const snap = await getDocs(query(collection(this.firestore, c), where('tenantId', '==', tenantId)));
      collections[c] = snap.docs.map(d => ({ id: d.id, data: serializeValue(d.data()) as Record<string, unknown> }));
    }));
    let tenant: Record<string, unknown> | null = null;
    try {
      const t = await getDoc(doc(this.firestore, 'tenants', tenantId));
      tenant = t.exists() ? serializeValue(t.data()) as Record<string, unknown> : null;
    } catch (err) {
      this.logger.warn('backup: tenant doc read failed', err);
    }
    return {
      format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
      tenantId, tenant, collections,
    };
  }

  /** JSON yedeğini zip'leyip indirir (fflate dinamik import). */
  async downloadZip(backup: BackupFile): Promise<void> {
    const { zipSync, strToU8 } = await import('fflate');
    const name = `tarim-market-yedek-${dateStamp()}`;
    const zipped = zipSync({ [`${name}.json`]: strToU8(JSON.stringify(backup)) }, { level: 6 });
    this.saveBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), `${name}.zip`);
  }

  /** Her koleksiyon ayrı sayfa olacak şekilde Excel indirir (xlsx dinamik import). */
  async downloadExcel(backup: BackupFile): Promise<void> {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    for (const c of BACKUP_COLLECTIONS) {
      const ws = XLSX.utils.aoa_to_sheet(toSheetRows(backup.collections[c] ?? []));
      XLSX.utils.book_append_sheet(wb, ws, c.slice(0, 31));
    }
    XLSX.writeFile(wb, `tarim-market-yedek-${dateStamp()}.xlsx`);
  }

  /** Başarılı indirmeden sonra çağrılır (admin değilse sessizce geçer). */
  async markBackupDone(): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'tenants', this.auth.currentTenantId()), {
        lastBackupAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (err) {
      this.logger.warn('backup: lastBackupAt update failed', err);
    }
  }

  async getLastBackupAt(): Promise<Date | null> {
    const tenantId = this.auth.currentTenantId();
    if (!tenantId) return null;
    const snap = await getDoc(doc(this.firestore, 'tenants', tenantId));
    const v = snap.exists() ? snap.data()['lastBackupAt'] : null;
    return v instanceof Timestamp ? v.toDate() : null;
  }

  /** Dashboard uyarısı: son yedek 7 günden eskiyse veya hiç alınmadıysa true. Okuma hatasında false (gürültü yapma). */
  async isBackupOverdue(now: Date = new Date()): Promise<boolean> {
    try {
      const tenantId = this.auth.currentTenantId();
      if (!tenantId) return false;
      const snap = await getDoc(doc(this.firestore, 'tenants', tenantId));
      const data = snap.exists() ? snap.data() : {};
      const last = data['lastBackupAt'] instanceof Timestamp ? (data['lastBackupAt'] as Timestamp).toDate() : null;
      const created = data['createdAt'] instanceof Timestamp ? (data['createdAt'] as Timestamp).toDate() : null;
      return backupOverdue(last, now, undefined, created);
    } catch (err) {
      this.logger.warn('backup: overdue check failed', err);
      return false;
    }
  }

  /** .zip (içindeki ilk .json) veya .json dosyasını okuyup doğrular. */
  async readFile(file: File): Promise<BackupFile> {
    const buf = new Uint8Array(await file.arrayBuffer());
    const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
    if (!isZip) return parseBackup(new TextDecoder().decode(buf));
    const { unzipSync, strFromU8 } = await import('fflate');
    const files = unzipSync(buf, { filter: f => f.name.toLowerCase().endsWith('.json') });
    const first = Object.values(files)[0];
    if (!first) throw new BackupFormatError('empty-zip');
    return parseBackup(strFromU8(first));
  }

  /** Mevcut işletmede veri olan koleksiyonlar (boşsa []). */
  async nonEmptyCollections(): Promise<BackupCollection[]> {
    const tenantId = this.auth.currentTenantId();
    const result = await Promise.all(BACKUP_COLLECTIONS.map(async c => {
      const snap = await getDocs(query(collection(this.firestore, c), where('tenantId', '==', tenantId), limit(1)));
      return snap.empty ? null : c;
    }));
    return result.filter((c): c is BackupCollection => c !== null);
  }

  /**
   * Yedeği BOŞ işletmeye yükler (mevcut veriyi ezmez). tenantId mevcut işletmeyle değiştirilir,
   * belge kimlikleri yenilenir, 500'lük writeBatch parçalarıyla sırayla yazılır.
   * Not: Bir parça başarısız olursa önceki parçalar yazılmış kalır (işletme artık boş değildir).
   */
  async restore(backup: BackupFile, onProgress?: (p: RestoreProgress) => void): Promise<number> {
    const nonEmpty = await this.nonEmptyCollections();
    if (nonEmpty.length) throw new RestoreNotAllowedError(nonEmpty);
    const tenantId = this.auth.currentTenantId();
    const writes = prepareRestore(backup, tenantId, (s, n) => new Timestamp(s, n), () => doc(collection(this.firestore, 'products')).id);
    let written = 0;
    onProgress?.({ written, total: writes.length });
    for (const part of chunk(writes)) {
      const batch = writeBatch(this.firestore);
      for (const w of part) batch.set(doc(this.firestore, w.collection, w.id), w.data);
      await batch.commit();
      written += part.length;
      onProgress?.({ written, total: writes.length });
    }
    return written;
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
