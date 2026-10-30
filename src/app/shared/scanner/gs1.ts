/**
 * GS1 eleman dizisi çözümleyici — karekod (GS1 DataMatrix), GS1-128 ve parantezli metin biçimi.
 *
 * Türkiye BKÜ karekod kılavuzu (Tarım ve Orman Bak., GKGM "Bitki Koruma Ürünleri Karekod Uygulama Kılavuzu"):
 *   (01) GTIN-14 · (21) sıra no ≤20 · (17) SKT YYAAGG · (10) şarj/parti no ≤20; seri/parti yalnız 0-9 A-Z.
 *   EAN-13 barkodun başına "0" eklenerek GTIN-14 oluşur. İlaçta (İTS) sıra genelde 01-21-17-10.
 *
 * Desteklenen girdiler:
 *  - `]d2` / `]C1` / `]Q3` / `]e0` AIM simge öneki (okuyucuya göre başta olabilir),
 *  - FNC1 ayırıcı olarak GS (0x1D), "␝" (U+241D) ya da metin olarak `<GS>` / `[GS]` / `{GS}` / `<FNC1>` / `[FNC1]`
 *    (USB okuyucuların "GS yerine metin gönder" ayarları; klavyede Ctrl+] gelen GS'yi Gs1KeysDirective yazar),
 *  - parantezli insan-okur biçim: `(01)08691234567890(17)270531(10)ABC(21)XYZ`,
 *  - ayırıcısız düz dizi (USB okuyucu GS'yi yutmuş): değişken alanın sonu, kalan kısmın geçerli AI'larla
 *    (GTIN kontrol hanesi, geçerli tarih) tam çözülebildiği ilk noktadan tahmin edilir → `ambiguous: true`.
 */

export const GS = '\u001d';

/** Sabit uzunluklu (veri uzunluğu) ve bilinen değişken uzunluklu AI'lar */
const FIXED: Record<string, number> = {
  '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
};
const VARIABLE_MAX: Record<string, number> = {
  '10': 20, '21': 20, '22': 20, '240': 30, '241': 30, '30': 8, '37': 8, '90': 30, '91': 90, '92': 90,
  '93': 90, '94': 90, '95': 90, '96': 90, '97': 90, '98': 90, '99': 90, '710': 20, '711': 20, '712': 20, '713': 20,
};
/** Ayırıcısız dizide alan sınırı tahmininde aday olarak kabul edilen AI'lar (yanlış bölünmeyi azaltır) */
const GUESS_AIS = new Set(['01', '10', '11', '15', '17', '21']);

/** Bir AI'nın başta nasıl tanınacağı: önce 3 haneli, sonra 2 haneli */
function matchAi(s: string, i: number): string | null {
  const three = s.slice(i, i + 3);
  if (three.length === 3 && VARIABLE_MAX[three] != null) return three;
  const two = s.slice(i, i + 2);
  if (two.length === 2 && (FIXED[two] != null || VARIABLE_MAX[two] != null)) return two;
  return null;
}

export interface Gs1Data {
  /** AI → değer (ilk geçen) */
  ais: Record<string, string>;
  /** (01) GTIN-14 */
  gtin: string | null;
  /** GTIN-14 → EAN-13 (gösterge hanesi 0 ise başındaki 0 atılır), değilse null */
  ean13: string | null;
  /** (17) SKT — yerel gece yarısı */
  expiry: Date | null;
  /** (17) ISO `YYYY-MM-DD` */
  expiryIso: string | null;
  /** (10) parti / şarj no */
  lot: string | null;
  /** (21) seri / sıra no */
  serial: string | null;
  /** Ayırıcısız dizide alan sınırı tahmin edildi */
  ambiguous: boolean;
}

/** AIM simge önekini ve baştaki FNC1'i at, GS benzerlerini 0x1D'ye çevir */
export function normalizeGs1Raw(raw: string): string {
  let s = (raw ?? '').replace(/[\r\n\t]+$/, '');
  s = s.replace(/^\s+|\s+$/g, '');
  s = s.replace(/<GS>|\[GS\]|\{GS\}/gi, GS).replace(/␝/g, GS).replace(/\[FNC1\]|<FNC1>|\{FNC1\}/gi, GS);
  // Başta FNC1/GS ve AIM simge öneki (]d2 DataMatrix, ]C1 GS1-128, ]Q3 QR, ]e0 DataBar) hangi sırayla gelirse gelsin
  while (s.startsWith(GS)) s = s.slice(1);
  s = s.replace(/^\][A-Za-z]\d/, '');
  while (s.startsWith(GS)) s = s.slice(1);
  while (s.endsWith(GS)) s = s.slice(0, -1);
  return s;
}

