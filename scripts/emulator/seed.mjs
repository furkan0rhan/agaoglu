#!/usr/bin/env node
/**
 * Firebase Emulator'e demo verisi yükler (canlı projeye ASLA yazmaz).
 *
 *   npm run emu        # ayrı terminalde emulator'ler açık olmalı
 *   npm run emu:seed   # bu script: önce emulator'ü temizler, sonra yükler (idempotent)
 *
 * Ortam: FIRESTORE_EMULATOR_HOST (varsayılan 127.0.0.1:8080), FIREBASE_AUTH_EMULATOR_HOST
 * (varsayılan 127.0.0.1:9099), proje kimliği demo-tarim-market. Rastgelelik sabit tohumlu:
 * her çalıştırmada aynı veri (tarihler bugüne göre kayar).
 *
 * Ayrıntı ve hesap listesi: docs/TEST-ORTAMI.md
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Ortam + güvenlik
// ---------------------------------------------------------------------------
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-tarim-market';
// GCE metadata sunucusu aranmasın (aksi halde firebase-admin ~2 dk zaman aşımı bekler)
process.env.METADATA_SERVER_DETECTION = 'none';
process.env.GOOGLE_CLOUD_PROJECT ||= PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (!PROJECT_ID.startsWith('demo-')) {
  console.error(`Güvenlik: proje kimliği "demo-" ile başlamalı (şu an: ${PROJECT_ID}). Seed yalnız emulator içindir.`);
  process.exit(1);
}
if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(FS_HOST) || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(AUTH_HOST)) {
  console.error('Güvenlik: emulator adresleri yerel olmalı (127.0.0.1 / localhost).');
  process.exit(1);
}

async function assertEmulatorsUp() {
  for (const [name, url] of [['Firestore', `http://${FS_HOST}/`], ['Auth', `http://${AUTH_HOST}/`]]) {
    try {
      await fetch(url);
    } catch {
      console.error(`${name} emulator'üne ulaşılamadı (${url}). Önce başka bir terminalde: npm run emu`);
      process.exit(1);
    }
  }
}

async function clearEmulators() {
  const r1 = await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  const r2 = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  if (!r1.ok || !r2.ok) throw new Error(`Emulator temizlenemedi (firestore ${r1.status}, auth ${r2.status})`);
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
/** Sabit tohumlu PRNG (mulberry32) — her çalıştırmada aynı veri */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261027);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = arr => arr[Math.floor(rand() * arr.length)];
const chance = p => rand() < p;
const round2 = n => Math.round(n * 100) / 100;
const roundQty = n => Math.round(n * 1000) / 1000;
const DAY = 86_400_000;
const NOW = Date.now();
const ts = ms => Timestamp.fromMillis(Math.round(ms));
const daysFromNow = d => ts(NOW + d * DAY);
let idSeq = 0;
const newId = prefix => `${prefix}${String(++idSeq).padStart(4, '0')}`;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = n => Array.from({ length: n }, () => pick(CODE_CHARS)).join('');

/** Belirli gün önce, saat aralığında bir an (bugün ise şimdiden önce) */
function momentDaysAgo(daysAgo, fromHour = 8, toHour = 19) {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(randInt(fromHour, toHour - 1), randInt(0, 59), randInt(0, 59), 0);
  let ms = d.getTime();
  if (ms > NOW - 5 * 60_000) ms = NOW - randInt(10, 120) * 60_000;
  return ms;
}

function ean13(body12) {
  const sum = body12.split('').reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return body12 + ((10 - (sum % 10)) % 10);
}

function saleNumber(ms, uid) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  const u = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  return `S-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${u}-${code(3)}`;
}

// ---------------------------------------------------------------------------
// Hesaplar
// ---------------------------------------------------------------------------
const PASSWORD = 'Test1234!';
const U = {
  admin: { uid: 'agaoglu-admin', email: 'admin@test.local', displayName: 'Mehmet Ağaoğlu' },
  cashier: { uid: 'agaoglu-kasiyer', email: 'kasiyer@test.local', displayName: 'Ayşe Demir' },
  staff: { uid: 'agaoglu-personel', email: 'personel@test.local', displayName: 'Hasan Çelik' },
  admin2: { uid: 'yesilvadi-admin', email: 'admin2@test.local', displayName: 'Zeynep Yıldız' },
  super: { uid: 'platform-super', email: 'super@test.local', displayName: 'Platform Destek' },
  farmer: { uid: 'ciftci-demo', email: 'ciftci@test.local', displayName: 'Ali Yılmaz' },
};
const TENANT_A = U.admin.uid;
const TENANT_B = U.admin2.uid;
const FARMER_ID = 'farmer-ali-yilmaz';

// ---------------------------------------------------------------------------
// Yazma kuyruğu (500'lük batch sınırı)
// ---------------------------------------------------------------------------
const writes = [];
const put = (path, data) => writes.push([path, data]);

