import { describe, expect, it } from 'vitest';
import {
  barcodeFromScan, canonicalGts, GS, gtin14ToEan13, gtinMatches, isValidGtin, normalizeGs1Raw, parseGs1, parseGs1Date,
} from './gs1';
import { scanResultFromText } from './manual-scan';
import { isGsKey } from './gs1-keys.directive';

const TODAY = new Date(2026, 9, 30); // 30.10.2026
const GTIN = '08691234567890';        // EAN-13 8691234567890 + baştaki 0
const EAN = '8691234567890';

describe('isValidGtin / gtin14ToEan13 / gtinMatches', () => {
  it('kontrol hanesini doğrular', () => {
    expect(isValidGtin(EAN)).toBe(true);
    expect(isValidGtin(GTIN)).toBe(true);
    expect(isValidGtin('8691234567891')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('abc')).toBe(false);
  });

  it('GTIN-14 → EAN-13 yalnız gösterge 0 iken', () => {
    expect(gtin14ToEan13(GTIN)).toBe(EAN);
    expect(gtin14ToEan13('18691234567897')).toBeNull();
    expect(gtin14ToEan13('123')).toBeNull();
  });

  it('barkod ile GTIN eşleşmesi baştaki sıfırları önemsemez', () => {
    expect(gtinMatches(EAN, GTIN)).toBe(true);
    expect(gtinMatches(GTIN, GTIN)).toBe(true);
    expect(gtinMatches('8690000111220', GTIN)).toBe(false);
    expect(gtinMatches('', GTIN)).toBe(false);
    expect(gtinMatches('ABC', 'ABC')).toBe(false);
  });
});

describe('parseGs1Date', () => {
  it('YYMMDD → yerel tarih', () => {
    const d = parseGs1Date('270531', TODAY)!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2027, 5, 31]);
  });

  it('gün 00 → ayın son günü (şubat/artık yıl)', () => {
    expect(parseGs1Date('280200', TODAY)!.getDate()).toBe(29);
    expect(parseGs1Date('270200', TODAY)!.getDate()).toBe(28);
    expect(parseGs1Date('271100', TODAY)!.getDate()).toBe(30);
  });

  it('geçersiz ay/gün → null', () => {
    expect(parseGs1Date('271301', TODAY)).toBeNull();
    expect(parseGs1Date('270231', TODAY)).toBeNull();
    expect(parseGs1Date('2705', TODAY)).toBeNull();
  });

  it('yüzyıl kayan penceresi', () => {
    expect(parseGs1Date('990101', TODAY)!.getFullYear()).toBe(1999);
    expect(parseGs1Date('760101', TODAY)!.getFullYear()).toBe(2076);
  });
});

describe('normalizeGs1Raw / canonicalGts', () => {
  it('AIM öneki ve baştaki FNC1 atılır', () => {
    expect(normalizeGs1Raw(`]d2${GS}01${GTIN}`)).toBe(`01${GTIN}`);
    expect(normalizeGs1Raw(`]C101${GTIN}`)).toBe(`01${GTIN}`);
  });

  it('kamera (GS\'li) ve USB (GS\'siz) okuması aynı GTS metnini verir', () => {
    const camera = `]d201${GTIN}21ABC123${GS}17270531${GS}10LOT9`;
    const usb = `01${GTIN}21ABC1231727053110LOT9`;
    expect(canonicalGts(camera)).toBe(usb);
    expect(canonicalGts(usb)).toBe(usb);
    expect(canonicalGts(`01${GTIN}21ABC123<GS>17270531<GS>10LOT9`)).toBe(usb);
  });

  it('parantezli biçim düz diziye çevrilir', () => {
    expect(canonicalGts(`(01)${GTIN}(17)270531(10)LOT9`)).toBe(`01${GTIN}1727053110LOT9`);
  });

  it('düz barkod olduğu gibi kalır', () => {
    expect(canonicalGts(`  ${EAN} `)).toBe(EAN);
  });
});

describe('parseGs1', () => {
  it('GS ayırıcılı BKÜ/İTS sırası: 01-21-17-10', () => {
    const r = parseGs1(`${GS}01${GTIN}21987654321${GS}17270531${GS}10ABC12`, TODAY)!;
    expect(r.gtin).toBe(GTIN);
    expect(r.ean13).toBe(EAN);
    expect(r.serial).toBe('987654321');
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('ABC12');
    expect(r.ambiguous).toBe(false);
  });

  it(']d2 önekli, sabit alan sonrası GS gerekmez: 01-17-10-21', () => {
    const r = parseGs1(`]d201${GTIN}1728120010L2026A${GS}21SN0001`, TODAY)!;
    expect(r.expiryIso).toBe('2028-12-31');
    expect(r.lot).toBe('L2026A');
    expect(r.serial).toBe('SN0001');
  });

  it('parantezli metin biçimi', () => {
    const r = parseGs1(`(01)${GTIN}(17)270500(10)P-77(21)X1`, TODAY)!;
    expect(r.gtin).toBe(GTIN);
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('P-77');
    expect(r.serial).toBe('X1');
  });

  it('␝ ve <GS> ayırıcıları', () => {
    expect(parseGs1(`01${GTIN}10AB␝21CD`, TODAY)!.serial).toBe('CD');
    expect(parseGs1(`01${GTIN}10AB<GS>21CD`, TODAY)!.lot).toBe('AB');
  });

  it('ayırıcısız dizi: değişken alan sonu sonraki geçerli 17 ile tahmin edilir', () => {
    const r = parseGs1(`01${GTIN}21987654321172705311000AB12`, TODAY)!;
    expect(r.serial).toBe('987654321');
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('00AB12');
    expect(r.ambiguous).toBe(true);
  });

  it('yalnız GTIN + SKT', () => {
    const r = parseGs1(`01${GTIN}17261031`, TODAY)!;
    expect(r.expiryIso).toBe('2026-10-31');
    expect(r.lot).toBeNull();
    expect(r.serial).toBeNull();
  });

  it('GS1 olmayan girdiler null', () => {
    expect(parseGs1(EAN, TODAY)).toBeNull();
    expect(parseGs1('https://tarim.app/ciftci/davet/abc', TODAY)).toBeNull();
    expect(parseGs1('10ABC', TODAY)).toBeNull();
    expect(parseGs1('', TODAY)).toBeNull();
    // GTIN kontrol hanesi bozuk
    expect(parseGs1('010869123456789117270531', TODAY)).toBeNull();
  });

  it('gösterge hanesi 0 olmayan GTIN: ean13 null', () => {
    const r = parseGs1('011869123456789717270531', TODAY)!;
    expect(r.gtin).toBe('18691234567897');
    expect(r.ean13).toBeNull();
  });
});