/**
 * GTS (birim karekodu) için kanonik metin: AIM öneki ve GS ayırıcıları atılmış, kırpılmış.
 * USB okuyucular GS'yi çoğu zaman göndermez; kamera gönderir. Karşılaştırma ve kayıt bu biçimle yapılır.
 * Parantezli biçim de düz diziye çevrilir.
 */
export function canonicalGts(raw: string): string {
  const s = normalizeGs1Raw(raw);
  if (s.startsWith('(')) {
    const parsed = parseParenthesized(s);
    if (parsed) return parsed.map(([ai, v]) => ai + v).join('');
  }
  return s.split(GS).join('').trim();
}

/** GTIN (8/12/13/14) mod-10 kontrol hanesi geçerli mi */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-14 → EAN-13 (yalnız gösterge hanesi 0 iken) */
export function gtin14ToEan13(gtin: string): string | null {
  if (!/^\d{14}$/.test(gtin)) return null;
  return gtin.startsWith('0') ? gtin.slice(1) : null;
}

/** Ürün barkodu (EAN-8/13, UPC-A, GTIN-14) ile karekoddaki GTIN aynı ürünü mü gösteriyor? Baştaki sıfırlar önemsiz. */
export function gtinMatches(barcode: string | null | undefined, gtin: string | null | undefined): boolean {
  const a = (barcode ?? '').trim();
  const b = (gtin ?? '').trim();
  if (!/^\d{8,14}$/.test(a) || !/^\d{8,14}$/.test(b)) return false;
  return a.padStart(14, '0') === b.padStart(14, '0');
}

/**
 * GS1 YYMMDD → Date. Gün 00 = ayın son günü. Yüzyıl GS1 Genel Spesifikasyon 7.12 kayan penceresiyle:
 * (YY − bu yılın YY'si) 51..99 → önceki yüzyıl, −99..−50 → sonraki yüzyıl.
 */
export function parseGs1Date(yymmdd: string, today: Date = new Date()): Date | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = +yymmdd.slice(0, 2);
  const mm = +yymmdd.slice(2, 4);
  const dd = +yymmdd.slice(4, 6);
  if (mm < 1 || mm > 12) return null;
  const cur = today.getFullYear();
  const curCentury = Math.floor(cur / 100) * 100;
  const diff = yy - (cur % 100);
  let year = curCentury + yy;
  if (diff >= 51) year -= 100;
  else if (diff <= -50) year += 100;
  const lastDay = new Date(year, mm, 0).getDate();
  const day = dd === 0 ? lastDay : dd;
  if (day > lastDay) return null;
  return new Date(year, mm - 1, day);
}

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Sabit uzunluklu alan değeri geçerli mi (GTIN kontrol hanesi, tarih) */
function fixedValueValid(ai: string, v: string): boolean {
  if (!/^\d+$/.test(v)) return false;
  if (ai === '01' || ai === '02') return isValidGtin(v);
  if (['11', '12', '13', '15', '16', '17'].includes(ai)) return parseGs1Date(v) !== null;
  return true;
}

function parseParenthesized(s: string): [string, string][] | null {
  const re = /\((\d{2,4})\)([^(]*)/g;
  const out: [string, string][] = [];
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(s))) {
    if (m.index !== consumed) return null;
    out.push([m[1], m[2].replace(new RegExp(GS, 'g'), '').trim()]);
    consumed = re.lastIndex;
  }
  return out.length && consumed === s.length ? out : null;
}

/**
 * Ayırıcısız/ayırıcılı düz diziyi çöz. Değişken alan GS'ye ya da dizinin sonuna kadar sürer;
 * GS yoksa kalan kısmın tamamen çözülebildiği en kısa bölünme denenir (ambiguous işaretlenir).
 */