async function flush(db) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const [p, data] of writes.slice(i, i + 400)) batch.set(db.doc(p), data);
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// Ürün kataloğu
// [ad, kategori, tür, birim, alış, satış, minStok, marka, KDV, seçenekler]
//   gts: partiler GTS'li · near: SKT'si 30 gün içinde dolan parti · expired: SKT'si geçmiş parti
//   critical: dönem sonunda kritik stokta · noBarcode · rx: { licenseNo, activeIngredient, phiDays }
// ---------------------------------------------------------------------------
const CATALOG = [
  ['Üre %46 Azotlu Gübre 50 kg', 'Gübre', 'gubre', 'cuval', 820, 950, 20, 'Anadolu Gübre', 1, {}],
  ['DAP 18-46-0 50 kg', 'Gübre', 'gubre', 'cuval', 1450, 1650, 15, 'Anadolu Gübre', 1, {}],
  ['Amonyum Sülfat %21 50 kg', 'Gübre', 'gubre', 'cuval', 520, 610, 15, 'Ege Gübre', 1, {}],
  ['CAN %26 Kalsiyum Amonyum Nitrat 50 kg', 'Gübre', 'gubre', 'cuval', 640, 740, 20, 'Ege Gübre', 1, { critical: true }],
  ['15-15-15 Kompoze Gübre 50 kg', 'Gübre', 'gubre', 'cuval', 900, 1040, 15, 'Anadolu Gübre', 1, {}],
  ['Potasyum Nitrat 25 kg', 'Gübre', 'gubre', 'cuval', 1350, 1550, 8, 'Akdeniz Kimya', 1, {}],
  ['Sıvı Hümik Asit (dökme)', 'Gübre', 'gubre', 'lt', 45, 60, 40, 'Toprak Plus', 1, { gts: false }],
  ['Yaprak Gübresi Çinko + Bor 1 lt', 'Gübre', 'gubre', 'adet', 210, 270, 10, 'Toprak Plus', 1, { gts: true, near: true }],
  ['Organik Solucan Gübresi (dökme)', 'Gübre', 'gubre', 'kg', 12, 18, 100, 'Yeşil Toprak', 1, {}],
  ['Abamectin 18 g/l EC 1 lt', 'Zirai İlaç', 'bitki_koruma', 'adet', 520, 650, 6, 'AgroKoru', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2019-0412', activeIngredient: 'Abamectin 18 g/l', phiDays: 7 } }],
  ['Glifosat 480 g/l SL 5 lt', 'Zirai İlaç', 'bitki_koruma', 'adet', 980, 1180, 5, 'Herba', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2016-1180', activeIngredient: 'Glifosat izopropilamin tuzu 480 g/l', phiDays: null } }],
  ['Deltamethrin 25 g/l EC 250 ml', 'Zirai İlaç', 'bitki_koruma', 'adet', 160, 210, 10, 'AgroKoru', 20,
    { gts: true, expired: true, rx: { licenseNo: 'BKÜ-2014-0877', activeIngredient: 'Deltamethrin 25 g/l', phiDays: 3 } }],
  ['Imidacloprid 350 SC 100 ml', 'Zirai İlaç', 'bitki_koruma', 'adet', 140, 185, 12, 'Koruma Kimya', 20,
    { gts: true, near: true, rx: { licenseNo: 'BKÜ-2012-0533', activeIngredient: 'Imidacloprid 350 g/l', phiDays: 14 } }],
  ['Mankozeb %80 WP 1 kg', 'Zirai İlaç', 'bitki_koruma', 'adet', 260, 330, 10, 'Koruma Kimya', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2010-0291', activeIngredient: 'Mankozeb %80', phiDays: 14 } }],
  ['Bakır Oksiklorür %50 WP 1 kg', 'Zirai İlaç', 'bitki_koruma', 'adet', 210, 275, 10, 'Koruma Kimya', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2011-0350', activeIngredient: 'Bakır oksiklorür %50', phiDays: 7 } }],
  ['Kükürt %80 WG 5 kg', 'Zirai İlaç', 'bitki_koruma', 'adet', 340, 430, 8, 'Herba', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2015-0702', activeIngredient: 'Kükürt %80', phiDays: 1 } }],
  ['Azoxystrobin 250 SC 500 ml', 'Zirai İlaç', 'bitki_koruma', 'adet', 690, 850, 6, 'AgroKoru', 20,
    { gts: true, critical: true, rx: { licenseNo: 'BKÜ-2018-0921', activeIngredient: 'Azoxystrobin 250 g/l', phiDays: 3 } }],
  ['Lambda-cyhalothrin 50 g/l EC 1 lt', 'Zirai İlaç', 'bitki_koruma', 'adet', 480, 600, 6, 'Herba', 20,
    { gts: true, near: true, rx: { licenseNo: 'BKÜ-2013-0615', activeIngredient: 'Lambda-cyhalothrin 50 g/l', phiDays: 7 } }],
  ['Spinosad 480 SC 100 ml', 'Zirai İlaç', 'bitki_koruma', 'adet', 450, 560, 6, 'AgroKoru', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2017-0488', activeIngredient: 'Spinosad 480 g/l', phiDays: 3 } }],
  ['Fosetil-Al %80 WG 1 kg', 'Zirai İlaç', 'bitki_koruma', 'adet', 520, 650, 6, 'Koruma Kimya', 20,
    { gts: true, expired: true, rx: { licenseNo: 'BKÜ-2016-0740', activeIngredient: 'Fosetil-Al %80', phiDays: 14 } }],
  ['Pendimethalin 330 EC 5 lt', 'Zirai İlaç', 'bitki_koruma', 'adet', 1250, 1500, 4, 'Herba', 20,
    { gts: true, rx: { licenseNo: 'BKÜ-2012-0199', activeIngredient: 'Pendimethalin 330 g/l', phiDays: null } }],
  ['Domates Tohumu F1 1000 tane', 'Tohum', 'tohum', 'paket', 950, 1200, 5, 'Yayla Tohum', 1, { gts: true }],
  ['Hıyar Tohumu F1 500 tane', 'Tohum', 'tohum', 'paket', 780, 980, 5, 'Yayla Tohum', 1, { gts: true, near: true }],
  ['Biber Tohumu Çarliston 1000 tane', 'Tohum', 'tohum', 'paket', 620, 790, 5, 'Yayla Tohum', 1, { gts: true }],
  ['Buğday Tohumu Sertifikalı (dökme)', 'Tohum', 'tohum', 'kg', 14, 17.5, 500, 'Trakya Tohumculuk', 1, { gts: true }],
  ['Mısır Tohumu Hibrit 25.000 tane', 'Tohum', 'tohum', 'paket', 2850, 3300, 6, 'Trakya Tohumculuk', 1, { gts: true, critical: true }],
  ['Ayçiçeği Tohumu Hibrit 150.000 tane', 'Tohum', 'tohum', 'paket', 2400, 2850, 4, 'Trakya Tohumculuk', 1, { gts: true }],
  ['Domates Fidesi (aşılı)', 'Fide', 'fide', 'adet', 9, 14, 200, null, 1, { noBarcode: true }],
  ['Biber Fidesi', 'Fide', 'fide', 'adet', 4.5, 7, 300, null, 1, { noBarcode: true }],
  ['Patlıcan Fidesi', 'Fide', 'fide', 'adet', 5, 8, 200, null, 1, {}],
  ['Çilek Fidesi Frigo', 'Fide', 'fide', 'adet', 3, 5.5, 300, null, 1, { critical: true }],
  ['Damla Sulama Borusu 16 mm', 'Sulama', 'diger', 'metre', 3.2, 4.75, 1000, 'Akdeniz Sulama', 20, {}],
  ['Lay Flat Hortum 3"', 'Sulama', 'diger', 'metre', 28, 38, 100, 'Akdeniz Sulama', 20, {}],
  ['Disk Filtre 2"', 'Sulama', 'diger', 'adet', 1150, 1450, 3, 'Akdeniz Sulama', 20, {}],
  ['Mini Vana 16 mm', 'Sulama', 'diger', 'adet', 6, 10, 100, 'Akdeniz Sulama', 20, {}],
  ['Gübre Tankı 60 lt', 'Sulama', 'diger', 'adet', 2900, 3500, 2, 'Akdeniz Sulama', 20, { critical: true }],
  ['Akülü Sırt Pülverizatörü 16 lt', 'Hırdavat', 'diger', 'adet', 1650, 2100, 3, 'Bahçe Pro', 20, {}],
  ['Budama Makası', 'Hırdavat', 'diger', 'adet', 380, 520, 5, 'Bahçe Pro', 20, {}],
  ['Saplı Çapa', 'Hırdavat', 'diger', 'adet', 260, 350, 5, 'Bahçe Pro', 20, {}],
  ['Nitril Koruyucu Eldiven (12 çift)', 'Hırdavat', 'diger', 'paket', 95, 140, 10, 'Bahçe Pro', 20, {}],
];

/** Kategori → varsayılan tedarikçi (A işletmesi) */
const SUPPLIERS_A = [
  { key: 'gubre', name: 'Ege Gübre Dağıtım A.Ş.', contactPerson: 'Serkan Aydın', phone: '0232 455 12 30', city: 'İzmir', taxNo: '3250147896', cats: ['Gübre'] },
  { key: 'ilac', name: 'Anadolu Zirai İlaç Ltd. Şti.', contactPerson: 'Burcu Koç', phone: '0312 398 44 10', city: 'Ankara', taxNo: '0710254631', cats: ['Zirai İlaç'] },
  { key: 'tohum', name: 'Yayla Tohumculuk ve Fidecilik', contactPerson: 'Kemal Öztürk', phone: '0242 316 77 02', city: 'Antalya', taxNo: '9480012573', cats: ['Tohum', 'Fide'] },
  { key: 'sulama', name: 'Akdeniz Sulama Sistemleri', contactPerson: 'Emre Şahin', phone: '0324 233 90 15', city: 'Mersin', taxNo: '0150368924', cats: ['Sulama'] },
  { key: 'hirdavat', name: 'Özkan Hırdavat Toptan', contactPerson: 'Cengiz Özkan', phone: '0236 712 05 48', city: 'Manisa', taxNo: '6870294155', cats: ['Hırdavat'] },
];

const CUSTOMERS_A = [
  ['Ali', 'Yılmaz', 'Hacıbekir Köyü, Alaşehir / Manisa'],
  ['Mustafa', 'Kaya', 'Killik Mah., Alaşehir / Manisa'],
  ['Hüseyin', 'Demir', 'Badınca Köyü, Sarıgöl / Manisa'],
  ['İbrahim', 'Şahin', 'Yeşilyurt Köyü, Alaşehir / Manisa'],
  ['Osman', 'Çelik', 'Piyadeler Köyü, Alaşehir / Manisa'],
  ['Ramazan', 'Arslan', 'Gümüşçay Köyü, Sarıgöl / Manisa'],
  ['Halil', 'Koç', 'Karaköy, Salihli / Manisa'],
  ['Süleyman', 'Kurt', 'Kavaklıdere, Alaşehir / Manisa'],
  ['Fatma', 'Aydın', 'Sarıpınar Köyü, Alaşehir / Manisa'],
  ['Emine', 'Özdemir', 'Bahadır Köyü, Sarıgöl / Manisa'],
  ['Yusuf', 'Doğan', 'Kestanederesi Köyü, Alaşehir / Manisa'],
  ['Murat', 'Kılıç', 'Çakırcaali Köyü, Alaşehir / Manisa'],
  ['Kadir', 'Aslan', 'Yeniköy, Alaşehir / Manisa'],
  ['Hatice', 'Polat', 'Ilgın Köyü, Sarıgöl / Manisa'],
  ['Cemal', 'Erdoğan', 'Dereköy, Salihli / Manisa'],
];

// ---------------------------------------------------------------------------
// İşletme verisi üreteci (A: tam demo, B: küçük izolasyon verisi)
// ---------------------------------------------------------------------------
function buildTenant({ tenantId, sellers, catalog, suppliers, customers, saleCount, expenseCount, barcodePrefix }) {
  const createdBy = tenantId;
  const openingMs = NOW - 61 * DAY;
  const supplierIds = {};
  for (const s of suppliers) {
    const id = newId('sup');
    supplierIds[s.key] = id;
    put(`suppliers/${id}`, {
      tenantId, name: s.name, contactPerson: s.contactPerson, phone: s.phone,
      email: null, address: `${s.city}`, taxNo: s.taxNo, notes: null, isActive: true,
      createdAt: ts(openingMs - 30 * DAY), updatedAt: ts(openingMs - 30 * DAY),
    });
  }
  const supplierFor = category => {
    const s = suppliers.find(x => x.cats.includes(category));
    return s ? { id: supplierIds[s.key], name: s.name } : null;
  };

  // --- Ürünler (dönem başı durumu) ---
  const products = catalog.map(([name, category, productType, unit, purchasePrice, salePrice, minStock, brand, vatRate, o], i) => {
    const decimal = ['kg', 'lt', 'metre'].includes(unit);
    const opening = o.critical ? Math.round(minStock * 2.2) : Math.round(minStock * (decimal ? 5 : 6) + randInt(5, 20));
    const sup = supplierFor(category);
    const p = {
      id: newId('prd'), name, category, productType, unit, purchasePrice, salePrice, minStock, brand, vatRate, o,
      barcode: o.noBarcode ? '' : ean13(barcodePrefix + String(100000 + i * 37).padStart(9, '0').slice(-9)),
      supplierId: sup?.id ?? null, supplierName: sup?.name ?? null,
      stock: 0, batches: [], movements: [],
    };
    // Açılış partileri: GTS'li ürünlerde 2 parti; SKT'si yakın / geçmiş partiler
    const expires = productType === 'bitki_koruma' || productType === 'tohum' || (productType === 'gubre' && o.gts);
    const lots = [];
    if (o.expired) lots.push({ qty: randInt(2, 4), exp: -randInt(5, 40) });
    if (o.near) lots.push({ qty: Math.max(2, Math.round(opening * 0.25)), exp: randInt(8, 28) });
    const rest = Math.max(1, opening - lots.reduce((s, l) => s + l.qty, 0));
    lots.push({ qty: rest, exp: randInt(220, 720) });
    for (const l of lots) {
      p.batches.push({
        id: newId('bt'),
        quantity: l.qty,
        expiryDate: expires ? daysFromNow(l.exp) : null,
        gtsNo: o.gts ? `GTS${tenantId.slice(0, 3).toUpperCase()}${randInt(10000000, 99999999)}` : null,
        addedAt: ts(openingMs),
        supplierId: p.supplierId,
      });
    }
    p.stock = p.batches.reduce((s, b) => s + b.quantity, 0);
    p.movements.push({ type: 'in', quantity: p.stock, previousStock: 0, newStock: p.stock, reason: 'Açılış stoğu', reference: null, ms: openingMs, by: createdBy });
    return p;
  });

  const restock = (p, ms, by, expDays = null, qtyOverride = null) => {
    const qty = qtyOverride ?? (p.o.critical ? Math.round(p.minStock) : Math.round(p.minStock * 3 + randInt(2, 10)));
    const expires = p.productType === 'bitki_koruma' || p.productType === 'tohum' || (p.productType === 'gubre' && p.o.gts);
    p.batches.push({
      id: newId('bt'), quantity: qty,
      expiryDate: expires ? daysFromNow(expDays ?? randInt(300, 700)) : null,
      gtsNo: p.o.gts ? `GTS${tenantId.slice(0, 3).toUpperCase()}${randInt(10000000, 99999999)}` : null,
      addedAt: ts(ms), supplierId: p.supplierId,
    });
    p.movements.push({ type: 'in', quantity: qty, previousStock: p.stock, newStock: roundQty(p.stock + qty), reason: `Mal alımı: ${p.supplierName ?? 'Tedarikçi'}`, reference: null, ms, by });
    p.stock = roundQty(p.stock + qty);
  };

  /** FEFO (SKT'si geçmiş partileri atla — gerçek bayi geçmiş ürünü satmaz). Yetmezse hiçbir şeye dokunmaz. */
  const take = (p, qty, ms) => {
    const avail = p.batches.filter(b => b.quantity > 0 && !(b.expiryDate && b.expiryDate.toMillis() < ms))
      .reduce((s, b) => s + b.quantity, 0);
    if (roundQty(avail) < roundQty(qty)) return null;
    const sorted = [...p.batches].sort((a, b) => (a.expiryDate?.toMillis() ?? Infinity) - (b.expiryDate?.toMillis() ?? Infinity));
    const taken = [];
    let left = qty;
    for (const b of sorted) {
      if (left <= 0) break;
      if (b.quantity <= 0) continue;
      if (b.expiryDate && b.expiryDate.toMillis() < ms) continue;
      const q = roundQty(Math.min(b.quantity, left));
      b.quantity = roundQty(b.quantity - q);
      left = roundQty(left - q);
      taken.push({ batchId: b.id, quantity: q, gtsNo: b.gtsNo, expiryDate: b.expiryDate });
    }
    return left <= 0 ? taken : null;
  };

  // --- Müşteriler ---
  const custs = customers.map(([firstName, lastName, address], i) => ({
    id: newId('cus'), firstName, lastName, address,
    phone: `05${pick(['32', '33', '35', '42', '53', '55'])}${randInt(1000000, 9999999)}`,
    tcNo: chance(0.6) ? String(randInt(10000000000, 99999999999)).replace(/^0/, '1') : null,
    totalDebt: 0, totalPaid: 0, balance: 0, txs: [],
    createdMs: NOW - randInt(70, 400) * DAY,
    creditor: i < Math.ceil(customers.length * 0.6), // veresiye çalışan müşteriler
  }));

  // --- Satış simülasyonu ---
  const sales = [];
  const weights = products.map(p => (p.unit === 'cuval' ? 4 : p.productType === 'bitki_koruma' ? 3 : p.productType === 'fide' ? 2 : 1.5));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pickProduct = () => {
    let r = rand() * totalW;
    for (let i = 0; i < products.length; i++) { r -= weights[i]; if (r <= 0) return products[i]; }
    return products[products.length - 1];
  };
  const qtyFor = p => {
    switch (p.unit) {
      case 'cuval': return randInt(1, 8);
      case 'kg': return p.productType === 'tohum' ? randInt(2, 12) * 25 : roundQty(randInt(5, 60) + (chance(0.3) ? 0.5 : 0));
      case 'lt': return roundQty(randInt(2, 20) + (chance(0.4) ? 0.5 : 0));
      case 'metre': return p.salePrice < 10 ? randInt(1, 6) * 100 : randInt(10, 60);
      default: return p.productType === 'fide' ? randInt(2, 30) * 10 : randInt(1, 4);
    }
  };

  const saleDays = Array.from({ length: saleCount }, () => Math.floor(Math.pow(rand(), 1.15) * 60)).sort((a, b) => b - a);
  let restockedMid = false;
  for (const daysAgo of saleDays) {
    const ms = momentDaysAgo(daysAgo);
    if (!restockedMid && daysAgo <= 30) {
      restockedMid = true;
      for (const p of products) if (p.stock < p.minStock * 2 && !p.o.critical) restock(p, ms - 2 * 3600_000, sellers[0]);
    }
    const seller = chance(0.55) ? sellers[1] ?? sellers[0] : sellers[0];
    const lineCount = randInt(1, 4);
    const items = [];
    const used = new Set();
    for (let k = 0; k < lineCount; k++) {
      const p = pickProduct();
      if (used.has(p.id)) continue;
      let qty = qtyFor(p);
      if (qty > p.stock) {
        if (!p.o.critical && p.stock < p.minStock * 3) restock(p, ms - 3600_000, sellers[0]);
        if (qty > p.stock) qty = Math.floor(p.stock * 0.5);
      }
      if (qty <= 0) continue;
      const taken = take(p, qty, ms);
      if (!taken) continue;
      used.add(p.id);
      const discount = chance(0.12) ? pick([5, 10]) : 0;
      const gross = qty * p.salePrice;
      const totalPrice = round2(gross * (1 - discount / 100));
      const item = {
        productId: p.id, productName: p.name, barcode: p.barcode, quantity: roundQty(qty), unit: p.unit,
        unitPrice: p.salePrice, discount, discountType: 'percent', totalPrice, costPrice: p.purchasePrice, batches: taken,
      };
      const gtsNos = taken.map(t => t.gtsNo).filter(Boolean);
      if (gtsNos.length) item.gtsNos = [...new Set(gtsNos)];
      if (p.productType === 'bitki_koruma') {
        item.requiresPrescription = true;
        item.licenseNo = p.o.rx?.licenseNo ?? null;
      }
      items.push({ item, p, prevStock: p.stock });
      p.stock = roundQty(p.stock - qty);
    }
    if (!items.length) continue;

    const subtotal = round2(items.reduce((s, x) => s + x.item.quantity * x.item.unitPrice, 0));
    const itemsDiscount = round2(subtotal - items.reduce((s, x) => s + x.item.totalPrice, 0));
    const afterItems = round2(subtotal - itemsDiscount);
    const globalDiscountAmount = afterItems > 2000 && chance(0.15) ? round2(Math.min(afterItems, afterItems % 100 || 50)) : 0;
    const totalAmount = round2(afterItems - globalDiscountAmount);
    const hasRx = items.some(x => x.item.requiresPrescription);

    // Ödeme şekli
    const r = rand();
    let method = r < 0.45 ? 'cash' : r < 0.7 ? 'card' : r < 0.9 ? 'credit' : 'mixed';
    let customer = null;
    if (method === 'credit' || method === 'mixed' || hasRx || chance(0.35)) {
      customer = method === 'credit' || method === 'mixed' ? pick(custs.filter(c => c.creditor)) : pick(custs);
    }
    let cashPaid = 0, cardPaid = 0, creditAmount = 0, change = 0;
    if (method === 'cash') {
      cashPaid = totalAmount < 500 ? Math.ceil(totalAmount / 50) * 50 : Math.ceil(totalAmount / 100) * 100;
      change = round2(cashPaid - totalAmount);
    } else if (method === 'card') {
      cardPaid = totalAmount;
    } else if (method === 'credit') {
      creditAmount = totalAmount;
    } else {
      cashPaid = round2(Math.floor((totalAmount * (0.3 + rand() * 0.4)) / 50) * 50);
      if (cashPaid <= 0) { method = 'cash'; cashPaid = totalAmount; } else creditAmount = round2(totalAmount - cashPaid);
    }
    const withInterest = method === 'credit' && totalAmount > 3000 && chance(0.35);
    const interestRate = withInterest ? 3 : null;
    const installmentCount = withInterest ? 3 : null;
    const totalWithInterest = withInterest ? round2(creditAmount * (1 + (interestRate / 100) * installmentCount)) : null;
    const installmentAmount = withInterest ? round2(totalWithInterest / installmentCount) : null;

    const id = newId('sal');
    const number = saleNumber(ms, seller);
    const rxNo = hasRx ? `ER${new Date(ms).getFullYear()}${randInt(1000000, 9999999)}` : null;
    if (rxNo) for (const x of items) if (x.item.requiresPrescription) x.item.prescriptionNo = rxNo;

    const sale = {
      tenantId, saleNumber: number,
      customerId: customer?.id ?? null, customerName: customer ? `${customer.firstName} ${customer.lastName}` : null,
      items: items.map(x => x.item),
      subtotal, totalDiscount: round2(itemsDiscount + globalDiscountAmount),
      globalDiscount: globalDiscountAmount, globalDiscountType: 'amount', globalDiscountAmount,
      totalAmount, paymentMethod: method, cashPaid, cardPaid, creditAmount, change,
      status: 'completed', notes: null,
      interestRate, installmentCount, installmentAmount, totalWithInterest,
      createdAt: ts(ms), createdBy: seller, cancelledAt: null, cancelledBy: null, cancelReason: null,
    };
    if (hasRx) {
      Object.assign(sale, {
        hasPrescriptionItems: true, prescriptionNo: rxNo, prescriberName: pick(['Zir. Müh. Selin Acar', 'Zir. Müh. Okan Tekin']),
        customerTcNo: customer?.tcNo ?? null, customerCksNo: null,
      });
    }
    sales.push({ id, ms, sale, items, customer });

    for (const x of items) {
      x.p.movements.push({ type: 'out', quantity: x.item.quantity, previousStock: x.prevStock, newStock: roundQty(x.prevStock - x.item.quantity), reason: `Satış: ${number}`, reference: id, ms, by: seller });
    }
    if (creditAmount > 0 && customer) {
      const debt = totalWithInterest ?? creditAmount;
      customer.txs.push({
        ms, saleId: id, type: 'debt', amount: debt, originalAmount: totalWithInterest != null ? creditAmount : null,
        description: `Satış: ${number} · ${items.map(x => `${x.item.productName} (${x.item.quantity} ${x.item.unit})`).join(', ')}`,
        paymentMethod: null, interestRate, installmentCount, installmentAmount, by: seller,
      });
    }
  }

  // --- İki satış iptali (biri veresiye) ---
  const cancellable = sales.filter(s => s.ms < NOW - 3 * DAY);
  const toCancel = [
    cancellable.find(s => s.sale.paymentMethod === 'credit' && s.sale.totalWithInterest == null),
    cancellable.find(s => s.sale.paymentMethod === 'cash'),
  ].filter(Boolean);
  for (const s of toCancel) {
    const cms = s.ms + randInt(1, 3) * 3600_000;
    const reason = s.sale.paymentMethod === 'credit' ? 'Müşteri ürünü iade etti' : 'Yanlış ürün okutuldu';
    Object.assign(s.sale, { status: 'cancelled', cancelledAt: ts(cms), cancelledBy: tenantId, cancelReason: reason });
    for (const x of s.items) {
      // Partiyi geri yükle (aynı batch id'lerine)
      for (const t of x.item.batches) {
        const b = x.p.batches.find(bb => bb.id === t.batchId);
        if (b) b.quantity = roundQty(b.quantity + t.quantity);
      }
      x.p.movements.push({ type: 'return', quantity: x.item.quantity, previousStock: null, newStock: null, reason: `İptal: ${s.sale.saleNumber}`, reference: s.id, ms: cms, by: tenantId });
      x.p.stock = roundQty(x.p.stock + x.item.quantity);
    }
    if (s.sale.creditAmount > 0 && s.customer) {
      const debt = s.sale.totalWithInterest ?? s.sale.creditAmount;
      s.customer.txs.push({
        ms: cms, saleId: s.id, type: 'debt', amount: -debt, originalAmount: null,
        description: `İptal: ${s.sale.saleNumber} · ${reason}`, paymentMethod: null,
        interestRate: null, installmentCount: null, installmentAmount: null, by: tenantId, isReversal: true,
      });
    }
  }

  // --- Dönem sonu: kritik ürünleri kritik seviyeye çek, diğerleri min üstünde kalsın ---
  for (const p of products) {
    if (p.o.critical) {
      const target = Math.max(0, Math.floor(p.minStock * 0.5));
      if (p.stock > target) {
        const diff = roundQty(p.stock - target);
        const ms = NOW - randInt(1, 2) * DAY;
        take(p, diff, 0);
        p.movements.push({ type: 'out', quantity: diff, previousStock: null, newStock: null, reason: 'Sayım farkı (fire)', reference: null, ms, by: tenantId });
        p.stock = target;
      }
    } else if (p.stock <= p.minStock) {
      restock(p, NOW - randInt(2, 4) * DAY, sellers[0]);
    }
    // SKT'si yakın parti satışla tükendiyse küçük, kısa SKT'li bir parti gelmiş olsun
    const soon = NOW + 30 * DAY;
    if (p.o.near && !p.batches.some(b => b.quantity > 0 && b.expiryDate && b.expiryDate.toMillis() > NOW && b.expiryDate.toMillis() < soon)) {
      restock(p, NOW - randInt(3, 6) * DAY, sellers[0], randInt(10, 25), Math.max(2, Math.round(p.minStock * 0.5)));
    }
  }

  // Stok hareketlerini zaman sırasına göre yeniden hesapla (previousStock/newStock tutarlı olsun)
  for (const p of products) {
    p.movements.sort((a, b) => a.ms - b.ms);
    let running = 0;
    for (const m of p.movements) {
      const prev = running;
      running = roundQty(m.type === 'out' ? running - m.quantity : running + m.quantity);
      m.previousStock = prev;
      m.newStock = running;
    }
    if (Math.abs(running - p.stock) > 0.001) throw new Error(`Stok tutarsız: ${p.name} ${running} != ${p.stock}`);
    const batchSum = roundQty(p.batches.reduce((s, b) => s + b.quantity, 0));
    if (Math.abs(batchSum - p.stock) > 0.001) throw new Error(`Parti toplamı tutarsız: ${p.name} ${batchSum} != ${p.stock}`);
  }

  // --- Tahsilatlar ---
  for (const c of custs) {
    const debts = c.txs.filter(t => t.type === 'debt' && t.amount > 0 && !c.txs.some(r => r.isReversal && r.saleId === t.saleId));
    for (const d of debts) {
      if (!chance(0.55)) continue;
      const ms = Math.min(NOW - 3600_000, d.ms + randInt(3, 25) * DAY);
      if (ms <= d.ms) continue;
      const amount = chance(0.4) ? d.amount : round2(Math.max(100, Math.floor((d.amount * (0.3 + rand() * 0.5)) / 50) * 50));
      c.txs.push({
        ms, saleId: null, type: 'payment', amount: Math.min(amount, d.amount), originalAmount: null,
        description: pick(['Nakit tahsilat', 'Kısmi ödeme', 'Hasat sonrası ödeme', 'Havale ile ödeme']),
        paymentMethod: chance(0.7) ? 'cash' : 'card', interestRate: null, installmentCount: null, installmentAmount: null,
        by: pick(sellers),
      });
    }
  }

  // --- Yazma: ürünler + hareketler ---
  for (const p of products) {
    const live = p.batches.filter(b => b.quantity > 0);
    const nearest = live.map(b => b.expiryDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis())[0] ?? null;
    const doc = {
      tenantId, name: p.name, barcode: p.barcode, purchasePrice: p.purchasePrice, salePrice: p.salePrice,
      stock: p.stock, minStock: p.minStock, category: p.category, brand: p.brand,
      description: null, expiryDate: nearest, vatRate: p.vatRate, unit: p.unit, supplierId: p.supplierId,
      productType: p.productType, requiresPrescription: p.productType === 'bitki_koruma',
      batches: live, imageUrl: null, isActive: true,
      createdAt: ts(NOW - 61 * DAY), updatedAt: ts(p.movements.at(-1).ms), createdBy: tenantId,
    };
    if (p.o.rx) Object.assign(doc, { licenseNo: p.o.rx.licenseNo, activeIngredient: p.o.rx.activeIngredient, phiDays: p.o.rx.phiDays });
    put(`products/${p.id}`, doc);
    for (const m of p.movements) {
      put(`stockMovements/${newId('mov')}`, {
        tenantId, productId: p.id, productName: p.name, type: m.type, quantity: m.quantity,
        previousStock: m.previousStock, newStock: m.newStock, reason: m.reason, reference: m.reference,
        createdAt: ts(m.ms), createdBy: m.by,
      });
    }
  }
  for (const s of sales) put(`sales/${s.id}`, s.sale);

  // --- Müşteriler + veresiye defteri (koşan bakiye) ---
  for (const c of custs) {
    c.txs.sort((a, b) => a.ms - b.ms);
    let balance = 0, totalDebt = 0, totalPaid = 0;
    for (const t of c.txs) {
      if (t.type === 'debt') { balance = round2(balance + t.amount); totalDebt = round2(totalDebt + t.amount); }
      else { balance = round2(balance - t.amount); totalPaid = round2(totalPaid + t.amount); }
      const tx = {
        tenantId, customerId: c.id, customerName: `${c.firstName} ${c.lastName}`, saleId: t.saleId,
        type: t.type, amount: t.amount, description: t.description, paymentMethod: t.paymentMethod,
        balance, originalAmount: t.originalAmount, interestRate: t.interestRate,
        installmentCount: t.installmentCount, installmentAmount: t.installmentAmount,
        createdAt: ts(t.ms), createdBy: t.by,
      };
      if (t.isReversal) tx.isReversal = true;
      put(`creditTransactions/${newId('ctx')}`, tx);
    }
    Object.assign(c, { totalDebt, totalPaid, balance });
    const doc = {
      tenantId, firstName: c.firstName, lastName: c.lastName, tcNo: c.tcNo, phone: c.phone, email: null,
      address: c.address, birthDate: null, notes: c.balance > 20000 ? 'Hasatta ödeme sözü verdi.' : null,
      totalDebt, totalPaid, balance, isActive: true,
      createdAt: ts(c.createdMs), updatedAt: ts(c.txs.at(-1)?.ms ?? c.createdMs),
    };
    if (c.farmerId) doc.farmerId = c.farmerId;
    put(`customers/${c.id}`, doc);
  }

  // --- Giderler ---
  const EXP = [
    ['Dükkan kirası', 'Kira', 18000], ['Elektrik faturası', 'Elektrik', 2350], ['Su faturası', 'Su', 420],
    ['İnternet', 'İnternet', 650], ['Personel maaşı - Ayşe', 'Personel', 22000], ['Nakliye (gübre)', 'Nakliye', 3200],
    ['Soğuk hava deposu bakımı', 'Bakım & Onarım', 1850], ['Muhtasar vergi', 'Vergi', 4100],
    ['Doğalgaz', 'Doğalgaz', 1250], ['Kırtasiye ve fiş rulosu', 'Diğer', 380],
  ].slice(0, expenseCount);
  for (const [title, category, amount] of EXP) {
    const ms = momentDaysAgo(randInt(1, 58), 9, 17);
    put(`expenses/${newId('exp')}`, {
      tenantId, title, amount, category, date: ts(ms), note: null, recurringId: null,
      createdAt: ts(ms), createdBy: tenantId,
    });
  }

  return { products, custs, sales };
}

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------
async function main() {
  await assertEmulatorsUp();
  console.log(`Emulator temizleniyor (${PROJECT_ID})...`);
  await clearEmulators();

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  for (const u of Object.values(U)) {
    await auth.createUser({ uid: u.uid, email: u.email, password: PASSWORD, displayName: u.displayName, emailVerified: true });
  }

  const created = ts(NOW - 400 * DAY);
  const userDoc = (u, tenantId, role) => ({
    tenantId, role, isActive: true, email: u.email, displayName: u.displayName,
    accountType: 'business', createdAt: created, lastLogin: ts(NOW - randInt(1, 48) * 3600_000),
  });
  put(`users/${U.admin.uid}`, { ...userDoc(U.admin, TENANT_A, 'admin'), canPrescribe: true, prescriberLicenseNo: 'BKU-REC-45-0123' }); // çiftçi modülü: öneri yetkilisi
  put(`users/${U.cashier.uid}`, userDoc(U.cashier, TENANT_A, 'cashier'));
  put(`users/${U.staff.uid}`, userDoc(U.staff, TENANT_A, 'staff'));
  put(`users/${U.admin2.uid}`, userDoc(U.admin2, TENANT_B, 'admin'));
  // Superadmin: users dokümanı YOK (auth.service işletmeye bağlamaz), yalnız platformAdmins
  put(`platformAdmins/${U.super.uid}`, { createdAt: created, email: U.super.email, note: 'Emulator test superadmin' });

  put(`tenants/${TENANT_A}`, {
    name: 'Ağaoğlu Tarım', ownerId: TENANT_A, createdAt: created,
    address: 'Cumhuriyet Mah. Atatürk Cad. No: 42, Alaşehir / Manisa', phone: '0236 654 12 34',
    taxOffice: 'Alaşehir', taxNo: '0123456789', receiptFooter: 'Bereketli hasatlar dileriz!',
    plan: 'pro', status: 'active', trialEndsAt: null, licenseExpiresAt: daysFromNow(300), maxUsers: 10,
    supportAccess: true, lastActiveAt: ts(NOW - 3600_000),
  });
  put(`tenants/${TENANT_B}`, {
    name: 'Yeşil Vadi Zirai', ownerId: TENANT_B, createdAt: ts(NOW - 20 * DAY),
    address: 'İstasyon Cad. No: 7, Salihli / Manisa', phone: '0236 713 45 67',
    taxOffice: 'Salihli', taxNo: '9876543210', receiptFooter: 'Teşekkür ederiz.',
    plan: 'trial', status: 'active', trialEndsAt: daysFromNow(10), licenseExpiresAt: null, maxUsers: 3,
    supportAccess: true, lastActiveAt: ts(NOW - 2 * DAY),
  });

  const A = buildTenant({
    tenantId: TENANT_A, sellers: [U.admin.uid, U.cashier.uid], catalog: CATALOG, suppliers: SUPPLIERS_A,
    customers: CUSTOMERS_A, saleCount: 150, expenseCount: 10, barcodePrefix: '869',
  });
  const B = buildTenant({
    tenantId: TENANT_B, sellers: [U.admin2.uid], catalog: CATALOG.filter((_, i) => [0, 1, 9, 21, 31].includes(i)),
    suppliers: SUPPLIERS_A.slice(0, 2), customers: [['Recep', 'Güneş', 'Durasıllı, Salihli / Manisa'], ['Nuri', 'Taş', 'Gökeyüp, Salihli / Manisa'], ['Sevgi', 'Bulut', 'Poyraz, Salihli / Manisa']],
    saleCount: 8, expenseCount: 2, barcodePrefix: '868',
  });

  // --- Çiftçi hesabı (docs/CIFTCI-MODULU.md §5.2) — A'nın ilk müşterisine (Ali Yılmaz) bağlı ---
  const linkedCustomer = A.custs[0];
  put(`users/${U.farmer.uid}`, {
    accountType: 'farmer', tenantId: null, role: null, farmerId: FARMER_ID, isActive: true,
    email: U.farmer.email, displayName: U.farmer.displayName, canPrescribe: false, prescriberLicenseNo: null,
    createdAt: ts(NOW - 30 * DAY), lastLogin: ts(NOW - 5 * 3600_000),
  });
  put(`farmers/${FARMER_ID}`, {
    ownerUids: [U.farmer.uid], displayName: U.farmer.displayName, phone: '905321112233',
    city: 'Manisa', district: 'Alaşehir', village: 'Hacıbekir', cksNo: null, language: 'tr',
    createdAt: ts(NOW - 30 * DAY), updatedAt: ts(NOW - 30 * DAY),
  });
  put(`farmerLinks/${TENANT_A}_${FARMER_ID}`, {
    tenantId: TENANT_A, farmerId: FARMER_ID, customerId: linkedCustomer.id, inviteCode: 'DEMO42',
    status: 'active',
    consent: { purchases: true, fields: true, logs: false, notifications: true, textVersion: 'v1', grantedAt: ts(NOW - 30 * DAY), updatedAt: ts(NOW - 30 * DAY) },
    balanceSnapshot: linkedCustomer.balance, balance: linkedCustomer.balance, balanceUpdatedAt: ts(NOW - DAY), farmerName: U.farmer.displayName, nextDueDate: null, tenantName: 'Ağaoğlu Tarım', createdAt: ts(NOW - 30 * DAY),
  });
  put(`fields/${newId('fld')}`, {
    farmerId: FARMER_ID, name: 'Dere kenarı bağ', areaDecare: 18, city: 'Manisa', district: 'Alaşehir', village: 'Hacıbekir',
    ada: '112', parsel: '7', location: null, irrigation: 'irrigated', sharedTenantIds: [TENANT_A], isActive: true,
    createdAt: ts(NOW - 28 * DAY), updatedAt: ts(NOW - 28 * DAY),
  });
  // Müşteri kartında "uygulamalı" işareti
  const custWrite = writes.find(([p]) => p === `customers/${linkedCustomer.id}`);
  if (custWrite) custWrite[1].farmerId = FARMER_ID;

  // Kasiyer için bekleyen davet (Ekip sayfasında görünür, davetle katılım denenebilir)
  put('invites/yeni.personel@test.local', {
    email: 'yeni.personel@test.local', tenantId: TENANT_A, role: 'cashier', createdBy: TENANT_A, createdAt: ts(NOW - DAY),
  });

  await flush(db);

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const critical = A.products.filter(p => p.stock <= p.minStock).length;
  console.log('Seed tamam:');
  console.log(`  Ağaoğlu Tarım: ${A.products.length} ürün (${critical} kritik), ${A.custs.length} müşteri, ${A.sales.length} satış,` +
    ` toplam alacak ${round2(sum(A.custs, c => c.balance)).toLocaleString('tr-TR')} TL`);
  console.log(`  Yeşil Vadi Zirai: ${B.products.length} ürün, ${B.custs.length} müşteri, ${B.sales.length} satış`);
  console.log(`  Toplam ${writes.length} doküman. Hesaplar (şifre ${PASSWORD}): ${Object.values(U).map(u => u.email).join(', ')}`);
  console.log('  Kalıcı yapmak için: npm run emu:export (veya emulator penceresinde Ctrl+C)');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