describe('barcodeFromScan', () => {
  it('karekoddan EAN-13, düz barkoddan kendisi', () => {
    expect(barcodeFromScan(`]d201${GTIN}17270531`)).toBe(EAN);
    expect(barcodeFromScan(EAN)).toBe(EAN);
  });
});

describe('USB okuyucu / elle giriş varyantları (Y3)', () => {
  // Testçinin okuttuğu kutu: (01)08690001003333(17)270500(10)LOT1(21)A1
  const BOX = '08690001003333';

  it('parantezli biçimden SKT (17) ve parti (10) çıkar — gün 00 = ay sonu', () => {
    const r = parseGs1(`(01)${BOX}(17)270500(10)LOT1(21)A1`, TODAY)!;
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('LOT1');
    expect(r.serial).toBe('A1');
  });

  it(']d2 / ]C1 önekli, GS (0x1D) ayırıcılı dizi', () => {
    for (const prefix of [']d2', ']C1', ']Q3', `${GS}]d2`, `]d2${GS}`]) {
      const r = parseGs1(`${prefix}01${BOX}17270500` + `10LOT1${GS}21A1`, TODAY)!;
      expect(r.expiryIso, prefix).toBe('2027-05-31');
      expect(r.lot, prefix).toBe('LOT1');
      expect(r.serial, prefix).toBe('A1');
    }
  });

  it('ayırıcısız dizi, sabit uzunluklu AI sırası 01-17-10 (seri yok)', () => {
    const r = parseGs1(`01${BOX}1727050010LOT1`, TODAY)!;
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('LOT1');
  });

  it('ayırıcısız İTS sırası 01-21-17-10: SKT tahminle bulunur', () => {
    const r = parseGs1(`01${BOX}21A11727050010LOT1`, TODAY)!;
    expect(r.serial).toBe('A1');
    expect(r.expiryIso).toBe('2027-05-31');
    expect(r.lot).toBe('LOT1');
  });

  it('metin ayırıcı ayarları: [GS] {GS} <FNC1>', () => {
    for (const sep of ['[GS]', '{GS}', '<FNC1>', '[FNC1]']) {
      const r = parseGs1(`01${BOX}10LOT1${sep}21A1${sep}17270500`, TODAY)!;
      expect(r.lot, sep).toBe('LOT1');
      expect(r.serial, sep).toBe('A1');
      expect(r.expiryIso, sep).toBe('2027-05-31');
    }
  });

  it('sondaki Enter / Tab atılır', () => {
    expect(parseGs1(`01${BOX}17270500\r\n`, TODAY)!.expiryIso).toBe('2027-05-31');
    expect(parseGs1(`01${BOX}17270500\t`, TODAY)!.expiryIso).toBe('2027-05-31');
  });

  it('scanResultFromText kamera ile aynı alanları verir', () => {
    const r = scanResultFromText(`(01)${BOX}(17)270500(10)LOT1(21)A1`, TODAY);
    expect(r.source).toBe('manual');
    expect(r.code).toBe(`01${BOX}1727050010LOT121A1`);
    expect(r.gs1?.expiryIso).toBe('2027-05-31');
    expect(r.gs1?.lot).toBe('LOT1');
    expect(r.gs1?.ean13).toBe('8690001003333');
    const plain = scanResultFromText(' 8690001003333 ', TODAY);
    expect(plain.gs1).toBeNull();
    expect(plain.code).toBe('8690001003333');
  });

  it('isGsKey: Ctrl+] ve GS karakteri', () => {
    const k = (o: Partial<KeyboardEvent>) => ({ key: '', code: '', ctrlKey: false, altKey: false, metaKey: false, ...o });
    expect(isGsKey(k({ ctrlKey: true, code: 'BracketRight', key: 'ü' }))).toBe(true);
    expect(isGsKey(k({ ctrlKey: true, key: ']' }))).toBe(true);
    expect(isGsKey(k({ key: GS }))).toBe(true);
    expect(isGsKey(k({ key: ']' }))).toBe(false);
    expect(isGsKey(k({ ctrlKey: true, key: 'c', code: 'KeyC' }))).toBe(false);
  });
});
