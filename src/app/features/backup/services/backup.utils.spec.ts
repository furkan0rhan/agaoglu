import {
  BACKUP_FORMAT, BackupFile, BackupFormatError, backupOverdue, chunk, countRecords, deserializeValue, parseBackup,
  prepareRestore, serializeValue, toSheetRows,
} from './backup.utils';

/** Firestore Timestamp taklidi */
function fakeTs(seconds: number, nanoseconds = 0) {
  return { seconds, nanoseconds, toDate: () => new Date(seconds * 1000) };
}

function sampleBackup(): BackupFile {
  return {
    format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-27T10:00:00.000Z', tenantId: 'OLD_TENANT', tenant: null,
    collections: {
      suppliers: [{ id: 'SUP1', data: { tenantId: 'OLD_TENANT', name: 'Tohumcu', balance: 100 } }],
      products: [{
        id: 'PROD1',
        data: {
          tenantId: 'OLD_TENANT', name: 'Gübre', stock: 5, createdBy: 'uid-1',
          createdAt: serializeValue(fakeTs(1_700_000_000, 5)),
          batches: [{ id: 'batch-uuid', quantity: 5, supplierId: 'SUP1', expiryDate: null }],
        },
      }],
      stockMovements: [{ id: 'MOV1', data: { tenantId: 'OLD_TENANT', productId: 'PROD1', reference: 'PUR1' } }],
      purchases: [{ id: 'PUR1', data: { tenantId: 'OLD_TENANT', supplierId: 'SUP1', items: [{ productId: 'PROD1', batchIds: ['batch-uuid'] }] } }],
    },
  };
}

describe('backup.utils — serileştirme', () => {
  it('Timestamp → işaretli nesne → geri', () => {
    const s = serializeValue({ a: fakeTs(10, 20), list: [fakeTs(30)], n: 1, s: 'x', z: null });
    expect(s).toEqual({
      a: { __type: 'timestamp', seconds: 10, nanoseconds: 20 },
      list: [{ __type: 'timestamp', seconds: 30, nanoseconds: 0 }],
      n: 1, s: 'x', z: null,
    });
    const back = deserializeValue(JSON.parse(JSON.stringify(s)), (sec, ns) => ({ ts: [sec, ns] }));
    expect(back).toEqual({ a: { ts: [10, 20] }, list: [{ ts: [30, 0] }], n: 1, s: 'x', z: null });
  });
});

describe('backup.utils — doğrulama ve önizleme', () => {
  it('geçerli yedek ayrıştırılır, kayıt sayıları', () => {
    const b = parseBackup(JSON.stringify(sampleBackup()));
    const c = countRecords(b);
    expect(c.total).toBe(4);
    expect(c.perCollection.products).toBe(1);
    expect(c.perCollection.sales).toBe(0);
  });

  it('bozuk / yabancı dosya reddedilir', () => {
    expect(() => parseBackup('{not json')).toThrow(BackupFormatError);
    expect(() => parseBackup(JSON.stringify({ format: 'other', collections: {} }))).toThrow(BackupFormatError);
    expect(() => parseBackup(JSON.stringify({ ...sampleBackup(), version: 99 }))).toThrow(BackupFormatError);
    expect(() => parseBackup(JSON.stringify({ ...sampleBackup(), collections: { products: [{ data: {} }] } }))).toThrow(BackupFormatError);
  });
});

describe('backup.utils — geri yükleme hazırlığı', () => {
  let n = 0;
  const newId = () => `NEW${++n}`;
  const writes = prepareRestore(sampleBackup(), 'MY_TENANT', (s, ns) => ({ ts: [s, ns] }), newId);
  const byCol = (c: string) => writes.filter(w => w.collection === c);

  it('tenantId her belgede mevcut işletmeyle değişir', () => {
    expect(writes).toHaveLength(4);
    expect(writes.every(w => w.data['tenantId'] === 'MY_TENANT')).toBe(true);
    expect(JSON.stringify(writes)).not.toContain('OLD_TENANT');
  });

  it('belge kimlikleri yenilenir ve referanslar yeni kimliklere çevrilir', () => {
    const sup = byCol('suppliers')[0];
    const prod = byCol('products')[0];
    const pur = byCol('purchases')[0];
    const mov = byCol('stockMovements')[0];
    expect(sup.id).not.toBe('SUP1');
    expect(prod.id).not.toBe('PROD1');
    expect((prod.data['batches'] as { supplierId: string; id: string }[])[0]).toMatchObject({ supplierId: sup.id, id: 'batch-uuid' });
    expect(pur.data['supplierId']).toBe(sup.id);
    expect((pur.data['items'] as { productId: string }[])[0].productId).toBe(prod.id);
    expect(mov.data['productId']).toBe(prod.id);
    expect(mov.data['reference']).toBe(pur.id);
    // kullanıcı uid'si belge kimliği değil → korunur
    expect(prod.data['createdBy']).toBe('uid-1');
  });

  it('Timestamp yeniden oluşturulur', () => {
    expect(byCol('products')[0].data['createdAt']).toEqual({ ts: [1_700_000_000, 5] });
  });
});

describe('backup.utils — 500\'lük parçalama', () => {
  it('1201 kayıt → 500 + 500 + 201', () => {
    const parts = chunk(Array.from({ length: 1201 }, (_, i) => i));
    expect(parts.map(p => p.length)).toEqual([500, 500, 201]);
    expect(parts.flat()).toHaveLength(1201);
  });

  it('tam katlar ve boş liste', () => {
    expect(chunk(Array.from({ length: 1000 }, (_, i) => i)).map(p => p.length)).toEqual([500, 500]);
    expect(chunk([])).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('backup.utils — Excel ve hatırlatma', () => {
  it('sayfa satırları: id + alan birleşimi, nesneler JSON, tarih ISO', () => {
    const rows = toSheetRows([
      { id: 'a', data: { name: 'X', at: { __type: 'timestamp', seconds: 0, nanoseconds: 0 } } },
      { id: 'b', data: { name: 'Y', tags: ['t'] } },
    ]);
    expect(rows[0]).toEqual(['id', 'name', 'at', 'tags']);
    expect(rows[1]).toEqual(['a', 'X', '1970-01-01T00:00:00.000Z', null]);
    expect(rows[2]).toEqual(['b', 'Y', null, '["t"]']);
  });

  it('7 günü geçen veya hiç alınmamış yedek gecikmiş sayılır', () => {
    const now = new Date(2026, 9, 27, 12);
    expect(backupOverdue(null, now)).toBe(true);
    expect(backupOverdue(new Date(2026, 9, 21, 12), now)).toBe(false);
    expect(backupOverdue(new Date(2026, 9, 19, 12), now)).toBe(true);
  });
});

describe('Y15: yeni işletmede yedek uyarısı yok', () => {
  it('hiç yedek yoksa ve işletme 7 günden yeniyse uyarma', () => {
    const now = new Date(2026, 9, 30, 12);
    expect(backupOverdue(null, now, 7, new Date(2026, 9, 30, 11))).toBe(false);
    expect(backupOverdue(null, now, 7, new Date(2026, 9, 10))).toBe(true);
    expect(backupOverdue(null, now)).toBe(true);
  });
});