function parseElementString(s: string): { pairs: [string, string][]; ambiguous: boolean } | null {
  const hasGs = s.includes(GS);
  let ambiguous = false;

  const walk = (i: number, seen: Set<string>, depth: number): [string, string][] | null => {
    if (i === s.length) return [];
    if (s[i] === GS) return walk(i + 1, seen, depth);
    const ai = matchAi(s, i);
    if (!ai) return null;
    const start = i + ai.length;
    const fixed = FIXED[ai];
    if (fixed != null) {
      const v = s.slice(start, start + fixed);
      if (v.length !== fixed || !fixedValueValid(ai, v)) return null;
      const rest = walk(start + fixed, new Set(seen).add(ai), depth);
      return rest ? [[ai, v], ...rest] : null;
    }
    const max = VARIABLE_MAX[ai];
    const gsAt = s.indexOf(GS, start);
    const hardEnd = gsAt === -1 ? s.length : gsAt;
    if (hasGs || hardEnd - start <= 0) {
      const v = s.slice(start, hardEnd);
      if (!v || v.length > max) return null;
      const rest = walk(hardEnd, new Set(seen).add(ai), depth);
      return rest ? [[ai, v], ...rest] : null;
    }
    // GS yok: değişken alanın sonunu tahmin et — kalan kısım geçerli + daha önce görülmemiş AI'larla
    // tamamen çözülmeli ve en az bir sabit/doğrulanabilir alan (01/17) içermeli.
    if (depth < 4) {
      for (let end = start + 1; end < Math.min(hardEnd, start + max + 1); end++) {
        const nextAi = matchAi(s, end);
        if (!nextAi || !GUESS_AIS.has(nextAi) || seen.has(nextAi) || nextAi === ai) continue;
        const rest = walk(end, new Set(seen).add(ai), depth + 1);
        if (rest && rest.some(([a]) => FIXED[a] != null)) {
          ambiguous = true;
          return [[ai, s.slice(start, end)], ...rest];
        }
      }
    }
    const v = s.slice(start, hardEnd);
    if (!v || v.length > max) return null;
    return [[ai, v]];
  };

  const pairs = walk(0, new Set(), 0);
  return pairs && pairs.length ? { pairs, ambiguous } : null;
}

/**
 * GS1 eleman dizisini çöz. GS1 değilse (düz EAN, URL, serbest metin) `null`.
 * Yalnız 13 haneli EAN gibi tek başına bir GTIN GS1 dizisi sayılmaz.
 */
export function parseGs1(raw: string, today: Date = new Date()): Gs1Data | null {
  if (!raw) return null;
  const s = normalizeGs1Raw(raw);
  if (s.length < 4) return null;

  let pairs: [string, string][] | null = null;
  let ambiguous = false;
  if (s.startsWith('(')) {
    pairs = parseParenthesized(s);
  } else if (/^\d{2}/.test(s)) {
    const r = parseElementString(s);
    if (r) { pairs = r.pairs; ambiguous = r.ambiguous; }
  }
  if (!pairs) return null;

  const ais: Record<string, string> = {};
  for (const [ai, v] of pairs) if (ais[ai] == null) ais[ai] = v;
  // Tek başına kısa bir alan (ör. "10ABC") karekod sayılmasın: en az 01 ya da iki AI gerekir.
  if (ais['01'] == null && pairs.length < 2) return null;

  const gtin = ais['01'] ?? null;
  if (gtin != null && !isValidGtin(gtin)) return null;
  const expiry = ais['17'] ? parseGs1Date(ais['17'], today) : null;
  return {
    ais,
    gtin,
    ean13: gtin ? gtin14ToEan13(gtin) : null,
    expiry,
    expiryIso: expiry ? toIso(expiry) : null,
    lot: ais['10'] ?? null,
    serial: ais['21'] ?? null,
    ambiguous,
  };
}

/** Okunan kodun ürün barkodu olarak kullanılacak hâli: karekodsa EAN-13 (yoksa GTIN-14), değilse metnin kendisi */
export function barcodeFromScan(raw: string): string {
  const g = parseGs1(raw);
  if (g?.gtin) return g.ean13 ?? g.gtin;
  return canonicalGts(raw);
}
