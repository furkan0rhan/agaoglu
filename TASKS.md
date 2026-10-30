# Tarım Market Pro — Detaylı Denetim ve Görev Listesi

> Tarih: 2026-10-27 · Kaynak: Angular 21 + PrimeNG 21 + Ionic 8 (kabuk) + Firebase 12 + Tauri 2
> Bu dosya eski `memory/TODO.md`'nin yerini aldı (`memory/` klasörü 14.10'da kaldırıldı).
> Her görev tek bir ajana brief olarak verilebilecek şekilde yazıldı: **Dosyalar**, **Yapılacak**, **Kabul kriteri**.

---

## ✅ DURUM — 31.10.2026

- **Sürüm:** v1.3.1 yayınlanıyor (tag atıldı). İmzalama anahtarlarıyla derlenen ilk sürüm: imzalı Android APK/AAB + Windows EXE otomatik güncelleme (`latest.json`). 1.3.0 bayilere bir kez elle kurulur; sonraki sürümler kendiliğinden gelir.
- **Canlı:** Firestore kuralları ve indeksleri canlıda (31.10).
- **Öncelik:** kendi bayilerimiz Windows EXE'yi günlük kullanıyor (pilot). Dışarıya satış ve kendi sunucu/hosting sonra; ilk ticari sürüm **2.0.0** olacak.
- **Sürümleme:** pilot süresince yalnız yama artışı (1.3.2, 1.3.3 …).
- **Görev listesi 31.10'da koda karşı doğrulandı:** Bölüm 1–7 ve 9–14'teki açık maddeler işaretlendi (✅ doğrulandı / kısmen / hâlâ açık notlarıyla).

### ▶ SIRADAKİ (öncelik sırasıyla)

**A. Bayilerin EXE'de günlük kullanımı: doğruluk, veri bütünlüğü, çevrimdışı**
1. **2.2 Stok yarışı:** satışta `batches` yerel önbellekten mutlak yazılıyor, stok kontrolü yerel store'dan yapılıyor; `ProductService.adjustStock/removeBatch` mutlak `stock` yazıyor. İki kasalı bayide stok ve GTS kaybı riski var. Online satış/stok işlemleri ürün dokümanını transaction içinde okumalı.
2. **3.8 Çevrimdışı stok işlemleri:** `ProductService` (stok ekle/çıkar, parti sil, uzlaştırma, stok sayımı) bağlantı yokken `await commit()` ile bekliyor, spinner dönüp duruyor. Ardından **14.16(c)** bağlantı kopması testi.
3. **2.38** `products.stock >= 0` kural doğrulaması (yarışa karşı son güvenlik ağı).
4. **2.22** Ürünler sayfası araması `toLowerCase()` kullanıyor ("İLAÇ" adlı ürün "ilaç" yazınca bulunmuyor): `product.store.ts:52`, `product-list.page.ts:388`.
5. **5.4** Nakit + kart bölünmüş ödeme.
6. **11.13** SKT'si geçmiş BKÜ için "firmaya iade" çıkış hareketi ve listesi (mevzuat, 30 gün).
7. **5.7** Veresiye yaşlandırma raporu (0-30 / 31-60 / 60+); **5.11** stok değer raporu.
8. **5.17** Uzak hata izleme ve geri bildirim kanalı (pilotta bayideki hataları görebilmek için).
9. **2.19** GTS'li ürünlerde `batches[]` belge boyutu (1 MiB) riski: en azından büyük ürünlerde uyarı.
10. Küçükler: 3.10 `chart.js` kaldır, 3.13 Rust `print_receipt` stub'ları, 3.18 `lint-staged`, kenar çubuğunda kesilen kullanıcı adı (14.17).

**B. Kullanıcı tarafı (kod değil)**
1. v1.3.1 taslak release'ini **Publish** et; 1.3.0 → 1.3.1 otomatik güncellemeyi bayi bilgisayarında dene (14.7, 14.16a).
2. İlk imzalı sürümü doğrula: APK telefona kuruluyor mu, kamera ile tarama, R8'de çökme yok mu (14.5, 14.6).
3. Bayide fiş yazıcı + USB barkod okuyucu ile EXE testi (14.16b); laptop kamerası varsa WebView2 kamera izni (14.6).
4. `SUPPORT_CONTACT` gerçek telefon/e-posta (`core/license/license.config.ts`, 10.9).
5. İlk superadmin'i Console'dan ekle (`docs/SUPERADMIN.md`, 10.10, 14.8).
6. Avukat incelemesi: müşteri aydınlatma metni (5.16), çiftçi aydınlatma metni (8.12), destek erişimi sözleşme maddesi.
7. `.keys/` klasörünü güvenli bir yere yedekle (Android keystore + Tauri updater anahtarı).
8. Kod imzalama sertifikası kararı (SmartScreen uyarısı, 14.16e / Bölüm 9).

**C. Sonra (2.0.0 ve dışarıya satış)**
- Veri katmanı soyutlaması ve kendi sunucuya geçiş (Bölüm 6: 6.1 yalnız çiftçi modülünde var, 6.2–6.8 açık); sayfalama (3.1); App Check (2.41).
- Online ödeme ve otomatik lisans (5.12, 10.11); maxUsers sunucu kontrolü (10.12); destek modu değişiklik kaydı (10.13); superadmin 2FA (10.14).
- İnternetsiz web açılışı / service worker (14.15, 8.11); çiftçi modülü pilotu (8.13) ve v2/v3 maddeleri (8.15–8.27); Android APK güncelleme kontrolü (5.14).

---

### 27.10.2026 ilk tur özeti

**Yapıldı (doğrulandı: production build temiz, 73/73 test, lint 0 hata, initial 1.04 MB / 256 KB gz):**
- Bölüm 1 (acil) tamamı: 1.1–1.9.
- Bölüm 2: 2.1 (satış geçmişi + iptal/iade), 2.3–2.5, 2.7–2.10, 2.12–2.18, 2.20–2.40 (2.38'in negatif stok doğrulaması hariç). 2.2 kısmen (satış ve tahsilat transaction'lı, stok düzeltmeleri değil). 2.6 rapor tarafında ayrı "vade farkı geliri". 2.11 ve 2.19 açık.
- Bölüm 3: 3.2–3.6, 3.8–3.15, 3.17, 3.20. 3.18 kısmen (ESLint + Prettier + rules emulator testi `npm run test:rules` var; lint-staged yok). 3.7 ✅ 30.10 (14.10: Dexie/SyncQueue silindi). 3.19 kısmen (Bölüm 9).
- Bölüm 4 (UI) tamamı: token katmanı, PrimeNG preset + Türkçe takvim, `src/app/shared/ui/` bileşenleri (README'li), cam kabuk + mobil alt nav, tüm sayfalar dönüştürüldü, eski koyu tema eşlemesi silindi.
- Bölüm 5: 5.1 (tenant + davet modeli, Spark uyumlu), 5.2 (Ekip sayfası), 5.3 (satış geçmişi + 80 mm fiş), 5.4 kısmen (iptal, genel indirim, karışık nakit+veresiye), 5.5 kısmen (birim + ondalık miktar), 5.6 (kasa özeti, yazdırılabilir), 5.11 kısmen (en çok satanlar, kategori, Excel/PDF), 5.15 kısmen (İşletme Bilgileri kartı).
- Bölüm 9: exe/msi otomatik release.

**Canlı giriş sorunu (30.10.2026) — çözüldü (kodda; deploy gerekmez):**
- Sebep (eski kurallı emulator'de yeniden üretildi): yeni kod eski (canlı) `firestore.rules` ile uyumsuzdu. (1) `users/{uid}` dokümanı olmayan eski hesapta `createProfile` users + **tenants** batch'i yazıyordu; canlı kurallarda `tenants` yok → PERMISSION_DENIED → "profil okunamadı, bağlantınızı kontrol edin" + çıkış (kullanıcıya "Firebase bağlanmıyor" gibi görünüyor). (2) `isActive` alanı olmayan / `tenantId` alanı olmayan eski dokümanlar `toAppUser`'da pasif sayılıp "hesabınız pasife alınmış" ile atılıyordu. (3) İlk açılıştaki tek bir "client is offline" (persistentLocalCache + multi-tab) hatası da doğrudan çıkış yaptırıyordu.
- Çözüm: `core/auth/services/profile-loader.ts` (sunucudan okuma, geçici hatada önbellek + üstel geri çekilme ~15 sn; yalnız permission-denied kesin), geçici hatada oturum KAPANMAZ → giriş sayfasında "Tekrar dene" (bağlantı gelince otomatik); tenants reddedilirse yalnız users dokümanı yazılır; `isActive` yoksa aktif, `tenantId` yoksa eski sahip (uid, admin); eski kurallarda eksik alanlar kullanıcının kendi dokümanına geri doldurulur (yeni kurallara hazırlık); `TenantInfoService`/`TenantSettingsService` okumaları best-effort; `environment.requireEmailVerification` bayrağı. Testler: `profile-loader.spec.ts`, `auth.service.spec.ts`. Ayrıntı: `docs/TEST-ORTAMI.md` "Eski (canlı) kurallarla uyumluluk testi".
- Kullanıcı: yeni sürümle (`npm start`) tekrar giriş yapması yeterli; e-postası doğrulanmamışsa doğrulama ekranından "Tekrar Gönder" (veya geçici olarak `requireEmailVerification: false`).

**Ayarlar ekranlara bağlandı (30.10.2026):** [x] fiş (kâğıt 58/80, başlık notu, logo, bayi izin no, ruhsat/GTS; ayarlar önizleme = test fişi = gerçek fiş), [x] POS veresiye varsayılan vade, [x] yeni müşteri varsayılan limit, [x] hatırlatma şablonu, [x] SKT eşikleri tek kaynak (ProductStore, dashboard, bildirimler, zil).
**Hata listesi (30.10.2026):** [x] stok hareketlerinde "Alış: <belge no>" / "Satış: <no>" + link, [x] çiftçi öneri dialogunda doz sıfırlanması (canlandırılamadı; sağlamlaştırıldı + test — ekranda denenmeli), [x] gider dialogu Esc → autocomplete paneli, [x] ekstre dialogunda takvimin kendiliğinden açılması, [x] `overlayAppendTo: 'body'`, [x] `test:rules` 126/126. [x] NG0956: `quick-cash.component.ts` → `track $index` (30.10, yönetici). [x] Destek modu hardNavigate + live-reload: profil yükleme artık geçici hatada çıkış yapmıyor — ✅ 31.10 doğrulandı: 14.11 Y1 (oturum anahtarı değişince store'lar sıfırlanıyor, destek modu doğru veri, yenileme ~2 sn).

**YAYINDAN ÖNCE ZORUNLU (kullanıcı onayı gerekir):**
1. `firestore.rules` + `firestore.indexes.json` deploy: `firebase deploy --only firestore:rules,firestore:indexes`. Yeni kod `tenants` ve `invites` koleksiyonlarına yazıyor; eski kurallarla kayıt olma ve ilk giriş reddedilir. Önce `firestore.rules.md`'deki kontrol listesine bak (tüm `users` dokümanlarında `tenantId` ve `isActive: true` olmalı).
2. E-posta doğrulaması artık zorunlu: doğrulanmamış mevcut hesaplar doğrulama ekranında kalır.
3. Yeni sürüm (web + exe) kurallarla aynı anda yayınlanmalı; eski exe yeni kurallarla `tenants` yazamaz.
4. Gerçek (canlı) veriyle manuel test yapılmadı. **Yerel test ortamı hazır:** Firebase Emulator + demo verisi + doğrulanmış test hesapları (`npm run emu`, `npm run emu:seed`, `npm run dev:emu`; bkz. `docs/TEST-ORTAMI.md`) — canlıya dokunmadan tüm akışlar denenebilir. Deploy sonrası müşteri test ajanı yeni sürümde tekrar çalıştırılmalı.

**Açık kalan önemli işler (öncelik sırası):**
- Veresiyede vade tarihi, taksit takvimi, peşinat, gecikmiş borç listesi (5.7), WhatsApp/SMS hatırlatma (5.8). — 27.10.2026: veri modeli, liste/detay, ekstre ve hatırlatma yapıldı; 30.10: POS dialoguna bağlandı (peşinat, taksit, hasatta öde, limit uyarısı) ve dashboard gecikmiş alacak kartı eklendi. ✅
- ~~Satışta GTS seçimi ve fişe yazılması (2.11), ürün listesinde Enter ile sepete ekleme.~~ ✅ 27.10 (Bölüm 11).
- Veri katmanı soyutlaması (Bölüm 6.1–6.4) — sunucu geçişinin ve çiftçi modülünün önkoşulu.
- Lisans/abonelik (5.12): manuel lisans + superadmin paneli yapıldı (Bölüm 10); online ödeme yok. Yedek/dışa aktarma (5.13) ✅ 27.10; kalan: Tauri updater + kod imzalama (Bölüm 9).
- `npm audit`: 30.10 `npm audit fix` sonrası 45 → 11 açık (0 kritik, 6 yüksek, 5 orta); kalanlar firebase-tools / firebase-admin bağımlılıkları (uuid, @grpc/grpc-js, @opentelemetry/core), yalnız `--force` (major) ile çözülüyor.
- Android'de `window.print()` çalışmaz; Android fiş için Bluetooth termal yazıcı eklentisi gerekir.
- Çiftçi modülü (Bölüm 8): MVP kodu yazıldı (2026-10-27; `/ciftci`, davet+PIN, tarla/sezon/defter/PHI, ambar, borç, bayi paneli, öneri/reçete, hava). Görünürlük (14.9) ✅ 30.10: giriş ekranında çiftçi girişi, bayi menüsünde Çiftçiler sayfası, ana sayfa kutusu. Kalan: ~~8.7 POS satış anı entegrasyonu~~ ✅ 30.10, 8.11 service worker (ertelendi, gerekçe 8.11), 8.12 avukat onaylı aydınlatma metni, 8.13 pilot; canlıya almadan önce rules + indeks deploy (14.9 ile 3 yeni indeks) (Tauri CSP'ye api.met.no ✅ 30.10).
- Ayrıntılı bulgu listesi: `docs/MUSTERI-TEST-RAPORU.md` (eski sürümde yapıldı; kritik iki bulgu düzeltildi).

---

## 0. Mevcut durum özeti (doğrulanmış)

| Sistem | Durum | Kanıt |
|---|---|---|
| Angular web build (`ng build`) | ✅ Çalışıyor | 2026-10-27, 26 sn, initial 1.22 MB / 307 KB gz |
| `ng test` | ❌ Kırık | Vitest, `@ionic/core/components` ESM çözümleme hatası; tek spec dosyası da Angular şablon testi (başarısız) |
| ESLint | ❌ Yok | Config yok, `eslint` paketi yok; `@angular-eslint/eslint-plugin` boşuna `dependencies`'te |
| Tauri masaüstü build | ❌ **Kırık** | `src-tauri/src/lib.rs`, `main.rs`, `icons/**`, `wix/tr-TR.wxl` diskte silinmiş (git'te takipli, commit'lenmemiş) |
| Tauri Android build | ❌ **Kırık** | `gen/android/app/src/main/res/**`, `buildSrc/**`, `gradle/wrapper/**` silinmiş |
| GitHub Actions (android-build.yml) | ⚠️ HEAD'de çalışır, working tree commit'lenirse kırılır | İmzasız debug APK üretiyor |
| Bu makinede Rust / JDK / Android SDK | ❌ Yok | Yerel Tauri build mümkün değil |
| Firestore rules | ⚠️ Çalışıyor ama zayıf | Veri doğrulaması yok, `users` write serbest, `tenantId` değiştirilebilir |
| `firestore.indexes.json` | ❌ Geçersiz JSON | Satır 62 sondaki virgül → `firebase deploy` hata verir |
| Offline mod | ⚠️ Yarım | Gerçek offline sadece Firestore `persistentLocalCache`; `SyncQueueService`/Dexie kuyruğu hiçbir yere flush edilmiyor |
| i18n (TR/EN) | ✅ Tip güvenli, eksik anahtar yok | Ama ~30 sabit Türkçe metin ve `tr-TR` locale kodu şablonlarda |
| Karanlık mod | ⚠️ Yarım | Tailwind renk sınıfları `styles.scss`'te elle eşleniyor; `bg-amber-50`, `from-green-400` vb. eşlenmiyor |

**Kod büyüklüğü:** ~9.600 satır TS (şablonlar inline). En büyük dosyalar: `product-detail.page.ts` (940), `translations.ts` (715), `pos.page.ts` (474), `product-list.page.ts` (470).

---

## 1. 🔴 ACİL — Veri kaybı / para kaybı / build kırık

### 1.1 `src-tauri/` silinmiş dosyaları geri getir
- **Dosyalar:** `src-tauri/src/*.rs`, `src-tauri/icons/**`, `src-tauri/wix/tr-TR.wxl`, `src-tauri/gen/android/**`, `src-tauri/gen/schemas/**` (toplam 92 dosya)
- **Yapılacak:** Silme bilinçli değilse `git checkout -- src-tauri/`. Bilinçliyse `git rm` + `npx tauri android init` + `npx tauri icon <png>` + `.rs` kaynakları yeniden yazılmalı.
- **Kabul:** `git status` içinde `src-tauri` altında `D` kalmaması; `Cargo.toml` satır 12'nin işaret ettiği `src/main.rs` mevcut.
- **Not:** `gen/schemas/` gitignore'a alınabilir; `gen/android/` commit'li kalmalı (CI `tauri android init` çalıştırmıyor).

### 1.2 Satışta yanlış ürünün stoğu düşüyor (barkodsuz ürün)
- **Dosyalar:** `src/app/features/pos/services/sale.service.ts:55-56`, `src/app/features/products/store/product.store.ts:107-108`
- **Sorun:** Sepet kalemi `findByBarcode(item.barcode) ?? find(id)` ile bulunuyor. Barkod `''` ise `findByBarcode('')` barkodsuz **ilk** ürünü döndürür → B satılınca A'nın stoğu ve partileri düşer.
- **Yapılacak:** Önce `item.productId` ile bul; `findByBarcode`'u boş string için `null` döndür.
- **Kabul:** İki barkodsuz ürünle yapılan satışta doğru ürünün stoğu düşer (unit test).

### 1.3 Çift tıklama ile çift satış
- **Dosyalar:** `pos.page.ts:428-469`, `sale.service.ts:116-120`
- **Sorun:** `completeSale` sırasında kilit yok; sepet ancak `await batch.commit()` sonrası temizleniyor. Ağ gecikmesinde ikinci tıklama aynı sepeti ikinci kez satar.
- **Yapılacak:** `saving` signal'i ile butonları kilitle; sepeti commit'ten önce snapshot'la ve hemen temizle; hata olursa geri yükle.
- **Kabul:** Butona hızlı iki tıklamada tek satış dokümanı.

### 1.4 Kısmi nakit ödemede kalan borç kayboluyor
- **Dosyalar:** `pos.page.ts:450-455`, `sale.service.ts:86`
- **Sorun:** Nakit dialogu `tutar < toplam` girişine izin veriyor; müşteri seçili değilse kalan tutar hiçbir yere yazılmıyor, satış `completed` oluyor.
- **Yapılacak:** `cashAmount < total` ise ya engelle ya da müşteri seçimini zorunlu kılıp veresiyeye yaz.
- **Kabul:** Toplam 100, nakit 50, müşteri yok → satış tamamlanamaz (uyarı).

### 1.5 Müşteri düzenleme formu boş açılıyor ve veri siliyor
- **Dosyalar:** `src/app/features/customers/customer-form/customer-form.page.ts:122-149`
- **Sorun:** `ngOnInit` mevcut müşteriyi yüklemiyor (`getById$` + `patchValue` yok). Kaydet → e-posta, TC, adres, not `null` ile ezilir.
- **Yapılacak:** `supplier-form.page.ts:124-138`'deki kalıbı uygula; `isActive`/`birthDate`'i ezme; `catch` + toast ekle (`customers.saveFailed` anahtarı zaten var).
- **Kabul:** `/customers/:id/edit` dolu açılır; yalnızca değişen alanlar güncellenir.

### 1.6 Ürün formunun edit modu tüm partileri (GTS) siliyor
- **Dosyalar:** `src/app/features/products/product-form/product-form.page.ts:326-348`, `products.routes.ts:17`
- **Sorun:** Kaydet her zaman `batches: [tek parti]` ve `stock` gönderiyor. `:id/edit` rotası var ama link yok (ölü ama tehlikeli).
- **Yapılacak:** Edit dalını kaldır **veya** edit modunda `batches`/`stock` alanlarını hiç gönderme.
- **Kabul:** GTS'li bir ürün formdan kaydedilince `batches` değişmez.

### 1.7 Veresiye tahsilatı bayat bakiye ile mutlak yazıyor
- **Dosyalar:** `src/app/features/credit/credit-detail/credit-detail.page.ts:231-248`
- **Sorun:** `balance: Math.max(0, c.balance - amount)` → başka terminalde eklenen borç silinir. Aşırı ödeme `totalPaid`'i şişiriyor. Bakiye 0 iken tahsilat girilebiliyor.
- **Yapılacak:** `increment(-amount)` + `runTransaction` (online) ya da kural tarafında doğrulama; dialogda `max = balance`; kuruşa yuvarla (`Math.round(x*100)/100`).
- **Kabul:** İki terminalli senaryoda bakiye doğru; 150 ödeme bakiye 100'de reddedilir.

### 1.8 `firestore.indexes.json` geçersiz JSON
- **Dosya:** `firestore.indexes.json:62` (sondaki virgül)
- **Kabul:** `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json'))"` hatasız.

### 1.9 Production'da devtools açık + CSP kapalı
- **Dosyalar:** `src-tauri/tauri.conf.json:23,27`, `src-tauri/Cargo.toml:20`
- **Yapılacak:** `devtools: true` kaldır; `features = []`; CSP tanımla (`default-src 'self'; connect-src https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'`). Kullanılmayan `dialog`/`fs` plugin'lerini Cargo'dan çıkar.
- **Kabul:** Release build'de sağ tık → Inspect yok.

---

## 2. 🟠 YÜKSEK — İş mantığı hataları

### POS / Satış
- [x] **2.1 Satış iptali / iadesi yok.** `SaleStatus 'cancelled'|'refunded'`, `cancelledAt`, `StockMovement 'return'` modelde var, kullanan kod yok. Stok ve bakiye geri yükleyen iptal akışı yaz. Raporlar/dashboard `status == 'completed'` filtrelesin. (`sale.service.ts`, `sales-report.page.ts`, `dashboard.store.ts`) — ✅ 31.10 doğrulandı: `SaleService.cancelSale` stok + parti + veresiye bakiyesini geri alır, iptal sebebi + `auditLogs`; raporlar yalnız `completed`, Raporlar → İptaller
- [x] **2.2 Stok yarışı (transaction yok).** `sale.service.ts:59-61` ve `product.service.ts:79-142` bayat snapshot ile mutlak `stock` yazıyor. Online iken `runTransaction`; offline için en azından `increment()` + `batches` için uzlaştırma aracı. Çok kasalı kullanımda zorunlu. — **31.10 kısmen:** satışta `stock: increment()` + online `runTransaction` (`sale.service.ts` `commit`). Kalan: ürün dokümanı transaction içinde okunmuyor; `batches` yerel önbellekten mutlak yazılıyor (iki kasa aynı GTS/partiyi düşebilir); stok yeterlilik kontrolü yerel store'dan; `ProductService.adjustStock/removeBatch` hâlâ mutlak `stock` yazıyor (`product.service.ts:133,207`) — ✅ 30.10: satış, iptal ve ürün kartı stok işlemleri çevrimiçiyken `runTransaction` içinde ürünü SUNUCUDAN okuyup planlar (`sale-stock.ts` `planSaleStock`, `stock-plan.ts`); çevrimdışı satış/iptal/stok girişi `increment` + değişen partiler için `arrayRemove`/`arrayUnion` (`diffBatches`), çevrimdışı stok çıkışı / parti sil-düzenle / uzlaştırma / sayım engelli ("internet gerekli"); kural + emulator testi: iki kasa farklı GTS birimi (`tests/rules/products-stock.spec.ts`)
- [x] **2.3 Ürün bulunamazsa satış stoksuz kaydediliyor** (`sale.service.ts:57`). Pasif ürün sepetteyken olur. Hata fırlat. — ✅ 31.10 doğrulandı: tüm kalemler yazmadan önce çözülür, yoksa `ProductNotFoundError` (`sale.service.ts:165-169`)
- [x] **2.4 Satış numarası saniye çözünürlüklü** (`sale.service.ts:124`). İki kasa aynı saniyede çakışır. Tenant bazlı sayaç (transaction) veya `uid`-prefix ekle. — ✅ 31.10 doğrulandı: `generateSaleNumber` uid öneki + 3 karakter rastgele (`sale.utils.ts:237`)
- [x] **2.5 `creditTransactions.balance` anlamı tutarsız** (borçta işlem tutarı, tahsilatta müşteri bakiyesi). Koşan bakiye yap ya da alanı kaldır. — ✅ 31.10 doğrulandı: `balance` = işlem sonrası koşan bakiye; online transaction içinde müşteri bakiyesi okunur (`sale.service.ts` `commit`, `credit.service.ts:167`)
- [x] **2.6 Faizli veresiyede `sale.totalAmount` faizsiz kalıyor** → raporlar faiz gelirini görmez. Karar: faiz ayrı gelir kalemi mi, ciro mu? — ✅ 31.10 doğrulandı: karar: vade farkı ayrı gelir kalemi (dashboard ciro kartı + raporlar "vade farkı")
- [x] **2.7 `_pendingCredit` bayrağı sıfırlanmıyor** (`pos.page.ts:350,389,415`). Dialog kapatılınca reset et. — ✅ 31.10 doğrulandı: `pendingCredit` kullanıldıktan sonra sıfırlanıyor (`pos.page.ts:1608-1616`)
- [x] **2.8 Yanlış toast'lar:** stok sınırında "eklendi" (`pos.page.ts:395-413`), stok 0'da "barkod bulunamadı". — ✅ 31.10 doğrulandı: ayrı `stockLimit` / `outOfStock` uyarıları (`pos.page.ts:1384-1424`)
- [x] **2.9 Sepet kalıcı değil**, global indirim satışa yazılmıyor, `totalPrice` indirimi içermiyor (`cart.store.ts:102,124`), hesaplar 4 kez kopya (`cart.store.ts:34-89`), yuvarlama yok → `1e-15 TL` borç yazılabilir. — ✅ 31.10 doğrulandı: sepet localStorage'da (oturuma bağlı), `round2`, genel indirim `totalDiscount`, tek `lineAmounts` hesabı (`cart.store.ts`)
- [x] **2.10 Barkod directive Enter'ı odaktaki butona geçiriyor** (`barcode-input.directive.ts:18-29`). `BUTTON` dışla, `preventDefault()`, modifier tuşlarını yoksay, açık dialog varken devre dışı. — ✅ 31.10 doğrulandı: BUTTON/contenteditable hariç, modifier yoksayılıyor, açık dialog/tarayıcıda susuyor, `preventDefault` (`barcode-input.directive.ts:22-46`)
- [x] **2.11 GTS okutulunca belirli birim seçilmiyor** ✅ 27.10: okutulan GTS o birimi düşer, barkodla eklenende FEFO GTS'leri `SaleItem.gtsNos`'a yazılır, fiş + satış detayında görünür (bkz. Bölüm 11).; FEFO başka GTS'i düşürür. Satış kalemine `gtsNo[]` ekle (gübre/ilaç izlenebilirlik).

### Ürün / Stok
- [x] **2.12 `stock ≠ Σ batches` hiçbir yerde doğrulanmıyor.** `applyFEFO` yetersiz partide sessizce yetiniyor (`batch.utils.ts:11-17`), `removeBatch` `Math.max(0,…)` ile gizliyor. Uzlaştırma (reconcile) komutu + uyarı rozeti. — ✅ 31.10 doğrulandı: ürün detayında "Stoku partilerle eşitle" / "Farkı GTS'siz parti olarak ekle" (`reconcileStock`), FEFO açığı uyarısı ve satışta onay
- [x] **2.13 `removeBatch` toplu satırda N adedi siliyor** ama onay metni "bu birim" diyor (`product.service.ts:162-195`). — ✅ 31.10 doğrulandı: `removeBatch(product, batchId, reason, quantity)` kısmi miktar alıyor (`product.service.ts:196`)
- [x] **2.14 Barkod ve GTS benzersizliği zorlanmıyor** (ürün içi bile `updateBatch`'te yok). Global GTS kontrolü için `where('batches', 'array-contains')` çalışmaz → ayrı `gtsIndex/{gtsNo}` koleksiyonu veya tenant-bazlı set. — ✅ 31.10 doğrulandı: formda `findBarcodeConflict` / `findGtsConflict`, serviste `duplicate-gts` (ürün içi + işletme geneli, istemci tarafı; kural/indeks yok)
- [x] **2.15 Süresi geçmiş parti satılabiliyor**, `nearestExpiry` geçmiş SKT'yi de sayıyor. Uyarı/engel. — ✅ 31.10 doğrulandı: bitki korumada SKT geçmiş birim satılamaz (`ExpiredPlantProtectionError`), diğerlerinde onay; `nearestExpiry` tükenmiş partileri saymıyor
- [x] **2.16 `createdAt.toDate()` null güvenli değil** (`product-detail.page.ts:225`, `stock-movements.page.ts:95`, `credit-detail.page.ts:168`). Bekleyen `serverTimestamp()` ile `null` gelir → TypeError. `?.toDate()` veya `snapshotOptions: { serverTimestamps: 'estimate' }`. — ✅ 31.10 doğrulandı: `serverTimestamps: 'estimate'` + null güvenli tarih okuma
- [x] **2.17 Stok sayımı girilen değerleri kaybediyor** (`stock-count.page.ts:271-273`, `rows` computed, snapshot gelince sıfırlanır). `counted` değerlerini ayrı `Map` signal'inde tut. Döngü atomik değil (`:345-353`). — ✅ 31.10 doğrulandı: sayımlar ayrı `counted` Map signal'inde (`stock-count.page.ts:298`); yazım ürün başına (tam atomik değil), hatalar listede gösteriliyor
- [x] **2.18 KDV `NaN` yazılabiliyor** (`product-detail.page.ts:687`), ilk stok için hareket kaydı yazılmıyor, "Kategori *" zorunlu görünüp doğrulanmıyor, satış fiyatı 0 kabul. — ✅ 31.10 doğrulandı: ürün formu doğrulamaları (satış fiyatı ≥ 0.01, alış ≥ 0, ilk stok hareketi) 27.10
- [ ] **2.19 Firestore belge boyutu riski:** her GTS birimi `batches[]` elemanı → binlerce birimde 1 MiB sınırı. Uzun vadede `products/{id}/batches` alt koleksiyonu. — 31.10 hâlâ açık: `batches[]` hâlâ ürün dokümanında (alt koleksiyon yok); sunucu geçişinde (6.6) çözülmesi planlı

### Müşteri / Veresiye / Tedarikçi / Gider
- [x] **2.20 "Cari hareketler" butonu `/credit` listesine gidiyor**, `/credit/:id`'ye değil; kasiyer için rota admin-only (`customer-detail.page.ts:99-106`). — ✅ 31.10 doğrulandı: müşteri detayı cari hesabı kendi içinde gösteriyor (C müşteri başlığı + taksit planı + `credit-timeline`)
- [x] **2.21 Müşteri silme UI yok**, `CustomerService.delete` ölü; bakiye > 0 engeli yok. — ✅ 31.10 doğrulandı: müşteri detayında sil (bakiye 0 iken) / KVKK anonimleştirme
- [x] **2.22 Türkçe harf:** `toLowerCase()` yerine `toLocaleLowerCase('tr')` (arama: `customer-list:99`, `credit-list:78`, `supplier-list:96`; isim: `auth.service.ts:72`, `profile.page.ts:258`). "İsmail" bulunamıyor, "ismail" → "Ismail". — **31.10 kısmen:** POS, müşteri, veresiye, tedarikçi aramaları `toLocaleLowerCase('tr')`. Kalan: Ürünler sayfası araması `product.store.ts:52-58` ve pasif liste `product-list.page.ts:388` hâlâ `toLowerCase()` ("İLAÇ" adlı ürün "ilaç" yazınca bulunmuyor) — ✅ 30.10: ortak `shared/utils/search.utils.ts` (`searchKey`/`matchesSearch`: tr küçük harf + ı→i katlama) ürün store'u, pasif liste ve stok sayımında
- [x] **2.23 `credit-detail` tüm tenant `creditTransactions`'ı çekip istemcide süzüyor** (`:278-285`); `where('customerId')` + indeks `(tenantId, customerId, createdAt desc)`; `onSnapshot` unsubscribe yok. — ✅ 31.10 doğrulandı: `where('customerId', '==', …)` sorgusu (`credit.service.ts:153`)
- [x] **2.24 Gider "hafta" ve "ay" filtreleri ay sınırında yanlış** (`expenses.page.ts:236-241`). `new Date(y, m+1, 0)` kullan. Ortak `date-range.util.ts` yaz (raporlarla paylaşılsın). — ✅ 31.10 doğrulandı: `shared/utils/date-range.util.ts` (+ spec), giderler ve raporlar ortak kullanıyor
- [x] **2.25 Tekrarlayan gider 12 belge, atomik değil, `recurringId` yok, 31'inde ay atlıyor** (`expenses.page.ts:271-275`). — ✅ 31.10 doğrulandı: `recurringId` serisi + seri konumu (`expenses.page.ts:115,336`)
- [x] **2.26 Tedarikçi silme partilerdeki `supplierId` referansını kontrol etmiyor** (`supplier-detail.page.ts:253`). Yanlış hata anahtarı (`supplier-list:87` `saveFailed` yerine `loadError`). — ✅ 31.10 doğrulandı: silmeden önce partilerde `supplierId` kontrolü (`supplier-detail.page.ts:178`)
- [x] **2.27 `catch` eksik:** `customer-form`, `forgot-password.page.ts:77`, `register.page.ts:142` (tüm hatalar genel mesaj), `login` (`user-disabled`, `network-request-failed` yok), `profile.page.ts:249` (`auth/invalid-credential` eşlenmemiş). — ✅ 31.10 doğrulandı: `features/auth/auth-errors.ts` (invalid-credential, user-disabled, network-request-failed) + `userErrorMessage()`

### Raporlar / Dashboard
- [x] **2.28 `limit(1000)`/`limit(500)` + `orderBy` yok** (`sales-report.page.ts:340`, `dashboard.store.ts:40`). Satış sayısı limiti aşınca bugünün verisi eksik gelir. `where('createdAt','>=',start)` + `orderBy('createdAt','desc')`. — ✅ 31.10 doğrulandı: limit yok; tarih aralıklı `where` + `orderBy('createdAt','desc')` (`sales-query.service.ts:19-22`, `report-data.service.ts`)
- [x] **2.29 "Net kâr" = ciro − gider**; `purchasePrice` hiç kullanılmıyor. `SaleItem`'a `costPrice` snapshot'ı ekle, brüt kâr hesapla. — ✅ 31.10 doğrulandı: `SaleItem.costPrice` (KDV hariç net maliyet) + brüt kâr (`report-calc.ts`, 14.3)
- [x] **2.30 Gider toplamında üst sınır yok** (`sales-report.page.ts:316`): tekrarlayan kira gelecek 11 ayı bu aya sayar. — ✅ 31.10 doğrulandı: gider sorgusu dönem sonuyla sınırlı (`report-data.service.ts:86`)
- [x] **2.31 `cashTotal = Σ cashPaid`** para üstünü içeriyor; `cashPaid − change` olmalı. "Karma" kartı ölü. — ✅ 31.10 doğrulandı: Nakit = Σ(cashPaid − change) (`report-calc.ts:18`)
- [x] **2.32 Dashboard "toplam ürün" `filteredProducts()` kullanıyor** → ürünler sayfasındaki filtre dashboard'a sızar (`dashboard.page.ts:55,167`). `products()` kullan. `dashboard.store.ts`'te 5 alan hiç doldurulmuyor (haftalık/aylık/toplam ciro vb.). — ✅ 31.10 doğrulandı: dashboard `filteredProducts` kullanmıyor; hesaplar `home-calc.ts`
- [x] **2.33 Tahsilatlar (veresiye ödemeleri) raporlarda gelir olarak yok.** Gün sonu kasa raporu yok. — ✅ 31.10 doğrulandı: tahsilatlar raporda (`summarizeCollections`, nakit/kart/havale ayrı), kasa özeti yazdırılabilir

### Auth / Güvenlik
- [x] **2.34 E-posta doğrulaması süs:** `authGuard` `emailVerified` bakmıyor, kurallar `email_verified` istemiyor. Ya zorunlu kıl ya kaldır. — ✅ 31.10 doğrulandı: doğrulama zorunlu (`environment.requireEmailVerification`, `auth.service.ts:274`)
- [x] **2.35 "Beni hatırla" etkisiz** (`auth.service.ts:63-64`, her zaman `browserLocalPersistence`). — ✅ 31.10 doğrulandı: `rememberMe` → local / session persistence (`auth.service.ts:226`)
- [x] **2.36 Profil okunamazsa `role: 'admin'` varsayılıyor** (`auth.service.ts:155,166`). Güvenli varsayılan `staff` olmalı. — ✅ 31.10 doğrulandı: `admin` yalnız ilk sahip profili ve destek modunda; profil okunamazsa `profile-loader` bekletir/çıkarır, rol varsaymaz
- [x] **2.37 `users/{uid}` write serbest** → kullanıcı kendi `role`/`tenantId`'sini yazabilir (`firestore.rules:14-16`). Rol sadece admin SDK / Cloud Function ile yazılmalı. — ✅ 31.10 doğrulandı: kurallarda users self-update alan listesi; rol/yetki yalnız admin (`hasOnly(['role','isActive','permissions'])`), `tests/rules/users.spec.ts`
- [x] **2.38 Update kurallarında `request.resource.data.tenantId == resource.data.tenantId` yok** → belge başka tenant'a devredilebilir. Negatif stok, negatif tutar doğrulaması yok. — **31.10 kısmen:** update'te `tenantId` sabit (`firestore.rules:81,106`), tutarlarda `nonNegative` (sales, expenses, purchases). Kalan: `products.stock >= 0` kural doğrulaması yok — ✅ 30.10: `products` create/update'te `stock` sayı ve >= 0, ilk 40 parti `quantity >= 0` (negatif stok ayarı yok); istisnalar: stoğu azaltmayan yazım ve aynı yazımda oluşturulan satış (`lastSaleId`, çevrimdışı fazla satış kaybolmasın); canlıya `firestore.rules` deploy gerekir
- [x] **2.39 `isActive=false` kullanıcı giriş yapabiliyor.** `login()` çift `getDoc` yapıyor. `register()` yarım hesap bırakabilir (Auth var, Firestore yok). — ✅ 31.10 doğrulandı: pasif kullanıcı oturumu kapatılıyor (`AuthNotice 'inactive'`), profil tek yerden (`profile-loader.ts`)
- [x] **2.40 `credits` koleksiyonu kuralda/indekste var, kodda yok** → sil. `isTenant()` kullanılmıyor → sil. `creditTransactions.update` açık → defter değişmez olmalı. — ✅ 31.10 doğrulandı: `credits` ve `isTenant()` kurallarda/indekste yok; `creditTransactions` yalnız create (değişmez defter)
- [~] **2.41 App Check yok**, `firebase.json` `headers` yok, `.firebaserc` yok, `provideStorage` kayıtlı ama kullanılmıyor (Storage rules de yok). — **31.10 kısmen:** `firebase.json` headers, `.firebaserc` var, `provideStorage` kaldırıldı. Kalan: App Check yok

---

## 3. 🟡 ORTA — Kalite, performans, temizlik

### Performans / Ölçeklenme
- [ ] 3.1 Hiçbir listede sunucu tarafı sayfalama yok (ürün, müşteri, hareket, gider, işlem). Firestore `startAfter` + `limit`. — 31.10 hâlâ açık: satış/rapor sorguları tarih aralıklı; ürün, müşteri, hareket, gider listelerinde `startAfter` sayfalama yok
- [x] 3.2 `loadProducts()` her sayfa `ngOnInit`'te yeniden çağrılıyor → skeleton yanıp sönüyor, gereksiz okuma (`product-list:379,396`, `stock-count:289`, `main-layout:254`, `dashboard:729`). Store'u bir kez yükle. — ✅ 31.10 doğrulandı: `ProductStore` tek yükleme, oturum anahtarıyla sıfırlanır (`product.store.ts:150`)
- [x] 3.3 `onSnapshot` abonelik sızıntıları: `product-detail:604-608`, `product-list:386`, `stock-movements:155`, `pos.page:372`, `credit-detail:274`. Hepsine `takeUntilDestroyed()`. — ✅ 31.10 doğrulandı: dinleyiciler `takeUntilDestroyed` / `DestroyRef` ile temizleniyor
- [x] 3.4 `retry` içinde `return EMPTY` akışı sessizce kapatıyor (`product.store.ts:82-93`, `customer-list:82-88`) → hata toast'ı hiç görünmüyor. — ✅ 31.10 doğrulandı: store'larda `catchError` + hata toast'ı (27.10)
- [x] 3.5 `getMovements$` limitsiz; `debtors()` şablonda 3 kez hesaplanıyor (`credit-list:23,37,55`) → `computed`. — ✅ 31.10 doğrulandı: 27.10 (hareketler limitli, `debtors` computed)
- [x] 3.6 Bundle: `TarimLogo.png` 667 KB (WebP ~50 KB), `favicon-512.png` 177 KB, `favicon.ico` 75 KB, PrimeIcons 4 font formatı (woff2 yeter). `anyComponentStyle` bütçesi ters (`angular.json:50-54`: warning 10kb > error 8kB). — ✅ 31.10 doğrulandı: `TarimLogo.png` 69 KB, PrimeIcons yalnız woff2/woff, bütçe 8/16 kB; `favicon-512.png` 175 KB kaldı (önemsiz)

### Offline
- [x] 3.7 (30.10, 14.10: Firestore `persistentLocalCache` yeterli; Dexie + SyncQueue + `dexie` paketi silindi) `SyncQueueService.flush()` hiçbir şey yapmıyor (`sync-queue.service.ts:60-64` yorum: "injected per-service"). `localDb.products/sales/customers` tabloları hiç yazılmıyor. **Karar:** Firestore `persistentLocalCache` yeterliyse Dexie + SyncQueue + `product.service.ts:6-8,21-22` import'larını sil; değilse gerçekten bağla.
- [x] 3.8 Offline'da `await addDoc/updateDoc` sunucu onayı bekliyor → müşteri/tedarikçi/gider/tahsilat/stok formlarında spinner sonsuz döner (sadece `sale.service.ts:115-119` ele alıyor). Ortak `FirestoreService.write()` helper'ı: online ise await, değilse fire-and-forget + `.catch`. — **31.10 kısmen:** müşteri, gider, tedarikçi, veresiye servisleri `isOnline()` ile çevrimdışında beklemeden yazıyor; satış fire-and-forget. Kalan: `ProductService` (stok ekle/çıkar, parti sil, uzlaştırma, stok sayımı) çevrimdışında `await commit()` bekliyor (`product.service.ts:97,163,222,254`); alışlar bilinçli olarak çevrimiçi zorunlu — ✅ 30.10: `ProductService` ürün oluştur/düzenle ve stok girişi çevrimdışında beklemeden yazar; transaction gerektiren stok çıkışı, parti sil/düzenle, uzlaştırma ve sayım çevrimdışında `ProductStockError('offline')` → "internet gerekli" uyarısı (sonsuz spinner yok)
- [x] 3.9 `sale.service.ts:118` fire-and-forget commit'te `.catch` yok → unhandled rejection, satış kaybolabilir. — ✅ 31.10 doğrulandı: çevrimdışı commit `.catch` + logger (`sale.service.ts` `commit`)

### Ölü kod / gereksiz
- [~] 3.10 Kullanılmayan npm paketleri (12): `chart.js`, `ng2-charts`, `jspdf`, `jspdf-autotable`, `xlsx` (0.18.5 CVE'li), `@zxing/browser`, `@zxing/library`, `@ngrx/store`, `uuid`, `@types/uuid`, `@angular/cdk`, `@angular-eslint/eslint-plugin`. `tailwindcss/postcss/autoprefixer` → devDependencies. (Rapor/PDF/Excel/kamera özelliği yapılacaksa ilgili paket kalır.) — **31.10 kısmen:** ng2-charts, @ngrx/store, uuid kaldırıldı; jspdf, xlsx (0.20.3, CDN), zxing artık kullanılıyor; `@angular/cdk` PrimeNG peer bağımlılığı; tailwind/postcss/autoprefixer devDependencies'te. Kalan: `chart.js` hiç import edilmiyor (grafik SVG)
- [x] 3.11 Angular şablon artıkları: `src/app/app.html` (344 satır placeholder), `app.scss`, `app.spec.ts` ("Hello, tarim-market"). `index.html` `lang="en"`, `<title>TarimMarket</title>`. — ✅ 31.10 doğrulandı: `app.html`/`app.scss` yok, `index.html` `lang="tr"` + "Tarım Market Pro", `app.spec.ts` gerçek kök testi
- [x] 3.12 Ionic sadece kabuk: `app.ts` (`ion-app`), `app.config.ts` (`provideIonicAngular`), `styles.scss` (4 CSS). ~260 KB chunk için tek faydası `ion-router-outlet`. **Karar:** Ionic'i tamamen kaldır (`router-outlet` yeter) → bundle küçülür, `ng test` ESM hatası da çözülür. — ✅ 31.10 doğrulandı: Ionic tamamen kaldırıldı (`src/` ve `angular.json`'da iz yok)
- [~] 3.13 Ölü üyeler: `ProductStore.selectedProduct/selectProduct/totalInventoryValue`, `ProductService.delete/getByBarcode$`, `SaleService.logger`, `stock-count.diffStyle`, `product-list.globalFilterFields`, `stock-movements` `ButtonModule`, `credit-list` `ButtonModule`, `dashboard` `CardModule/TagModule`, `EXPENSE_CATEGORIES`, `/suppliers/:id/edit` rotası, Rust `get_printers`/`print_receipt` (frontend `invoke` hiç çağırmıyor), `StockMovement 'adjustment'|'return'` dalları. — **31.10 kısmen:** TS ölü üyeleri 27.10 + 14.10'da temizlendi. Kalan: Rust `get_printers`/`print_receipt` stub'ları (`src-tauri/src/lib.rs:2,21,50`)
- [x] 3.14 Kopya kod: kategori/KDV autocomplete (`product-form:237-276` = `product-detail:526-565`), FEFO sıralaması 4 yerde, `initials()` 3 yerde, dönem seçici 2 yerde, ödeme türü renk/ikon haritaları 4 fonksiyonda, tedarikçi formu 2 yerde, `(x as any)` cast'leri (model alanları zaten var). — ✅ 31.10 doğrulandı: 27.10 + 14.10 (ortak `inventory-ui.ts`, FEFO `batch.utils.ts`, `as any` 0)
- [~] 3.15 Kullanılmayan i18n anahtarları (~35) ve sabit metinler: `GTS / Karekod` (`product-detail:368`), `'Diğer'` (`:683`), `Satış:`/`adet` (`sale.service:77,97`), `FEFO ·` (`stock-count:196`), `tr-TR`/`₺`/`dd.MM.yyyy` locale sabitleri (`credit-detail:168`, `expenses:100,150`, `profile:201-275`, `sales-report:282-309`), `t().common.piece === 'pcs' ? 'd' : 'gün'` hilesi. — **31.10 kısmen:** kullanılmayan 84 anahtar silindi (14.10), metinler i18n'de. Kalan: ~35 sabit `'tr-TR'` biçimlendirme (EN dilinde TR tarih/para; ör. `dashboard.page.ts:362`, `admin/tenant-detail.page.ts:25`)
- [x] 3.16 (30.10, 14.10: `memory/` silindi, README yeniden yazıldı) `memory/TODO.md` ve `memory/SETUP.md` güncel değil (Capacitor anlatıyor, proje Tauri Android kullanıyor; "eski Ionic sayfalar" yok). Bu dosyayla değiştir.

### Test / Lint / CI
- [x] 3.17 `ng test` düzelt (Ionic kaldırılınca çözülür; değilse vitest `server.deps.inline: ['@ionic/core']`). İlk testler: `applyFEFO`, `cart.store` hesapları, `sale.service` kalem eşleme, tarih aralığı util'i. — ✅ 31.10 doğrulandı: Vitest çalışıyor (58 spec dosyası, 14.17: 430 test)
- [~] 3.18 ESLint (`angular-eslint`) + Prettier script'leri + `lint-staged`. Firestore rules için emulator testi. — **31.10 kısmen:** ESLint (`angular-eslint`) + Prettier + `npm run test:rules`. Kalan: `lint-staged` / pre-commit
  - ✅ Rules emulator testi: `tests/rules/*.spec.ts`, `npm run test:rules` (tenant izolasyonu, rol/tenantId, değişmez defterler, negatif tutar, isReversal, davet). Kalan: `lint-staged`.
- [~] 3.19 CI: Android release imzalama (keystore secret), Windows MSI için `tauri-apps/tauri-action`, tetikleyiciyi `paths:`/tag ile daralt, 4 Rust target yerine 1, `concurrency: cancel-in-progress`. `--legacy-peer-deps` sebebini (`@angular/fire@20` ↔ Angular 21) gider. — **31.10 kısmen:** Android imzalı release (keystore secret), Windows `tauri-action`, `v*` tag tetikleyici, `concurrency`, 2 Android target. Kalan: `--legacy-peer-deps` (`@angular/fire@20` ↔ Angular 21)
- [x] 3.20 `@primeng/themes` deprecated → `@primeuix/themes`'e geç (npm uyarısı). — ✅ 31.10 doğrulandı: `@primeuix/themes` 2.x

---

## 4. 🎨 UI YENİDEN TASARIM — "Glassy Dashboard"

> ⚠️ **v1 (glassy) kullanıcı tarafından reddedildi** ("renkler güzel ama tasarım kötü, karanlık mod bile kötü"). Geçerli tasarım **v2 "Saha / Komuta" — Bölüm 13**. Aşağısı tarihsel kayıttır.

### Cevap: Evet, değiştirilebilir, ama sayfa sayfa yeniden yazılacak.

**Neden:** Projede ortak bir tasarım sistemi yok. Üç ayrı stil dili karışık:
1. Tailwind sınıfları (`bg-white`, `text-gray-800`) → list/dashboard/auth sayfaları
2. Inline `style="…"` + CSS değişkenleri (`var(--bg-surface)`) → POS, layout, hareketler, sayım, formlar (pos.page'de 110, main-layout'ta 65 inline style)
3. PrimeNG Aura tema tokenları

Sabit hex renkler her yerde (`#16a34a`, `#ea580c`, `#f0fdf4`, `#374151`, gradient'ler). Hover efektleri DOM string'iyle (`onmouseenter="this.style.background=…"`). Bu yüzden "tema değiştir" ile olmaz; şablonlar yeniden yazılmalı. İyi haber: iş mantığı (`*.service.ts`, `*.store.ts`) şablonlardan ayrı, dokunulmaz.

### Teknik notlar (glassmorphism)
- `backdrop-filter: blur()` WebView2 (Tauri Windows) ve Android WebView'da destekli. Düşük seviyeli Android'de blur pahalı → `blur(12px)` üstüne çıkma, listelerde (her satırda) kullanma, sadece kart/panel/nav'da.
- Karanlık mod için glass yüzeyler `rgba(255,255,255,0.06)` + ince kenarlık; açık modda `rgba(255,255,255,0.6)`; arka planda yumuşak renkli blob/gradient zorunlu, yoksa "cam" görünmez.
- Erişilebilirlik: cam üstünde metin kontrastı ≥ 4.5:1 olmalı; yarı saydam yüzeylerde okunabilirlik için metin arkasına hafif koyu katman.
- PrimeNG bileşenleri (`p-table`, `p-dialog`, `p-select`) kendi tema tokenlarıyla gelir; `definePreset(Aura, {...})` ile marka rengi ve yarıçap tek yerden ayarlanır, cam efekti için `p-dialog`/`p-card` `styleClass` ile override.

### Görevler (sırayla, her biri ayrı ajan)
- [x] **4.1 Tasarım token katmanı.** `src/styles/tokens.scss`: renk (brand, surface, glass, text, border, status), yarıçap, gölge, blur, spacing, tipografi. Açık/koyu için tek yerde. `tailwind.config.js` bu tokenları `theme.extend` ile kullanır (`bg-surface`, `text-primary` sınıfları CSS değişkenine bağlı). `styles.scss`'teki `html.dark .bg-white {...}` elle eşleme bloğu silinir. — ✅ 31.10 doğrulandı: v2 `src/styles/_tokens.scss` (Bölüm 13, Renk v3)
- [x] **4.2 PrimeNG preset.** `definePreset(Aura, { semantic: { primary: {...yeşil} }, components: {...} })`; `@primeuix/themes`'e geç. Global `!important` override'larını (`styles.scss:24-32`) preset'e taşı. — ✅ 31.10 doğrulandı: PrimeNG preset v2/v3 + `@primeuix/themes`
- [x] **4.3 Ortak bileşenler (`src/app/shared/ui/`):** `glass-card`, `page-header` (başlık + aksiyon slotu), `stat-card` (ikon, değer, etiket, trend), `empty-state`, `status-badge`, `section` ve `data-table` sarmalayıcı (p-table + cam başlık). Her biri signal input'lu, OnPush. — ✅ 31.10 doğrulandı: `src/app/shared/ui/` (README'li, v2 görünüm)
- [x] **4.4 Layout:** sidebar + mobil bottom nav + "Diğer" sheet'i yeniden yaz (`main-layout.component.ts`, `sidebar.component.ts`). Inline style ve `onmouseenter` string'leri sıfır. Cam sidebar, aktif öğe için yumuşak pill. — ✅ 31.10 doğrulandı: v2 kabuk: sidebar, topbar, mobil alt nav, "Diğer" sheet
- [x] **4.5 Dashboard:** stat kartları (bugün/hafta/ay ciro, kâr, kritik stok, SKT), satış trendi grafiği (Chart.js veya PrimeNG Chart), son satışlar, en çok satanlar, kritik stok listesi. `dashboard.store.ts` gerçek veriyle doldurulur (2.32). — ✅ 31.10 doğrulandı: v2 dashboard (SVG `sales-trend-chart`, gerçek veri `home-calc.ts`)
- [x] **4.6 POS:** en çok inline style olan sayfa. Sol: ürün arama + hızlı grid; sağ: cam sepet paneli + büyük ödeme butonları; barkod odak göstergesi; ödeme dialogları. — ✅ 31.10 doğrulandı: POS v2 (Bölüm 13)
- [x] **4.7 Ürün listesi / detay / form** (detay 940 satır → GTS tablosu, stok banner'ı, hareket listesi ayrı bileşen). — ✅ 31.10 doğrulandı: ürün sayfaları v2, detay bileşenlere bölündü (`products/components/`)
- [x] **4.8 Müşteri / veresiye / tedarikçi / gider / rapor / profil / auth** sayfaları — aynı bileşen setiyle. — ✅ 31.10 doğrulandı: tüm sayfalar v2 (Bölüm 13, 2. aşama)
- [x] **4.9 Mobil kırılma noktaları:** `grid-template-columns: repeat(3,1fr)` gibi sabit gridler (`sales-report`, `customer-detail`) mobilde taşıyor. Her sayfa 360px'te test. — ✅ 31.10 doğrulandı: 390 px mobil kontrol (14.12), 1366 px düzen turu (14.17)
- [x] **4.10 `aria-label`** yalnızca ikonlu butonlara (`supplier-detail:34`, `expenses:108`), klavye odak halkaları. — ✅ 31.10 doğrulandı: `ui-icon-button` `ariaLabel` girişi, odak halkası `--side-hi` (preset)

**Tavsiye edilen sıra:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 (burada "beğendin mi?" kontrolü) → 4.6 → 4.7 → 4.8. Bölüm 1'deki kritik hatalar UI'dan **önce** düzeltilmeli; aksi halde yeniden yazılan şablonlar hatalı mantığı taşır.

---

## 5. 💰 SATILABİLİR ÜRÜN — Eksik özellikler

Sahada bir zirai ilaç/gübre bayisinin bekleyeceği, şu an olmayanlar:

### Çok kullanıcılı işletme (zorunlu, mimari değişiklik)
- [x] **5.1 Tenant modeli.** Şu an `tenantId == auth.uid`; yani kasiyer/personel hesabı **imkânsız** (kendi uid'siyle sahibin verisini okuyamaz, `roleGuard` sadece UI). Gerekli: `tenants/{tenantId}` + `tenants/{id}/members/{uid}` (rol), kullanıcıya **custom claim** (`tenantId`, `role`) Cloud Function ile; kurallar `request.auth.token.tenantId` kullanır. `AuthService.currentTenantId()` claim'den okur. Personel davet akışı (e-posta linki). — ✅ 31.10 doğrulandı: `tenants/{id}` + `users.tenantId/role` + `invites`; kurallar users dokümanından okur (custom claim yerine, Spark uyumlu)
- [x] **5.2 Kullanıcı yönetimi sayfası** (admin): personel ekle/çıkar, rol değiştir, pasife al. Kasiyer kendi şifresini değiştirebilsin (`/settings` şu an admin-only). — ✅ 31.10 doğrulandı: Ayarlar → Ekip (davet, rol, pasif, kişi bazlı yetkiler 14.17); kasiyer kendi şifresini `/account`'tan değiştirir

### Satış
- [~] 5.3 Fiş/makbuz yazdırma (termal 58/80 mm + A4 PDF), satış sonrası özet ekranı, satış listesi/detay sayfası (şu an satış geçmişine bakılacak ekran yok!) — **31.10 kısmen:** satış listesi/detay, 58/80 mm fiş, satış sonrası özet. Kalan: A4 PDF fiş/fatura
- [x] 5.4 Satış iptali/iade (2.1), askıya alma (bekleyen sepetler), indirim UI'ı, karma ödeme (nakit+kart) — **31.10 kısmen:** iptal (2.1), Beklet (5 sepet, F6), satır + genel indirim, nakit+veresiye karma. Kalan: nakit+kart bölünmüş ödeme (`pos.page.ts:1788-1818` yalnız nakit / kart / veresiye / nakit+veresiye) — ✅ 30.10 nakit+kart: nakit dialogunda eksik kalan "Kartla / Veresiyeye" (kart onayı kalan tutarla), `paymentMethod 'mixed'` + cashPaid/cardPaid; fiş/satış/rapor "Nakit + Kart" (`split-payment.ts`, `methodLabel`).
- [x] 5.5 Birim türü (kg, lt, paket, çuval) ve ondalıklı miktar; KDV'li/KDV'siz döküm — ✅ 31.10 doğrulandı: birimler + ondalık miktar, fişte oran bazında KDV dökümü (`receiptVatBreakdown`)
- [x] 5.6 Gün sonu / kasa kapanış raporu (nakit, kart, veresiye, tahsilat, gider) — ✅ 31.10 doğrulandı: Raporlar → kasa özeti (yazdırılabilir)

### Veresiye
- [x] 5.7 Vade tarihi, taksit takvimi, gecikmiş borç listesi, yaşlandırma raporu — 27.10.2026: veri modeli (`creditTransactions.dueDate`, `installments[{no,dueDate,amount,paidAmount}]`, `downPayment`), `CreditService.buildInstallmentPlan()`, tahsilatın en eski vadeden dağıtımı (`credit.utils.ts` → `buildSchedule`, hesaplanır; defter değişmez), veresiye listesinde "Vadesi geçenler" / "Bu hafta" filtreleri + gecikme rozeti, `CreditService.overdueSummary$()` (dashboard'a bağlanmadı), müşteri `creditLimit` + `CreditService.checkCreditLimit()`, tarih aralıklı ekstre PDF (Noto Sans gömülü). **Açık:** POS veresiye dialoguna bağlama (POS), dashboard kartı, yaşlandırma raporu (0-30/31-60/60+). — **31.10:** POS dialoguna bağlama ✅ 30.10, dashboard gecikmiş alacak kartı ✅ 30.10. Kalan: yaşlandırma raporu (0-30/31-60/60+). — ✅ 30.10 yaşlandırma: Raporlar → Yaşlandırma (`/reports/credit-aging`; vadesi gelmemiş / 1-30 / 31-60 / 61-90 / 90+, müşteri + toplam, Excel/PDF; `credit.utils.agingOf`).
- [~] 5.8 Borç hatırlatma: SMS (Netgsm/İleti Merkezi) veya WhatsApp link; tahsilat makbuzu — 27.10.2026: müşteri detayında wa.me ve `sms:` linkleri, Türkçe şablon (borç, vade, işletme adı), yalnızca iletişim rızası varsa. **Açık:** otomatik/toplu gönderim (sunucu gerekir), tahsilat makbuzu. — **31.10:** tahsilat makbuzu ✅ (Y11: yazdır / WhatsApp). Kalan: otomatik/toplu gönderim (sunucu gerekir).

### Stok / Satın alma
- [x] 5.9 Alış faturası / irsaliye girişi (tedarikçi cari hesabı, tedarikçi borcu-ödemesi) — 27.10.2026, `/purchases`, ayrıntı Bölüm 12
- [~] 5.10 Barkod etiketi yazdırma, kamera ile barkod okuma (mobil; `@zxing` kurulu ama bağlı değil) — **31.10 kısmen:** kamera ile okuma ✅ (14.6, `shared/scanner/`). Kalan: barkod etiketi yazdırma
- [x] 5.11 Stok değer raporu, en çok satanlar, kategori bazlı rapor, Excel/PDF dışa aktarma (paketler kurulu, kullanılmıyor) — **31.10 kısmen:** en çok satanlar, kategori, Excel/PDF (`report-export.ts`), İptaller ✅. Kalan: rapor olarak stok değer raporu (şu an yalnız ürün detayında stok değeri) — ✅ 30.10 stok değer raporu: `/reports/stock-value` (alış KDV hariç, satış KDV hariç/dahil, kategori + ürün, SKT yakın değer, Excel/PDF; yönetici ya da seeCosts).

### Ürün olarak satış için altyapı
- [~] 5.12 (manuel aktivasyon + deneme + salt okunur mod yapıldı, Bölüm 10; ödeme entegrasyonu açık) **Lisans/abonelik:** `tenants/{id}.plan`, `expiresAt`, deneme süresi; uygulama açılışta kontrol; ödeme (iyzico/PayTR) veya manuel aktivasyon
- [x] 5.13 **Veri yedekleme/dışa aktarma** (JSON.zip + Excel indir, boş işletmeye geri yükleme, 7 gün hatırlatması) — 27.10.2026, `/settings/backup`, ayrıntı Bölüm 12
- [~] 5.14 **Otomatik güncelleme:** Tauri updater plugin + imzalı release (GitHub Releases); Android için Play Store veya kendi APK güncelleme kontrolü — **31.10 kısmen:** Windows EXE Tauri updater ✅ (14.16a, v1.3.x). Kalan: Android APK güncelleme kontrolü
- [x] 5.15 **İlk kurulum sihirbazı:** işletme adı, adres, vergi no, logo, fiş başlığı, KDV oranları, para birimi — ✅ 31.10 doğrulandı: sihirbaz yerine Ayarlar kurulum kartı (`setup-progress.service.ts`: işletme bilgileri, fiş, yedek) + dashboard `setup-nudge` + ürün turu
- [x] 5.16 **KVKK:** aydınlatma metni, müşteri verisi silme talebi, TC no maskeleme — 27.10.2026: `src/assets/legal/aydinlatma-metni.md` (TASLAK, avukata gösterilmeli; şablon değişkenli) + `/customers/kvkk` ve form içi gösterim, ayrı açık rıza kutuları (`customers.consents.{processing,contact} = {at, version}`), TC no liste/detayda maskeli (yalnızca admin "Göster"), müşteri verisi JSON/Excel dışa aktarma, borcu 0 iken anonimleştirme. **Açık:** `creditTransactions`/`sales` içindeki `customerName` kopyası anonimleştirilemiyor (defter değişmez kuralı); yurt dışı aktarım (KVKK m.9) hukuki süreci.
- [ ] 5.17 Hata izleme (Sentry benzeri) ve kullanım analitiği; destek/geri bildirim kanalı — 31.10 hâlâ açık: `GlobalErrorHandler` yalnız yerel log (`core/error/global-error-handler.ts`); uzak hata izleme ve geri bildirim kanalı yok
- [~] 5.18 Kullanıcı dokümantasyonu / uygulama içi yardım — **31.10 kısmen:** ürün turları (14.1), `docs/KURULUM-BAYI.md`. Kalan: uygulama içi yardım/SSS, kullanıcı kılavuzu

---

## 6. 🖥️ KENDİ SUNUCUNA GEÇİŞ — Hazırlık

Şu an Firebase her yere sızmış: sayfalar ve store'lar doğrudan `inject(Firestore)` kullanıyor (`dashboard.store.ts`, `sale.service.ts`, `credit-detail.page.ts`, `sales-report.page.ts`), modeller `Timestamp` tipine bağlı, `serverTimestamp()`/`increment()`/`writeBatch` iş mantığının içinde. Bugün sunucu değiştirmek = her dosyaya dokunmak.

**Hedef:** Firebase'i tek bir katmanın arkasına almak; sonra o katmanın ikinci bir implementasyonunu (REST + PostgreSQL) yazmak. Para yokken **sadece hazırlık** (6.1-6.4) yapılır; geçiş (6.5+) sonra.

- [~] **6.1 Repository arayüzleri.** `src/app/core/data/`: `ProductRepository`, `SaleRepository`, `CustomerRepository`, `CreditRepository`, `ExpenseRepository`, `SupplierRepository`, `StockMovementRepository`, `AuthProvider`. Metotlar domain tipleriyle (`Date`, `number`), Firestore tipi yok. `InjectionToken` ile sağlanır. — **31.10 kısmen:** yalnız çiftçi modülünde (`features/farmer/data/repositories.ts`, InjectionToken). Bayi tarafında 23 dosya doğrudan `inject(Firestore)`
- [ ] **6.2 Firestore implementasyonu.** Mevcut servisler `FirestoreProductRepository` vb. olarak bu arayüzleri uygular. `Timestamp ↔ Date` dönüşümü yalnızca burada. Sayfalar/store'lar sadece arayüzü enjekte eder.
- [ ] **6.3 Modellerden `Timestamp`'i çıkar** (`shared/models/*.ts` → `Date` veya ISO string). `increment`/`writeBatch`/`runTransaction` ihtiyaçları arayüzde `adjustStock(delta)`, `recordSale(sale)` gibi niyet bazlı metotlar olur.
- [ ] **6.4 Auth soyutlaması.** `AuthProvider` arayüzü: `signIn`, `signOut`, `currentUser$`, `getToken`. JWT'ye geçince sayfalar değişmez.
- [ ] 6.5 Backend seçimi (sonra): NestJS + PostgreSQL + Prisma (tam kontrol) **veya** Supabase/PocketBase (self-host edilebilir, Firebase'e en yakın DX, çok daha ucuz). Tahmini maliyet: tek VPS (Hetzner 4 GB) ~5 €/ay.
- [ ] 6.6 Veri taşıma scripti: Firestore export → Postgres (tenant bazlı), GTS/batch yapısını ilişkisel tabloya aç (`batches` ayrı tablo olur, 2.19 sorunu da çözülür).
- [ ] 6.7 Gerçek offline için Dexie + sync kuyruğu burada anlam kazanır (REST backend offline'ı kendiliğinden yapmaz). 3.7'deki kararı buna göre ver.
- [ ] 6.8 Çok tenant'lı SaaS: subdomain veya tenant seçici, tenant başına yedekleme, loglama.

---

## 7. Önerilen çalışma sırası (sprint planı)

| Sprint | İçerik | Bölüm |
|---|---|---|
| 0 (yarım gün) | `src-tauri` geri getir, indexes.json, devtools/CSP, ölü paketleri sil, Ionic'i kaldır, `ng test` çalışır hale getir, TODO.md'yi bu dosyayla değiştir | 1.1, 1.8, 1.9, 3.10-3.12, 3.17 |
| 1 | Para/veri kaybı hataları: 1.2-1.7, 2.1-2.4, 2.7-2.8, 2.10, 2.16, 2.17 | 1, 2 |
| 2 | Güvenlik + auth: 2.34-2.41, tenant modeli (5.1-5.2) — **UI'dan önce**, çünkü tenant modeli rota/guard/servisleri değiştirir | 2, 5 |
| 3 | Veri katmanı soyutlaması 6.1-6.4 (Firebase impl. ile, davranış değişmez) | 6 |
| 4 | Raporlar/dashboard doğruluğu: 2.28-2.33, 2.24-2.25 | 2 |
| 5 | UI yeniden tasarım 4.1-4.5 (token + bileşen + layout + dashboard), onay sonrası 4.6-4.10 | 4 |
| 6 | Satılabilirlik özellikleri: satış geçmişi/fiş (5.3), iade (5.4), kasa kapanış (5.6), lisans (5.12), yedek (5.13), updater (5.14), kurulum sihirbazı (5.15) | 5 |
| 7 | Mobil: kamera barkod, Android imzalı release, CI | 3.19, 5.10 |

**Ajanlara brief verirken:** her görevde dosya yolları ve satır numaraları yukarıda; "değiştirme" demeden önce ilgili spec'i yazdır (3.17 sonrası), `ng build` ve `ng test` yeşil olmadan tamamlandı sayma. Aynı dosyaya iki ajanı aynı anda verme (özellikle `product-detail.page.ts`, `pos.page.ts`, `translations.ts`).

---

> Ayrıntılı tasarım, mevzuat ve kaynaklar: `docs/CIFTCI-MODULU.md`. Önkoşul: 2.37, 2.38, 2.41, 3.18, 5.1 ve 6.1 bitmeden başlanmaz. Otomatik ilaç/doz önerisi hiçbir sürümde olmayacak (e-reçete mevzuatı).

## 8. 🌾 Çiftçi Modülü

> Tasarım ve gerekçe: `docs/CIFTCI-MODULU.md`. **Önkoşul:** 2.37, 2.38, 2.41 (App Check), 3.18 (rules testi), 5.1 (tenant modeli) bitmiş olmalı; 6.1 repository arayüzleriyle yazılır.
> Altın kural: uygulama **ilaç/doz önermez**; öneriyi yalnızca `canPrescribe` yetkili bayi personeli yazar. Çiftçi tarafında bitki koruma ürünü kataloğu/fiyatı/sipariş **yok** (BKÜ satış yönetmeliği md. 7).

### MVP

- [x] **8.1 Modeller ve sabitler (S).** — *(2026-10-27: tek dosya `shared/models/farmer.model.ts`; customers.farmerId yerine `farmerLinks` sorgusu)*
  - **Dosyalar:** `src/app/shared/models/farmer.model.ts`, `field.model.ts`, `season.model.ts`, `application-log.model.ts`, `farmer-purchase.model.ts`, `farmer-link.model.ts`, `product-label-use.model.ts`; `src/app/features/farmer/utils/crops.ts` (ürün kodu → TR/EN ad + ikon), `units.ts`.
  - **Yapılacak:** `docs/CIFTCI-MODULU.md` §5.2'deki alanlar; `Timestamp` yerine `Date` (6.3 ile uyumlu). `customer.model.ts`'e `farmerId: string | null`, `product.model.ts`'e `requiresPrescription: boolean`.
  - **Kabul:** `ng build` yeşil; modellerde `any` yok; `farmerId` ile `uid` ayrı alanlar.

- [x] **8.2 Firestore kuralları + indeksler + emulator testleri (L).** — *(rules bloğu `// ===== ÇİFTÇİ MODÜLÜ =====`, 9 indeks, `tests/rules/farmer.spec.ts` 24 test yeşil)*
  - **Dosyalar:** `firestore.rules`, `firestore.indexes.json`, `tests/rules/farmer.rules.spec.ts`.
  - **Yapılacak:** §5.3 taslağı. `users` alanlarının (`accountType`, `tenantId`, `role`, `canPrescribe`, `farmerId`) istemciden yazılamaması (davet akışındaki farmer oluşturma hariç). İndeksler: `fields (farmerId, isActive)`, `applicationLogs (farmerId, date desc)`, `applicationLogs (fieldId, date desc)`, `purchases (farmerId, purchasedAt desc)`, `purchases (tenantId, farmerId, purchasedAt desc)`, `seasons (fieldId, sowingDate desc)`.
  - **Kabul:** Emulator testleri geçer: çiftçi A ↔ B izolasyonu; bayi X izinsiz tarlayı okuyamaz; izin geri alınınca okuyamaz; farmer hesabı hiçbir tenant koleksiyonunu (`products`, `sales`, `customers`, `creditTransactions`) okuyamaz; kullanılmış/süresi geçmiş davet reddedilir; davet `list` edilemez; çiftçi `purchases`'ta sadece `remainingQty`'yi azaltabilir.

- [x] **8.3 Davet akışı — bayi tarafı (M).** — *(bileşen `features/farmer/dealer/farmer-customer-panel.component.ts`; bağımlılıksız QR)*
  - **Dosyalar:** `src/app/features/customers/customer-detail/` (yeni "Çiftçi uygulaması" kartı), `src/app/features/customers/services/farmer-invite.service.ts`.
  - **Yapılacak:** "Davet et" → 10 karakterlik kriptografik rastgele kod (`crypto.getRandomValues`), 7 gün geçerli; QR (mevcut bağımlılıklarla veya hafif bir QR kütüphanesi) + "WhatsApp ile gönder" (`https://wa.me/<tel>?text=<encoded link>`). Bağlı çiftçide "Uygulamada ✔" rozeti ve izin özetini göster. "Yeni cihaz/PIN sıfırla" = mevcut `farmerId` ile yeni davet.
  - **Kabul:** Admin/kasiyer davet üretir; staff üretemez; aynı müşteri için aktif davet varsa yenisi eskisini geçersiz kılar.

- [x] **8.4 Davet akışı — çiftçi tarafı, giriş, PIN (L).** — *(guard'lar `features/farmer/auth/`; PIN sıfırlama = yeni sentetik e-posta yuvası `.1@`, `.2@`…)*
  - **Dosyalar:** `src/app/features/farmer/pages/invite/`, `pages/login/`, `pages/consent/`, `src/app/features/farmer/services/farmer-auth.service.ts`, `src/app/core/auth/guards/farmer.guard.ts`, `business.guard.ts`, `src/app/app.routes.ts`.
  - **Yapılacak:** `/ciftci/davet/:code` → telefon (son 4 hane eşleşmesi) + 6 haneli PIN (2 kez) → sentetik e-posta ile Auth hesabı → tek `writeBatch`: `users/{uid}`, `farmers/{id}` (yoksa), `farmerLinks/{tenantId}_{farmerId}`, davet `used`. İzin ekranı (§2.4, metin sürümü `v1`). `/ciftci/giris`: telefon + PIN. Girişte `accountType`'a göre `/ciftci` veya `/dashboard`. Mevcut bayi rotalarına `businessGuard`.
  - **Kabul:** Davetle açılan hesap sadece `/ciftci/**` görür; bayi hesabı `/ciftci`'ye giremez; aynı kod ikinci kez kullanılamaz; PIN sıfırlama davetiyle yeni uid eski `farmerId`'nin verisini görür, eski uid göremez.

- [x] **8.5 Çiftçi layout ve ana sayfa (M).** — *(Lighthouse ölçümü yapılmadı)*
  - **Dosyalar:** `src/app/features/farmer/farmer.routes.ts`, `layout/farmer-layout.component.ts`, `pages/home/home.page.ts`, `src/app/core/i18n/translations.ts` (`farmer.*`).
  - **Yapılacak:** Alt nav (Ana · Tarlalar · ➕ Kayıt · Borcum), büyük butonlar (≥56px), ≥18px yazı, yüksek kontrast, açık/koyu tema. Ana sayfa kartları: PHI uyarıları, borç özeti (`farmerLinks.balanceSnapshot`), tarla/ambar sayaçları, büyük "Kayıt ekle". "Oku" (speechSynthesis, yoksa gizli).
  - **Kabul:** 360px genişlikte yatay kaydırma yok; Lighthouse erişilebilirlik ≥ 90; ana sayfa ≤ 10 doküman okuması (soğuk açılış).

- [x] **8.6 Tarlalar ve sezonlar (M).** — *(harita pin'i yok: GPS + "Haritada aç"; çevrimdışı rozet = FarmerSyncTracker)*
  - **Dosyalar:** `pages/fields/`, `pages/field-detail/`, `pages/field-form/`, `pages/season-form/`, `services/field.repository.ts`, `services/season.repository.ts`.
  - **Yapılacak:** Tarla CRUD (ad, dekar, il/ilçe/köy, ada/parsel, sulu/kuru, konum: "Şu an buradayım" GPS veya haritada pin), "TKGM'de aç" ve "Haritada aç" linkleri. Sezon: ürün (sabit liste + ikon), çeşit, ekim/beklenen hasat tarihi, durum. İzin değişince `sharedTenantIds` toplu güncelleme yardımcı fonksiyonu.
  - **Kabul:** Offline'da tarla eklenir, çevrim içi olunca senkron olur ("bekliyor" rozeti); dekar > 0 doğrulaması; silinen tarla soft-delete (`isActive=false`).

- [x] **8.7 Satış → çiftçi ambarı (M).** — **KISMEN:** projeksiyon `farmerPurchases` (maliyet fiyatı yok, BKÜ fiyatı yok) bayinin çiftçi panelinde otomatik senkronlanır; `sale.service.ts` entegrasyonu (satış anında `syncCustomerToFarmer`) POS ajanına bırakıldı. — ✅ 31.10 doğrulandı: `FarmerSyncService` satış/iptal sonrası (`pos/services/farmer-sync.service.ts`) + `FarmerLinkWatcher` (14.14)
  - **Dosyalar:** `src/app/features/pos/services/sale.service.ts`, `src/app/features/farmer/services/purchase.repository.ts`, `pages/barn/barn.page.ts`.
  - **Yapılacak:** Satış batch'inde müşterinin `farmerId`'si ve aktif link varsa her kalem için `purchases` dokümanı (gtsNo, SKT, `requiresPrescription`, `remainingQty = quantity`). Veresiye yazımında `farmerLinks.balanceSnapshot` `increment()`. Satış iptali (2.1) yapıldığında ilgili `purchases` da iptal edilir. Ambar ekranı: ürün tipine göre gruplu, kalan miktar, SKT yaklaşan uyarısı.
  - **Kabul:** Bağlı müşteriye satış → çiftçi ambarında 1 sn içinde (online) görünür; bağlı olmayan müşteride ek yazma yok; satış batch'i atomik kalır.

- [x] **8.8 Uygulama defteri + PHI hesaplama (L).** — *(PHI kaynağı: Product.phiDays (bayi) / öneri / etiketten elle; `productLabelUses` bölümü yapılmadı — tek `phiDays`)*
  - **Dosyalar:** `pages/log-form/`, `pages/logbook/`, `services/application-log.repository.ts`, `utils/phi.util.ts` + `phi.util.spec.ts`, `utils/dose.util.ts` + spec; bayi tarafı `src/app/features/products/product-detail/` → "Etiket kullanımları" (`productLabelUses`) bölümü (ayrı bileşen, `product-detail.page.ts`'yi büyütme).
  - **Yapılacak:** 3 adımlı kayıt (§6.3). Ambardan ürün seçilirse `remainingQty` düşer. PHI: `productLabelUses` içinde `(productId, crop)` eşleşmesi varsa `earliestHarvestDate = date + phiDays`; yoksa "etiketi kontrol edin" uyarısı ve hesap yok. Sezonun beklenen hasat tarihi PHI'dan önceyse kırmızı uyarı. Her ilaç kaydında "Resmî ÜKD'ye 3 gün içinde giriniz" bilgisi. Bayi tarafında etiket kullanımı girişi sadece `canPrescribe` veya admin.
  - **Kabul:** `phi.util` testleri: aynı ürün farklı bitkide farklı PHI; birden çok ilaçta en geç tarih esas alınır; PHI verisi yoksa `null`. Doz = miktar / alan doğru, birim dönüşümleri (ml↔lt, g↔kg) testli.

- [x] **8.9 Borcum (S).** — *(bakiye `farmerLinks.balance`, bayi senkronlar)*
  - **Dosyalar:** `pages/debts/`, `pages/debt-detail/`, `services/farmer-link.repository.ts`.
  - **Yapılacak:** Bayi başına bakiye (`balanceSnapshot`), vade; detayda son 20 `purchases` (veresiye olanlar). Hareket listesi için tenant `creditTransactions`'a çiftçi erişimi **MVP'de yok** (v2, kural+indeks ile).
  - **Kabul:** İki bayiye bağlı çiftçi iki ayrı bakiye görür; bayi A'nın verisi bayi B'ye görünmez.

- [x] **8.10 Bayi tarafı: müşteri detayında çiftçi sekmesi (M).** — *(dosya: `features/farmer/dealer/`, müşteri detayına 3 satır)*
  - **Dosyalar:** `src/app/features/customers/customer-detail/farmer-tab/farmer-tab.component.ts`.
  - **Yapılacak:** İzin verilen kapsamda tarlalar, aktif sezonlar, son 10 uygulama kaydı; izin yoksa "Çiftçi bu bilgiyi paylaşmıyor". Okumalar `getDocs` (dinleyici yok).
  - **Kabul:** İzin geri alındığında sekme bir sonraki açılışta boş/uyarılı; staff rolü görmez (admin/cashier görür).

- [~] **8.11 PWA + Hosting (M).** — **KISMEN:** `public/ciftci.webmanifest` (start_url /ciftci) layout'tan bağlanır; Firestore kalıcı önbelleği sayesinde veriler çevrimdışı okunur/yazılır. **Service worker 30.10'da bilinçli olarak EKLENMEDİ** (değerlendirme, 14.9): (1) `@angular/service-worker` projede kurulu değil — paket + `angular.json` (`serviceWorker` yalnız production) + `firebase.json` (`ngsw-worker.js`/`ngsw.json` için `no-cache` başlığı; şu an `**/!(*.*)` kuralı bunları kapsamıyor) değişikliği ister; bu dosyalar paralel ajanların sahipliğindeydi. (2) Angular SW yalnız `/ciftci` kapsamına temiz biçimde sınırlanamıyor: tek `index.html` var ve `ngsw.json` kayıt kapsamına göre çözülüyor (`scope: '/ciftci/'` → `/ciftci/ngsw.json` istenir, rewrite index.html döner, SW güvenli moda düşer). Kök kapsamda kaydedilirse web'deki bayi uygulamasını da kontrol eder. **Önerilen uygulama (ayrı küçük adım):** paketi kur; `ngsw-config.json` (`navigationUrls: ['/ciftci/**']`, app grubu prefetch, lazy grup); kaydı `provideServiceWorker` ile değil yalnız `FarmerLayoutComponent`'ten `environment.production && !('__TAURI_INTERNALS__' in window)` iken `navigator.serviceWorker.register('/ngsw-worker.js')` ile yap (bayi web oturumunda navigasyonlar SW'yi atlar); `firebase.json`'a iki `no-cache` başlığı; Android Chrome'da uçak modu testi. — **31.10 kısmen:** kalan: service worker (14.15 ile birlikte ele alınmalı)
  - **Dosyalar:** `ngsw-config.json`, `public/manifest.webmanifest` (veya çiftçi için ayrı manifest), `firebase.json` (`hosting`, SPA rewrite, cache header'ları), `angular.json`.
  - **Yapılacak:** `@angular/service-worker`; `start_url: /ciftci`; "Ana ekrana ekle" yönlendirmesi; çiftçi lazy chunk'ı ≤ 250 KB gz; Tauri build'ini bozmamak (service worker Tauri'de devre dışı).
  - **Kabul:** Android Chrome'da ana ekrana eklenir, uçak modunda açılır ve önceki veriyi gösterir; `ng build` + Tauri build yeşil.

- [~] **8.12 KVKK metinleri ve izin yönetimi (S, + hukuk incelemesi).** — **KISMEN:** izin yönetimi, bağlantı koparma, silme talebi, yasal metinler arayüzde; `docs/legal/ciftci-aydinlatma-v1.md` (avukat) yok. — **31.10 kısmen:** kalan: avukat onaylı aydınlatma metni
  - **Dosyalar:** `src/app/features/farmer/pages/consent/`, `pages/settings/`, `docs/legal/ciftci-aydinlatma-v1.md` (metin taslağı, avukat onayı bekler).
  - **Yapılacak:** İzinleri ayrı ayrı aç/kapa, bayiyle bağlantıyı kopar (`status=revoked`), hesabımı ve verilerimi sil talebi (MVP: talep kaydı + bayi/yönetici manuel işlem). Uygulama içinde "Bu kişisel defterinizdir, resmî ÜKD değildir" ve "Uygulama ilaç/doz önermez" metinleri.
  - **Kabul:** İzin kapatınca ilgili dokümanların `sharedTenantIds`'inden tenant çıkar (rules testi 8.2 ile doğrulanır); metin sürümü ve tarih kaydedilir.

- [ ] **8.13 Pilot ve ölçüm (S).**
  - **Yapılacak:** 1 bayi, 10–20 çiftçi. Firebase kullanım panelinde günlük okuma/yazma takibi; çiftçi başına ortalama okuma ölçülür ve `docs/CIFTCI-MODULU.md` §7.3 tahmini güncellenir.
  - **Kabul:** 4 hafta sonunda: haftalık aktif çiftçi oranı, günlük okuma/çiftçi, bayinin geri bildirimi raporlanmış.

### v2 (MVP pilotundan sonra)

- [x] **8.14 Bayi mühendisi önerisi + e-reçete no (L).** `recommendations` koleksiyonu; sadece `canPrescribe`; reçeteli ürün içeriyorsa `prescriptionNo` zorunlu (rules); değiştirilemez, sadece geri çekilir; çiftçide "Bayinizin önerisi — Müh. Ad Soyad (yetki no)". Öneriden tek dokunuşla uygulama kaydı. **Kabul:** yetkisiz kullanıcı öneri yazamaz (rules testi); öneri içeriği güncellenemez. — *(MVP ile yapıldı; rules testli)*
- [~] **8.15 Reçete görüntüleme (S).** Öneri/satış kalemine e-reçete no ve (Storage kotası doğrulanırsa) fotoğraf/PDF. — **31.10 kısmen:** e-reçete no satış kaleminde ve öneride ✅ (11.2, 8.14). Kalan: fotoğraf/PDF
- [x] **8.16 Hava durumu ve ilaçlama uygunluk şeridi (M).** MET Norway Locationforecast, istemci önbelleği 1 saat, CC BY 4.0 atfı, ayarlanabilir eşikler (§7.4). **Kabul:** aynı tarla için saatte en fazla 1 istek; atıf metni görünür; Firestore'a yazma yok. — *(MVP ile yapıldı; tarayıcı User-Agent gönderemez → Origin/Referer; Tauri CSP'ye `https://api.met.no` eklenmeli)*
- [ ] **8.17 Yerel hatırlatmalar (M).** Vade yaklaşan borç, PHI bitişi, ÜKD'ye giriş hatırlatması (kayıttan 2 gün sonra) — istemci tarafı yerel bildirim (PWA Notification / Tauri notification plugin). Sunucu push'u kendi sunucuya geçince.
- [ ] **8.18 Ön talep — sadece gübre/tohum/malzeme (M).** `preOrders`; bayide talep listesi ve durum. BKÜ kategorisindeki ürünler seçilemez. **Kabul:** kategori kontrolü hem UI'da hem rules'ta.
- [ ] **8.19 Maliyet ve dekar başı kârlılık (M).** `costEntries` + ambar alış fiyatları + hasat geliri → sezon raporu.
- [~] **8.20 Veresiye hareketleri çiftçiye (M).** `creditTransactions` için `(tenantId, customerId)` sorgusuna çiftçi okuma kuralı (`farmerLinks` üzerinden) + indeks. — **31.10 kısmen:** Borcum'da sıradaki ödeme/gecikme/taksit planı `farmerLinks.schedule` ile (14.14). Kalan: hareket listesi (okuma kuralı + indeks)
- [ ] **8.21 Ayrı Android paketi (M).** TWA veya ikinci Tauri config; imzalı release (3.19 sonrası).
- [ ] **8.22 Bayisiz kayıt + bağlantı isteği (M).**

### v3

- [ ] **8.23 Toprak analizi kaydı (M).**
- [ ] **8.24 Gübre hesaplayıcı (saf madde → ticari gübre, aritmetik) (M).** Girdi kaynağı (lab/mühendis) zorunlu; dönüşüm katsayıları testli.
- [ ] **8.25 Sezon şablonları (bayi mühendisi) (L).**
- [ ] **8.26 Hasat kaydı ve sezon dökümü PDF (M).** Resmî belge görünümünde olmamalı.
- [ ] **8.27 Sesle kayıt (M).**

---

## 9. 🚀 EXE / sürüm çıkarma (2026-10-27 kuruldu)

- [x] `src-tauri` silinen 92 dosya HEAD'den geri getirildi.
- [x] Release'de devtools kapalı, CSP tanımlı, kullanılmayan dialog/fs plugin'leri çıkarıldı, NSIS (setup.exe) + MSI hedefleri.
- [x] `.github/workflows/windows-release.yml`: `v*` tag'i atınca Windows'ta derler, Releases'e taslak olarak exe+msi yükler.
- [x] `npm run release -- 1.0.1`: sürümü 4 dosyada günceller, commit + tag + push.
- [x] Android iş akışı her push yerine sadece tag/elle çalışır.
- [x] Tauri updater: `npx tauri signer generate` ile anahtar üret, private key'i GitHub secret `TAURI_SIGNING_PRIVATE_KEY` olarak ekle, `tauri-plugin-updater` + `latest.json` endpoint'i (Releases). — ✅ 31.10 doğrulandı: 14.16(a) `tauri-plugin-updater`, `latest.json` (Releases), secret'lar eklendi; v1.3.1 ilk imzalı güncelleme sürümü
- [ ] Windows kod imzalama sertifikası (SmartScreen uyarısını kaldırır; satış öncesi).
- [x] Android release keystore + imzalı AAB. — ✅ 31.10 doğrulandı: `.keys/tarim-market-release.jks`, CI imzalı APK + AAB (14.5); v1.3.1 imzalı derleniyor

---

## 10. 🛡️ Superadmin, destek modu ve lisans — 27.10.2026

Ayrıntı: `docs/SUPERADMIN.md`, kurallar: `firestore.rules.md`.

- [x] 10.1 `platformAdmins/{uid}` (yalnız Console'dan), kurallarda `isSuperAdmin()`; tüm veri koleksiyonlarında `|| supportOk()` (tenantId değiştirme yasağı korunur), users/tenants/invites/auditLogs yetkileri.
- [x] 10.2 Destek modu: `AuthService.supportSession` (sessionStorage), `currentUser`/`currentTenantId` destek modunda seçilen işletme + admin; kırmızı şerit "Destek modu: <ad> — Çık"; `createdBy` = superadmin uid.
- [x] 10.3 KVKK: `tenants.supportAccess` (varsayılan true; kapalıyken kurallar veri erişimini reddeder), `auditLogs` (support_start/end, license_change, user_change; değiştirilemez), `TenantInfoService.setSupportAccess()`, `SupportAccessLogComponent`.
- [x] 10.4 Lisans: `plan/status/trialEndsAt/licenseExpiresAt/maxUsers`; kayıtta 30 gün deneme; lisans alanlarını yalnız superadmin değiştirir (kurallar `hasOnly`); `LicenseService` + 7 gün uyarı şeridi + `/license` ekranı + salt okunur mod (kurallar: create/update/delete reddi; `licenseGuard` POS; `FirestoreService` kontrolü); ekip davetinde maxUsers (istemci).
- [x] 10.5 `/admin` paneli: genel bakış, işletme listesi (arama/filtre), işletme detayı (lisans uzat/askıya al, kullanıcı rol/pasif/şifre sıfırlama, destek modu, denetim kaydı).
- [x] 10.6 Superadmin tenant'a bağlı değil: users dokümanı yoksa tenant oluşturulmaz, giriş sonrası `/admin`.
- [x] 10.7 Menüde "Yönetim Paneli" (yalnız superadmin), rules testleri `tests/rules/superadmin.spec.ts` (23 test, `npm run test:rules` yeşil).
- [x] 10.8 `SupportAccessLogComponent`'i Ayarlar sayfasına yerleştir: Ayarlar → Destek erişimi (`/settings/support`).
- [ ] 10.9 `SUPPORT_CONTACT` (`core/license/license.config.ts`) gerçek telefon/e-posta ile değiştirilmeli. — 31.10 hâlâ açık: hâlâ yer tutucu `0 (850) 000 00 00` / `destek@tarimmarket.app` (`license.config.ts:5-8`)
- [~] 10.10 Canlıya geçişte: rules + `auditLogs` indeksi deploy; ilk superadmin'i Console'dan ekle; eski işletmelere (plan yok = kısıtsız) panelden plan ata. — **31.10 kısmen:** rules + indeksler canlıda (31.10). Kalan: ilk superadmin'i Console'dan ekleme. Eski işletmelere plan atama gereksiz (canlı veri silindi)
- [ ] 10.11 Online ödeme (iyzico/PayTR) ve otomatik lisans uzatma (Functions gerektirir → Blaze veya kendi sunucu).
- [ ] 10.12 maxUsers kurallarda zorlanamıyor (sayım yok); davet kabulünde sunucu tarafı kontrol yok.
- [ ] 10.13 Destek modundaki tek tek veri değişiklikleri auditLogs'a yazılmıyor (yalnız oturumlar); gerekirse servis katmanında kayıt.
- [ ] 10.14 Superadmin hesabı için 2FA (Firebase Auth MFA, Identity Platform gerektirir) değerlendirilmeli.

## 11. ⚖️ Hukuki uyum (bayi / satış tarafı) — 27.10.2026

**Mevzuat özeti:** 13.12.2025 tarihli, 33106 sayılı RG — *Bitki Koruma Ürünlerinin Toptan ve Perakende Satılması ile Depolanması Hakkında Yönetmelik*; pilot iller dışında reçete hükümleri 1.7.2026'dan beri yürürlükte.
- Reçeteli ürün reçetesiz satılamaz (md. 5/5, 21/o); kullanıcı e-reçete **numarası** üzerinden alır (md. 18/4); reçeteli satış kayıtları ve fiş/fatura **5 yıl** saklanır (md. 21/o).
- Alış/satış/iade takip sistemine işlem anında bildirilir; karekodlu ürün bildirmeden stoğa alınamaz/çıkarılamaz (md. 21/m-n).
- Kullanma süresi geçmiş ürün bulundurulamaz/satılamaz (md. 21/b); 30 gün içinde firmaya iade (md. 21/ş).
- İnternet/sosyal medyada BKÜ tanıtım ve satışı yasak (md. 7).
- B-Reçete: reçete için ÇKS/TÜKAS/KOBÜKS kaydı gerekiyor; reçetesiz satışa idari para cezası.
- Gübre: piyasaya arz edilen gübrelerin izlenmesi tebliği (karekod + DNA bandrol, son kullanıcıya teslimde TC/VKN) — güncel bayi bildirim yükümlülüğü ayrıca doğrulanmalı.

Kaynaklar: [Yönetmelik metni (alomaliye)](https://www.alomaliye.com/2025/12/13/bitki-koruma-urunlerinin-toptan-ve-perakende-satilmasi-ile-depolanmasi/amp/) · [B-Reçete 2026 (alomaliye)](https://www.alomaliye.com/2025/12/15/zirai-ilaclarda-b-recete-donemi-2026da-basliyor/) · [5 soruda B-Reçete (CNBC-e)](https://www.cnbce.com/haberler/tarimda-yeni-donem-5-soruda-b-recete-uygulamasi-g23305) · [Habertürk – reçetesiz satışa ceza](https://www.haberturk.com/tarimda-b-recete-donemi-basliyor-zirai-ilaclar-yakindan-takip-edilecek-recetesiz-urun-satana-ceza-3854759-ekonomi) · [Gübre karekod takibi (Bloomberg HT)](https://www.bloomberght.com/gubreye-karekodlu-ve-barkodlu-takip-2000733) · ayrıntı: `docs/CIFTCI-MODULU.md` §4.

**Yapıldı:**
- [x] 11.1 Ürün modeli: `productType` (bitki_koruma/gubre/tohum/fide/diger, kategoriden önerilir), `requiresPrescription` (bitki korumada varsayılan açık), `licenseNo`, `activeIngredient`, `phiDays` (bilgi amaçlı), `toxicityClass`, `supplierId`. Formda ve detayda "Mevzuat" bölümü (`product-regulatory-fields`, `product-regulatory-card`). Eski ürünlerde bayrak yoksa reçete istenmez (satış kilitlenmesin).
- [x] 11.2 POS e-reçete: reçeteli ürün varken ödeme öncesi e-reçete penceresi (müşteri zorunlu, e-reçete no, opsiyonel reçeteyi yazan). Servis tarafında da zorunlu (`PrescriptionRequiredError`). `SaleItem.prescriptionNo/requiresPrescription/licenseNo/gtsNos`, `Sale.hasPrescriptionItems/prescriptionNo/prescriberName/customerTcNo/customerCksNo`.
- [x] 11.3 Ayar: `tenants/{id}.settings.prescriptionMode: 'required'|'warn'|'off'` (varsayılan required), okuyucu `core/settings/tenant-settings.service.ts`. UI'ı ayarlar ajanı yapacak (çeviriler hazır: `compliance.prescriptionMode*`, `mode*`).
- [x] 11.4 GTS satışta seçim (2.11), fişte ve satış detayında GTS + ruhsat no + e-reçete no.
- [x] 11.5 Satış listesi: "Reçeteli satışlar" filtresi + Excel (tarih, müşteri, TC, ÇKS, ürün, ruhsat no, miktar, birim, GTS, reçete no, reçeteyi yazan).
- [x] 11.6 SKT geçmiş bitki koruma ürünü: sepete eklenemez, satışta ENGEL (`ExpiredPlantProtectionError`); diğer ürünlerde onay akışı korunuyor.
- [x] 11.7 Fiş ve ürün sayfasında "öneri/doz" dili yok; Mevzuat kartında "uygulama kullanım tavsiyesi vermez" notu.

**Kalan:**
- [x] 11.8 `firestore.rules`: tenant update kuralında `settings` zaten izinli (superadmin ajanı). Öneri: `settings.prescriptionMode in ['required','warn','off']` doğrulaması eklensin. `sales` create'te alan listesi yok, yeni alanlar sorunsuz yazılıyor. — ✅ 31.10 doğrulandı: tenant update'te `settings.prescriptionMode in ['required','warn','off']` (`firestore.rules:283`)
- [x] 11.9 Ayarlar UI'ında e-reçete modu seçimi (+ 'warn'/'off' seçerken sorumluluk uyarısı) — Ayarlar → Satış ayarları (30.10.2026).
- [ ] 11.10 Bakanlık B-Reçete / BKÜ takip sistemi entegrasyonu (API yok/kamuya açık değil): şimdilik elle; satışta "takip sistemine bildirildi" işareti ve günlük bildirim listesi düşünülebilir.
- [x] 11.11 Reçeteli satış kayıtlarının 5 yıl saklanması: satış silme yok (iptal soft) — yedek/dışa aktarma (5.13) ile garanti altına alınmalı; KVKK aydınlatmasına TC/ÇKS saklama amacı eklenmeli (5.16). — ✅ 31.10 doğrulandı: `sales` için delete kuralı yok (yalnız kurallı iptal), aydınlatma metninde yasal kayıt/saklama amacı + ÇKS, yedekleme (5.13)
- [x] 11.12 Müşteri modelinde ÇKS no (`cksNo`) — müşteri ajanı; dışa aktarma bu alanı okuyor. — ✅ 31.10 doğrulandı: `Customer.cksNo` (`customer.model.ts:32`) + müşteri formu (14.13)
- [x] 11.13 SKT geçmiş BKÜ için "firmaya iade (30 gün)" çıkış hareketi türü ve listesi. — ✅ 30.10 Alışlar → Firmaya iadeler (`/purchases/returns`): "iade edilmeli (30 gün)" listesi, parti/GTS seçimli iade, `supplierReturns` + stok çıkışı tek transaction (`ProductService.removePickedInTx`), yalnız yönetici (kurallar).

---

## 12. ➕ Ek modüller

### Yapıldı (27.10.2026)
- **Satın alma / alış faturası + tedarikçi cari (5.9)** — `src/app/features/purchases/`, `suppliers/supplier-account/`.
  - Veri: `purchases` (kalemler: miktar, KDV hariç birim fiyat, KDV %, SKT, GTS listesi, eklenen `batchIds`; iskonto, KDV, genel toplam; peşin/vadeli + vade; `status` active/cancelled), `supplierTransactions` (purchase/payment, `balance` = işlem sonrası, iptal = `isReversal` negatif kayıt), `suppliers.balance/totalPurchased/totalPaid`.
  - Kayıt tek `runTransaction`: ürün stok + parti (adjustStock kuralları: GTS'li birim = qty:1 parti), `stockMovements` 'in' (reference = alış id), opsiyonel `purchasePrice` güncellemesi, cari. Peşin alışta alış + ödeme kaydı birlikte yazılır. Çevrimiçi zorunlu.
  - İptal: önce bu alışın partileri, sonra FEFO düşülür; stok 0'ın altına inmez (satılmış miktar uyarı olarak döner); cari ters kayıt.
  - `PurchaseService.summary(start, end): Promise<{ totalPurchases, purchaseCount, totalPaid, supplierDebt }>` — rapor sayfasına henüz bağlanmadı.
  - Kurallar: `// ===== SATIN ALMA =====` bloğu; testler `tests/rules/purchases.spec.ts`.
- **Yedekleme & dışa aktarma (5.13)** — `src/app/features/backup/` (`BackupPanelComponent`, geçici rota `/settings/backup`).
  - 9 koleksiyon tek JSON (fflate ile .zip) + Excel (her koleksiyon bir sayfa). Timestamp'ler `{__type:'timestamp'}` olarak saklanır.
  - Geri yükleme yalnız boş işletmeye; tenantId mevcut işletmeyle değişir, belge kimlikleri yenilenip tüm referanslar eşlenir, 500'lük writeBatch parçaları.
  - `BackupService.isBackupOverdue()` (tenants.lastBackupAt > 7 gün) — dashboard uyarısı henüz bağlanmadı.
  - Kalan: ayarlar sayfasına gömme, dashboard uyarısı, Spark günlük 20k yazma sınırını aşan büyük geri yüklemeler için günlere bölme.

### İleride eklenebilecek modüller
| Modül | Gerekçe | Büyüklük |
|---|---|---|
| Fiyat listesi / toptan fiyat | Bayiler çiftçiye, kooperatife, alt bayiye farklı fiyat verir; müşteri grubuna göre otomatik fiyat | M |
| Kampanya / sadakat | Sezon indirimi, X al Y öde, puan; tekrar gelen çiftçiyi tutar | M |
| Sezon ön sipariş | Gübre/tohum sezon öncesi kapora ile rezerve edilir; stok planlama ve nakit akışı | M |
| Terazi entegrasyonu | Dökme gübre/tohum kg satışında elle giriş hatasını önler (seri port / barkodlu terazi etiketi) | M (Tauri tarafı) |
| e-Arşiv / e-Fatura | Yasal zorunluluk sınırını geçen bayiler için; özel entegratör API'si (sunucu gerekir) | L |
| Çoklu şube | Birden fazla dükkânı olan bayi; şube bazlı stok, kasa, rapor | L (veri modeli) |
| Stok transferi | Şubeler/depo arası sevk; çoklu şubenin önkoşulu | M |
| Depo / raf yeri | Büyük depoda ürünün yerini bulma, sayımı hızlandırma | S |
| Tedarikçi vade takibi | Alış vadesi yaklaşan/geçen borç listesi ve hatırlatma (alışta `dueDate` zaten var) | S |
| Alış iadesi (kısmi) | Şu an yalnız tüm belge iptal ediliyor; kalem bazlı iade | S |

---

## 13. 🎨 Tasarım v2 — Saha / Komuta

Prototip: `docs/design/c-saha-komuta/index.html` (seçilen). B'den (`docs/design/arsiv/b-bento-yumusak`) büyük "Bugünkü ciro" kartı ve POS hızlı para butonları alındı.
Kılavuz (eski→yeni tablo, bileşenler, sayfa iskeleti): **`src/app/shared/ui/README.md`**.

### 1. aşama — temel + kabuk + vitrin (27.10.2026) ✅
- [x] Tokenlar (`src/styles/_tokens.scss`): kâğıt açık tema (#f6f4ee / #fffefb / #e2ddd1), kömür koyu tema (#121412 katmanları), `-text` tonları, kalıcı koyu sidebar (`--side-*`), tarla çizgisi (`--furrow-pattern`). Eski token adları korundu, değerleri v2.
- [x] Cam / blur / blob kaldırıldı; `.glass*` → opak C kartı (geriye uyum). Yeni: `.ui-card`, `.card-head` (başlık şeridi), `.kbd`, `.field-dark`, `.num` (Manrope).
- [x] Fontlar çevrimdışı: Inter (gövde) + Manrope (`@fontsource-variable/manrope`, başlık + rakam).
- [x] PrimeNG preset v2: input 44px, buton 42/52px, düz "secondary", dialog başlık şeridi, opak select/datepicker, tablo başlığı, toast sol şerit, tooltip, toggle.
- [x] Ortak bileşenler v2 görünüm (API korundu): glass-card (`tone`, `tinted`), page-header (başlık topbar'a taşınır), stat-card (C durum bloğu, `tinted`, `trendLabel`), empty-state, status-badge (6px pill), section, icon-button (`outline`), money, avatar, auth-shell.
- [x] Yeni bileşenler: `ui-segmented`, `ui-kbd`, `ui-settings-row`, `ui-progress-ring`, `ui-quick-cash` (B), `ui-logo-mark`, `PageTitleService`.
- [x] Kabuk: koyu sidebar (logo + işletme, Hızlı Satış F2, Operasyon/Analiz/Yönetim grupları, kritik stok / gecikmiş veresiye sayaçları, çevrimiçi durumu, kullanıcı, daraltma — <1280px varsayılan dar), topbar (başlık + tarih, arama Ctrl+K, çevrimdışı/açık sepet rozeti, uyarı zili, tema/dil, kullanıcı menüsü), mobil koyu üst çubuk + alt nav (ortada turuncu Satış) + "Diğer" sheet. Global F2 → POS.
- [x] Dashboard: B ciro kartı (satış + vade farkı, nakit/kart/veresiye), brüt kâr, gecikmiş alacak (`overdueSummary$`), dikkat gerekenler, satış trendi (7/14/30G), hızlı işlemler, son satışlar tablosu, kritik stok & SKT; yedek hatırlatması (`isBackupOverdue`), lisans uyarısı.
- [x] Giriş/kayıt/şifre/doğrulama: koyu tarla desenli tanıtım paneli + kâğıt form (auth-shell).
- [x] Lisans ekranı (C plan kartı) ve destek/lisans şeritleri (tam genişlik).
- [x] Tauri CSP `connect-src` → `https://api.met.no`.

### 2. aşama — sayfa dönüşümü (README "Dönüştürme kılavuzu")
- [x] POS (`features/pos`) — C düzeni: büyük barkod alanı, sonuç satırları, sık satılanlar, sepet kartı, F1/F2/F3 ödeme, **`ui-quick-cash`**, satış sonrası özet (30.10.2026; + veresiye vade/peşinat/taksit planı + limit uyarısı, Beklet (5 sepet), satış/iptal sonrası çiftçi ambarı senkronu 8.7)
- [x] Ürünler: liste, detay, form, stok hareketleri (`features/products`) — C özet şeridi, çip filtreler, stok çubuğu ✅ 30.10.2026 (liste: özet şeridi + durum/kategori çipleri sayaçlı + barkodsuz filtresi, tablo stok çubuğu/SKT/kâr oranı/kritik kırmızı kenar, telefonda kart; detay: Stok kartı + Fiyat ve kâr + Mevzuat + GTS + son hareketler; form: 5 bölüm + atlama çubuğu + yapışkan özet, Ctrl+S; hareketler: özet şeridi + segment filtre + tablo). Ortak: `products/components/sum-strip.component.ts`, `products/inventory-ui.ts`, metinler `products/inventory.i18n.ts` (`t().inventory`)
- [x] Satışlar: liste + detay (`features/sales`) — özet şeridi, durum çipleri, C tablosu, ödeme/durum pill'leri, vade/peşinat (30.10.2026)
- [x] Veresiye: liste + detay (`features/credit`) — C müşteri başlığı, borç şeridi, taksit planı, hareket zaman çizelgesi (30.10.2026: `customer-account-header`, `installment-schedule`, `credit-timeline` bileşenleri; liste 4 durum bloğu + çip filtre + tablo; metinler `features/credit/account.i18n.ts` → `t().acc`)
- [x] Müşteriler: liste, detay, form, KVKK (`features/customers`) (30.10.2026: detay = C müşteri başlığı + taksit planı + son 6 hareket + bilgi/KVKK + çiftçi paneli; liste tablo + Tümü/Borçlu/Arşiv; form 4 bölüm kartı)
- [x] Tedarikçiler, Alışlar (`features/suppliers`, `features/purchases`) — tedarikçiler ✅ 30.10.2026 (liste tablo + özet, detayda C cari kartı + hareket zaman çizelgesi); alışlar ✅ 30.10.2026 (liste: özet şeridi + C tablo/telefon listesi; form: belge + kalemler solda, toplam + ödeme sağda yapışkan; detay: özet şeridi + kalem tablosu + belge kartı)
- [x] Giderler (`features/expenses`), Stok sayımı (`features/stock-count`) — giderler ✅ 30.10.2026 (dönem seçici, 4 durum bloğu, C tablo + kategori dağılımı); stok sayımı ✅ 30.10.2026 (özet şeridi, Tümü / Yalnız farklar / Sayılmayan çipleri, satır sol kenarı eksik-kırmızı/fazla-sarı/tutan-yeşil)
- [x] Raporlar (`features/reports`) — `ui-segmented` dönem, 4 KPI (ciro/brüt/net/tahsilat), kâr zinciri, trend, **Alışlar & tedarikçi borcu** kartı (`PurchaseService.summary`), kasa özeti yazdır, en çok satanlar, kategori
- [x] Ayarlar: genel, ekip, profil, yedek (`features/settings`, `features/backup`) — C ayar menüsü + `ui-settings-row` + `ui-progress-ring` (30.10.2026: `/settings/:bölüm` 13 bölüm, `/account?s=` kişisel bölümler, kurulum kartı gerçek veriden; Görünüm: tema/yoğunluk/yazı boyutu `ThemeService`; ayar alanları `core/settings/tenant-settings.model.ts`)
- [x] Superadmin paneli (`features/admin`) — *(30.10.2026: kendi koyu kabuğu + kırmızı "SUPERADMIN" kimliği, başlık PageTitleService ile topbar'da; işletmeler tablosu/mobil satırlar, plan/durum pill'leri, bitiş ≤7 gün kırmızı / ≤30 gün sarı; detay: C plan kartı + uzat, kullanıcılar, denetim zaman çizelgesi; "Destek modunda aç" onay penceresiyle; support-access-log zaman çizelgesi)*
- [x] Çiftçi modülü (`features/farmer`) — kendi kabuğu; `bg-white/text-gray-*` sabit renkleri tokenlara — *(30.10.2026: koyu üst çubuk + 5 sekmeli koyu alt çubuk (Ana sayfa · Tarlalarım · Defter · Bayim · Hesap), `farmer-ui.ts` F sınıfları token'lı (56px+ buton, ikon karesi, kart başlık şeridi), tüm sayfalar + giriş/davet (field-dark başlık), hava kartı (rüzgar/yağış ikonlu, CC BY atfı), bayi paneli + öneri/yetkili dialogları C'de; hukuki metinler nötr "legal" kutusunda)*

### Cila (30.10.2026) — ortak katman
- [x] Yazı boyutu her yerde: 656 `text-[Npx]` → rem (79 dosya; `scripts/codemods/px-to-rem-text.mjs`, Tailwind `fontSize` isimli adımlar `text-10…text-28`); `_base/_components.scss` px yazılar rem; sidebar genişliği rem (14.75rem / 4.5rem), ayarlar menü sütunu rem.
- [x] Koyu tema: `ui-segmented` seçili öğe `.seg-on` (`--seg-on-*`, koyuda #3a423c + halka); tonlu kart (`.ui-tinted`) içindeki soft pill'e tonlu halka + hafif koyu zemin; ConfirmDialog severity'siz "İptal" düz buton.
- [x] `scripts/contrast-check.mjs`: tüm `-soft`/`-text` (kart/sayfa/şerit/tonlu kart) + dolu/gri çiftler iki temada AA (en düşük 4.83: açık tema dolu `danger` + beyaz).
- [x] PrimeIcons yalnız woff2/woff (`src/styles/_primeicons.scss`, üretici `scripts/codemods/primeicons-css.mjs`).
- [x] `providePrimeNG({ overlayAppendTo: 'body' })` (app.config) — dialog içi select/autocomplete kırpılmasın, tekrar eden `appendTo="body"` kalkar. Kalan px yazı: grafik SVG (`sales-trend-chart` 11.5/12px), Chart.js tick `font.size`, fiş (yazıcı, bilerek px). — ✅ 31.10 doğrulandı: `app.config.ts:40`; kalan px yazılar bilerek (SVG grafik, fiş)

### Renk v3: Adaçayı & Krem (30.10.2026) ✅
- [x] Kullanıcı v2 renklerini "çok koyu" buldu; `docs/design/renk-secenekleri/index.html` 3 varyantından **2 — Adaçayı & Krem** seçildi. `_tokens.scss` açık + koyu tüm tokenlar prototip tablosuyla birebir (krem #f7f4ec / #fffdf8, adaçayı #9ec6a2 + koyu mürekkep #1b3822, şeftali #eab691, sidebar #edf0e4; koyu tema zeytin-kömür #22231e / #2a2b25). Token adları korundu.
- [x] Koyu blok kalmadı: sidebar, mobil üst/alt çubuk, admin kabuğu (ince kırmızı şerit + SUPERADMIN rozeti korunarak açık), çiftçi kabuğu, ciro kartı / giriş paneli / plan kartı (`.field-dark` → açık adaçayı + `--furrow`), POS kart butonu (düz kâğıt), filtre çipleri seçili hali (`bg-brand-soft`).
- [x] PrimeNG preset: adaçayı `primary` ölçeği (50–950), `contrastColor` koyu mürekkep, outlined/text/link buton + sekme metni `--brand-text`, odak halkası `--side-hi`, toggle seçili tutamak koyu; nötr ölçekler krem / zeytin.
- [x] Pastel dolgu metin olarak kullanılmıyor: `text-brand|danger|success|info|warning` → `-text`; `text-white` / `bg-black/*` / sabit rgba düzeltmeleri; grafik paleti (`--chart-1..6` + report-calc yedekleri); `<meta theme-color>` açık/koyu.
- [x] `scripts/contrast-check.mjs` yeni çiftlerle (sidebar aktif, ciro trend, sayaç rozetleri, nötr dolu) — iki temada tümü AA.

---

## 14. 📝 Kullanıcı istekleri — 30.10.2026 (sıradaki tur; kullanıcı "devam" deyince başlanacak)

> Durum: v1.1.0 main'e birleştirildi, Firestore kuralları/indeksleri canlıya yüklendi, canlı veriler kullanıcı tarafından silindi. Kullanıcı `npm run release -- 1.1.0` çalıştırdı (tag v1.1.0 gönderildi; Windows ve Android iş akışları tetiklendi — sonuçları henüz kontrol edilmedi).

- [x] **14.1 Ürün turu (onboarding):** ✅ 30.10.2026 — **driver.js 1.9 (MIT)** seçildi: Shepherd.js v14+ AGPL-3.0 + ücretli ticari lisans, intro.js AGPL/ticari → satılan üründe sorunlu; driver.js çerçevesiz, `role=dialog`+aria, Tab odak tuzağı, ok/Esc, iç kutu kaydırma. `src/app/core/onboarding/`: `TourService` (başlat/atla/bitir, durum `users/{uid}.onboarding = { version, completedTours['id@sürüm'], dismissed?, nudgeHidden? }` + localStorage yedeği; tur `version` artınca yalnız `since` > eski sürüm olan adımlar gösterilir), `tour-runner.ts` + `tour-theme.ts` **yalnız dinamik import** (ayrı ~9.5 KB gz chunk; Adaçayı & Krem tokenlarıyla tema, telefonda alt sayfa — öğe alttaysa üst sayfa, çiftçide büyük yazı), `tour-host` kökte `@defer (on idle)` (Firestore/Dialog ilk yüklemeye girmez; initial 1.11 MB), `setup-nudge` (dashboard: karşılama turu görüldükten sonra kurulum %<100 ise Ayarlar kurulumuna kısayol, "Gizle" kalıcı). Turlar (TR+EN): hoş geldin/admin 8 adım (menü → Hızlı Satış F2 → Ürünler/karekod → Veresiye → Raporlar → Ayarlar kurulum → yardım), kasiyer 6, POS 6 (POS'a ilk girişte kendiliğinden; arama+kamera, sık satılanlar, sepet, F1/F2/F3, veresiye+e-reçete, fiş), çiftçi 5 (ÜKD uyarısı), superadmin 6 (KVKK destek modu). İlk girişte karşılama modalı (Başla / Sonra [oturumluk] / Bir daha gösterme). Erişim: topbar kullanıcı menüsü "Turu başlat" + "Bu sayfayı tanı" (sayfa turu varsa ayrıca topbar'da ? düğmesi), mobil "Diğer" sayfası, Ayarlar > Hakkında "Tanıtım turunu tekrar izle", çiftçi Ayarlar, superadmin üst çubuk pusula. `data-tour` öznitelikleri: sidebar/alt nav (`nav-*`), topbar `user-menu`, POS (`pos-search/favorites/cart/customer/pay/receipt`), admin paneli (`sa-*`), çiftçi alt nav. Kurallar: users self-update listesine `onboarding` (harita) eklendi + `tests/rules/users.spec.ts` testi. Emulator'de admin (masaüstü koyu+açık), kasiyer ve çiftçi (390px), superadmin (koyu) uçtan uca denendi. **Canlıda rules deploy gerekli** (deploy edilene kadar yazma reddedilir, durum cihazda kalır — zararsız).
- [x] **14.2 Renkler — açık ve soft:** ✅ 30.10.2026 — kullanıcı 3 varyanttan **2 — Adaçayı & Krem**'i seçti; uygulandı (Bölüm 13 "Renk v3"). Kullanıcı mevcut paleti "çok koyu" buldu, beğenmedi. Koyu kalıcı sidebar ve koyu tarla desenli kartlar dahil, açık temada genel görünüm açık/pastel/soft olmalı (açık sidebar, düşük doygunluklu yeşil/toprak tonları, yumuşak kenarlıklar). Önce 2-3 renk varyantı küçük prototip olarak gösterilip kullanıcıya seçtirilecek, sonra `_tokens.scss` + preset güncellenecek. Koyu tema ayrı ve isteğe bağlı kalır.
- [x] **14.3 KDV ↔ kâr marjı:** KDV girilince kâr oranı/marjı değişmiyor (`products/inventory-ui.ts` `markupPct`). Karar: satış fiyatı KDV dahil kabul edildiğinden kâr, KDV hariç net satış fiyatından hesaplanmalı: `net = salePrice / (1 + vat/100)`, `kâr = net − purchasePrice` (alış fiyatı da KDV hariç kabul — formda "alış fiyatı KDV hariç / dahil" seçeneği değerlendirilecek). Form canlı önizleme, ürün detayı fiyat kartı, liste "kâr oranı" sütunu ve raporlardaki brüt kâr (`report-calc.ts`) aynı kurala bağlanacak; testler yazılacak.
- [x] **14.4 Tarih seçicileri birleştir:** Alışlarda yerel `<input type="date">` (purchase-form, purchase-list, `purchases/services/date-input.ts`), ürünlerde PrimeNG `p-datepicker` kullanılıyor. Tüm uygulamada tek bileşen: ortak `ui-date-field` (PrimeNG DatePicker, Türkçe locale, dd.mm.yyyy, mobilde dokunmatik dostu) ve tüm sayfalar ona geçirilecek.
- [~] **14.5 Android APK:** İmzalı release APK altyapısı hazır; derleme yalnız CI'da (yerelde Android SDK/Rust yok). Ayrıntı: `docs/APK.md`. — **31.10 kısmen:** altyapı ve secret'lar tamam; kalan: ilk imzalı sürümün (v1.3.1) doğrulanması
  - [x] Release keystore üretildi: `.keys/tarim-market-release.jks` (alias `tarim-market`; şifre + base64 `.keys/README-GIZLI.txt`; `.keys/` gitignore'da).
  - [x] `app/build.gradle.kts`: `signingConfigs.release` `keystore.properties`'ten okur; dosya yoksa release imzasız kalır, derleme kırılmaz.
  - [x] `android-build.yml`: secret'lar varsa imzalı release APK (arm64 + armv7 universal) + AAB, `apksigner verify`; yoksa debug APK'ya düşer ve özet satırında uyarır. Çıktı adı `TarimMarketPro-<sürüm>.apk/.aab`.
  - [x] APK/AAB tag'li çalışmada Windows ile AYNI taslak GitHub Release'e eklenir (iki workflow `gh-release-<tag>` concurrency kilidini paylaşır; release yoksa oluşturulur, varsa eklenir). Windows workflow'u `releaseId` ile yüklemeye çevrildi; release gövdesi Windows/Android dosyalarını açıklar.
  - [x] Sürüm senkronu: Tauri CLI `versionName`/`versionCode`'u `tauri.conf.json`'dan üretir (`app/tauri.properties`; code = major·1e6 + minor·1e3 + patch); `npm run release` zaten bu dosyayı günceller.
  - [x] Kurulum/secret/Play/sorun giderme rehberi: `docs/APK.md`.
  - [x] **Kullanıcı:** 3 GitHub secret'ını ekleyecek (`ANDROID_KEY_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) ve `.keys/` klasörünü güvenli yere yedekleyecek. — ✅ 31.10 doğrulandı: secret'lar eklendi, v1.3.1 imzalı anahtarlarla derleniyor
  - [ ] İlk imzalı tag'de doğrulama: Release taslağında APK+AAB+exe+msi tek sürümde mi, APK telefona kuruluyor mu, release (R8) derlemesinde çökme yok mu; APK boyutunu not et.
- [~] **14.6 Telefon kamerasıyla barkod/QR/GTS okuma** (30.10.2026 — kod tamam, Android'de gerçek cihaz testi kullanıcıda):
  - [x] Ortak katman `src/app/shared/scanner/`: `ScannerService.scan()` / `scanContinuous()`, `<ui-scan-button>` (pi-camera), kamera dialogu (vizör, fener, kamera değiştir, iptal, "elle kod gir"; kamera yok / izin yok / meşgul mesajları), titreşim + bip. USB okuyucu direktifi tarayıcı açıkken susar.
  - [x] Platform: Tauri Android/iOS → `@tauri-apps/plugin-barcode-scanner` ~2.4.6 (crate `tauri-plugin-barcode-scanner` ~2.4.6, yalnız mobil target; `lib.rs` `#[cfg(mobile)]` init; `capabilities/mobile.json` `barcode-scanner:default`; manifest CAMERA + VIBRATE). Web/masaüstü → `@zxing/browser` 0.2.1 + `@zxing/library` 0.23 (dinamik yüklenir). CSP'ye `media-src 'self' blob: mediastream:`. Not: eklenti 2.5.x tauri 2.12 istiyor; `@tauri-apps/api` ~2.11 ile sabitlendi (crate tauri 2.11.2 ile major.minor uyumu).
  - [x] `gs1.ts` (+20 test): `]d2`/FNC1/GS/␝/`<GS>`/parantezli biçim, AI 01 (GTIN-14 → EAN-13, kontrol hanesi), 17 (YYMMDD, gün 00 → ay sonu, yüzyıl penceresi), 10, 21; ayırıcısız dizide alan sınırı tahmini (`ambiguous`). GTS kanonik biçimi `canonicalGts` (GS'siz — USB okuyucu çıktısıyla aynı).
  - [x] Bağlanan ekranlar: POS arama (barkod/GTS → mevcut ekleme, GTS ise o birim; karekod GTIN'i → ürün), ürün listesi arama, ürün formu (barkod alanı; karekodda GTIN→barkod, GTS çipi, SKT otomatik; GTS bölümü sürekli okutma + GTIN eşleşme kontrolü), ürün detayı "GTS Ekle" paneli (sürekli; her okutma bir çip, SKT boşsa doldurulur, farklı SKT uyarısı), stok sayımı ("Kamerayla okut (+1)", aynı GTS/seri iki kez sayılmaz, bilinmeyen kod uyarısı), alış formu (sürekli; düz barkod +1, karekod → aynı ürün+SKT'li GTS kalemine), çiftçi girişi "Davet QR'ını okut".
  - [ ] Android gerçek cihaz testi (APK'da kamera izni, tarama, sürekli mod; CI'da `tauri-plugin-barcode-scanner` derlenmesi — Cargo.lock CI'da güncellenecek). Kullanıcıda.
  - [x] Parti no (AI 10) → `Batch.lotNo` (14.12, 31.10).
  - [ ] Windows exe (WebView2) kamera izni davranışı gerçek cihazda denenmeli (laptop kamerası varsa).
- [~] **14.7 Exe:** 30.10 kontrol: Windows Release v1.1.0 ✅ başarılı (9 dk), Android APK Build v1.1.0 ✅ başarılı (artifact `tarim-market-debug`, 40 MB, 29.11.2026'ya kadar indirilebilir). Kalan: kullanıcının taslak release'i Publish etmesi, exe'nin gerçek kurulum testi. Önceki not: GitHub → Actions → "Windows Release (EXE + MSI)" sonucu; başarılıysa Releases'te taslak → Publish. İlk kez çalıştı; hata varsa log'a göre düzeltilecek (olası noktalar: Cargo.lock güncellemesi, CSP, ikon yolları). Sonra: Tauri updater (otomatik güncelleme) + kod imzalama sertifikası. — **31.10:** v1.2.0, v1.3.0, v1.3.1 tag'leri atıldı. Kalan: v1.3.1 taslak release'inin Publish edilmesi, 1.3.0 → 1.3.1 otomatik güncellemenin ve gerçek kurulumun bayi bilgisayarında denenmesi.
- [ ] **14.8 Superadmin kurulumu ve kullanımı:** Kullanıcıya adım adım: ayrı e-postayla hesap aç → Console'da `platformAdmins/{uid}` ekle → yeniden giriş → "Yönetim Paneli" (`docs/SUPERADMIN.md`). İsteğe bağlı iyileştirme: uygulama içinden ilk superadmin'i güvenli şekilde atama yolu yok (bilinçli; yalnız Console). `SUPPORT_CONTACT` gerçek telefon/e-posta ile güncellenecek.
- [x] **14.9 Çiftçi alanı görünürlüğü:** *(30.10)* Giriş ekranında bayi formunun altında "Çiftçi misiniz? Çiftçi girişi" kartı → `/ciftci/giris`. Çiftçi giriş sayfasında "Davet kodum var" (kod veya linkin tamamı yapıştırılır, `parseInviteInput`), "Davet QR'ını okut" (kamera ajanının `ui-scan-button`/`ScannerService`'i), "Hesabım yok — bayinizden davet isteyin" açıklaması. Bayi menüsünde OPERASYON › **Çiftçiler** (`/farmers`, admin + kasiyer; `features/farmers/`): özet (bağlı çiftçi, bekleyen davet, paylaşılan alan, geçerli öneri), bağlı çiftçiler (ad, telefon, köy, paylaşıldıysa tarla sayısı/dekar, son aktivite, izin pill'leri → müşteri kartı), müşteri seçip davet üretme (QR + WhatsApp + kopyala), bekleyen davetler (kalan gün, gönder, süresi dolanı yeniden gönder, iptal), öneri/reçete geçmişi, "Öneri yetkilileri" kısayolu (admin). Ana sayfada küçük "Çiftçiler" kutusu (bağlı çiftçi sayısı + 7 gün içinde biten / beklenen hasatla çakışan hasat bekleme uyarısı olan tarla sayısı; yalnız paylaşılan kayıtlardan). Repository'ye işletme geneli 8 metot (`listTenantLinks`, `listTenantOpenInvites`, `revokeInvite`, `listTenantRecommendations`, `listTenantSharedFields/Seasons`, `listTenantRecentLogs`, `listTenantPhiLogs`); **kurallar değişmedi** (mevcut ÇİFTÇİ bloğu bu sorgulara izin veriyor; `tests/rules/farmer.spec.ts`'e 4 test), `firestore.indexes.json`'a 3 indeks (`recommendations (tenantId, createdAt desc)`, `applicationLogs (sharedTenantIds CONTAINS, date desc)`, `applicationLogs (sharedTenantIds CONTAINS, earliestHarvestDate)`) — **canlıda indeks deploy gerekli**. Emulator'de uçtan uca denendi: admin → Çiftçiler → Emine Özdemir'i davet et → çıkış → çiftçi girişinde linki yapıştır → izin + telefon + PIN ile kayıt → tarla ekle → admin müşteri kartından öneri yazar → çiftçi "Uygulandım, deftere işle" ✅ (390px ve masaüstü, yatay kaydırma yok). Kalan: 8.11 (service worker — gerekçe 8.11'de), 8.12 (aydınlatma metni avukat onayı), 8.13 (pilot), canlıda davet akışının denenmesi (rules + indeks deploy sonrası).
- [x] **14.10 Genel temizlik + README:** ✅ 30.10 — Silinen: `core/offline/db` + `core/offline/sync` (Dexie/SyncQueue), `dexie` paketi, `shared/pipes/stock-status.pipe.ts`, `features/settings/profile/` (`/account` artık doğrudan `SettingsCenterPage`; `detect-platform.spec.ts` → `settings/sections/`), ProductStore `selectedProduct/selectProduct`, 84 kullanılmayan i18n anahtarı (translations.ts 79, pos.i18n 4, home.i18n 1; TR+EN+arayüz), `memory/` (TODO, SETUP, DONE — eskimiş). Taşınan: `memory/URUNLER-GTS.md` → `docs/GTS-KAREKOD.md` (güncellendi), `src/assets/_orig/` → `docs/brand/orijinal/` (angular.json ignore kaldırıldı), `docs/design/a-net-profesyonel` + `b-bento-yumusak` → `docs/design/arsiv/`. CHANGELOG gerçek sürüm geçmişiyle yeniden yazıldı (1.0.0, 1.1.0, Yayınlanmamış). README Türkçe yeniden yazıldı, ekran görüntüleri `docs/screenshots/`. `npm audit fix`: 45 → 11. — Görev metni: Gereksiz dosya/kod taraması (kullanılmayan bileşenler, i18n anahtarları, eski `memory/` dosyaları TODO.md/SETUP.md (Capacitor anlatıyor), `src/assets/_orig`, eski Dexie/SyncQueue ölü kodu (3.7), `features/settings/profile` yönlendirme kalıntıları, kullanılmayan npm paketleri, `npm audit`). README.md şu an Angular CLI şablonu: proje tanıtımı, özellikler, ekran görüntüleri, kurulum (`npm ci`, `npm start`), yerel test ortamı (`npm run emu`), test komutları, sürüm çıkarma (exe/apk), Firebase deploy, klasör yapısı, lisans ile yeniden yazılacak.
- [x] **14.12 Küçük düzeltmeler (31.10):**
  - [x] **Parti no (lot, karekod AI 10):** `Batch.lotNo?` (+ `SaleItemBatch.lotNo?`, `SaleItem.lotNos?`, `PurchaseItem.lotNo?`). Ürün formu (ilk parti: "Parti no" alanı; karekoddan okunan parti GTS'ye özel, alan boşsa doldurulur), ürün detayı "GTS Ekle" paneli (Parti no alanı + çipte parti; elle/USB girilen karekod da kanonik GTS + SKT + parti olarak okunur), GTS tablosu (Parti no sütunu, telefonda kartta; satır düzenlemede alan), stok ekle dialogu, alış formu (kalem başına parti; karekod okutmada aynı ürün+SKT+parti kalemine eklenir; alış detayında gösterilir). Satışta FEFO ile düşülen partinin `lotNo`'su kaleme taşınır, iptalde geri yüklenir; fişte "Parti: …" (GTS gösterimi açıksa); reçeteli satış Excel dökümüne "Parti no" sütunu. Yardımcılar `batch.utils.ts` (`normalizeLotNo` büyük harf ≤20, `lotFor`, `withLot`); alan yoksa hiç yazılmaz (eski biçim). Specler: batch/sale/purchase/regulatory utils. Emulator'de: `(01)08690001003333(17)270500(10)LOT1(21)A1` → GTS tablosunda LOT1 + SKT 31.05.2027; POS'ta reçeteli satış → satış kaleminde `lotNos: [LOT1]`, parti `lotNo: LOT1` ✅
  - [x] **Çiftçi defteri tür hatası:** öneri kalemine `productType` + `unit` (ürün kartından; `DealerProductOption.unit`) yazılıyor; `log-form` türü/birimi buradan seçer (`farmer/utils/rec-item.util.ts` + spec). Eski önerilerde tür yoksa 1. adımda "Öneride ürün türü yazmıyor — kayıt türünü siz seçin", birim "Seçin" (varsayılan yok; miktar girilip birim seçilmezse uyarı). Öneriler sayfasında kalem ikonu ürün türünden. Kurallar: ÇİFTÇİ bloğunda öneri kalemlerinde alan kısıtı yoktu → değişiklik gerekmedi; `tests/rules/farmer.spec.ts`'e yeni alanlı öneri testi. Emulator'de: admin "Üre %46" gübre önerisi → çiftçi "Uygulandım, deftere işle" → GÜBRE · 2 çuval ✅; eski "Deneme Gübre" önerisi → tür seçimi istendi ✅
  - [x] **Soluk öğeler (Adaçayı & Krem):** devre dışı dolu butonlar (PrimeNG birincil + POS ödeme + çiftçi `F.btn`) opaklık yerine `--disabled-bg/-text/-line` (açık 4.06:1, koyu ≥4:1; `.ui-btn-disabled-soft`); `ui-progress-ring` halkası `-text` tonlarıyla. Superadmin kabuğu: sidebar başlığında dolu kırmızı "PLATFORM YÖNETİMİ" rozeti + "SUPERADMIN" etiketi, üst şerit 5px (sidebar + masaüstü topbar + mobil), sayfa zemini `--admin-page` (#f8efe9 / koyu #2a2220). `contrast-check.mjs`: yeni çiftler + ≥3:1 devre dışı/halka satırı — tümü geçiyor.
  - [x] **Mobil kontrol (390×844 iframe):** ana sayfa, mobil üst/alt çubuk, "Diğer" sheet'i (72vh, kaydırılabilir), POS mobil sepet çubuğu + açılan sepet, ürün listesi kartları, ürün detayı, veresiye detayı — yatay taşma yok (otomatik ölçüm + görsel), düzeltme gerekmedi.
- [x] **14.13 Müşteri ve tedarikçi formu tasarımı (31.10):** Geniş ekranda yarısı boş kalan formlar iki sütuna alındı: solda bölüm kartları (müşteri: Kimlik ve iletişim [2xl 3 sütun] · Köy/ÇKS/adres + Veresiye ve not [xl yan yana] · KVKK; tedarikçi: Firma bilgileri · İletişim ve adres + Notlar), sağda yapışkan panel: canlı kartvizit önizlemesi (avatar, ad, telefon, köy/adres, e-posta, maskeli TC, ÇKS), kontrol listesi (bölüm bazında doluluk, zorunlu eksik/hatalı alan, tıklayınca bölüme kayar) ve her zaman görünen aksiyon kartı (Kaydet + `Ctrl S`, İptal; önizleme/liste kısa ekranda kendi içinde kayar). Müşteri: veresiye limiti (Ayarlar varsayılanı / müşteriye özel) + varsayılan vade (`TenantSettingsService.credit()`), KVKK rıza rozetleri, "Kaydet ve satış yap" → `/pos?customer=<id>` (yeni + düzenle). Tedarikçi: vergi no doğrulama rozeti (VKN kontrol hanesi / 11 haneli TCKN; kaydı engellemez, `supplier-form/tax-no.ts` + spec), "Kaydet ve alış gir" → `/purchases/new?supplierId=<id>` (alış formu parametreyi zaten destekliyordu). Telefonda tek sütun, panel formun altında, Kaydet altta yapışkan. İş mantığı (doğrulama, KVKK rıza kaydı, TC maskeleme, düzenlemede yalnız değişen alanlar) aynen korundu. Metinler `customer-form.i18n.ts` / `supplier-form.i18n.ts`. Emulator'de 1920/1366/390, açık + koyu: müşteri eklendi → POS müşteri seçili açıldı ✅, düzenleme Ctrl+S ile kaydedildi ✅, tedarikçi eklendi → alış formu tedarikçi seçili açıldı ✅
- [x] **14.11 Kontrol turu (31.10):** Bayi personası yeni sürümü denedi → `docs/MUSTERI-TEST-RAPORU.md` "Yeni sürüm testi" (Y1–Y33). Karar: "henüz almam ama yaklaştı" (Y1–Y5 düzelirse 650 TL/ay). Düzeltilenler: **Y1** oturum anahtarı (uid+tenantId) değişince Product/Dashboard/TenantSettings/ShellStatus/ReceiptBusiness/Cart store'ları sıfırlanıyor, sepet oturuma bağlı, ham Firestore hataları `userErrorMessage()` ile; destek modu doğru veri + yenileme ~2 sn. **Y2** POS arama kutusu temizleniyor. **Y3** elle/USB karekod (GS ayıraç varyantları, Ctrl+]) kamera ile aynı yoldan; SKT/lot dolduruluyor; SKT'siz ilaç kaydedilemiyor. **Y4** kasiyer yalnız kendi bugünkü satışını iptal edebilir, iptal sebebi zorunlu, aynı işlemde `auditLogs` kaydı, kurallarda zorunlu. **Y5 (kısmi)** kasiyer/personel alış fiyatı/kâr/stok değeri/ciro görmez, ürün ekleyemez/fiyat değiştiremez, e-reçete Excel gizli; alış/tedarikçi/gider yalnız yönetici (kurallarda da). Eksik: Ayarlar'da kullanıcı bazlı yetki anahtarları. **Y7** vadesizlere varsayılan vade. **Y8** hasat günü/ayı ayarı (varsayılan 15 Temmuz) + peşinat + hasattan başlayan taksit. **Y9** kart onayında odak "Evet". **Y10** sepet boşaltınca "Geri al". **Y11** tahsilat varsayılanı sıradaki taksit, Havale/EFT, makbuz yazdır / WhatsApp. **Y12** veresiye fişinde taksit tablosu, imza satırı, KDV dökümü (not: satış detayından yeniden basımda aylık olmayan aralıklarda ara tarihler yanlış). **#31** açılış ekranı (splash). **Y15, Y24** düzeltildi. **#34/Y22** kısmi (POS miktar kutusu). İç adres doğrudan açılınca boş sayfa yeniden üretilemedi (splash ile kapsandı). **Açık kalanlar:** Y13, Y14, Y16, Y18, Y19, Y21, Y23, Y25–Y29, Y31–Y33; "İptaller" raporu, yönetici PIN'i ile iptal onayı, 1366 px genel düzen turu. Kontrol (benim tarafımdan): lint temiz, 393/393 test, build 1.11 MB / 271.38 kB gz; kurallar 150/150 (ajan). **Canlı kural deploy'u gerekiyor.** Kullanıcıya duyurulacak: kasiyer artık alış/tedarikçi/gider göremez, ürün ekleyemez/fiyat değiştiremez, iptal sebebi zorunlu.
- [x] **14.14 Çiftçi gözünden test (31.10):** `docs/CIFTCI-TEST-RAPORU.md` (30 bulgu) → düzeltildi: POS satışı her zaman `findLinkForCustomer` ile çiftçiye gidiyor; yeni `FarmerLinkWatcher` (bayi oturumu açıkken) bağlantı aktifleşince bağlantı öncesi borç/alışları aktarıyor (Y6), bakiye değişince yeniden eşitliyor, `customers.farmerId` yazıp revoke'ta siliyor; Borcum'da sıradaki ödeme, gecikme ve taksit planı; telefonda tarih/taşma düzeltildi; odak/görünürlük/bağlantı dönüşünde yenileme + "Yenile" düğmesi + yeni öneri rozeti (onSnapshot yok, kota için); bildirim izni gizlendi; e-reçete no yalnız reçeteli satırda; davet sayfası kısaldı, eksik adımı söyleyip odaklıyor; açık bayi oturumu varsa sessizce değiştirmiyor (Y17); biten ürünler Ambar'da "Biten / kullanılan"; "çuval" ve anlaşılır dekar dozu; tur 5 adım + ÜKD = Üretici Kayıt Defteri; sayfa geçişinde kaydırma başa; yanlış PIN 5 yerine 2 Auth çağrısı; bağlantı koparma uyarısı; çiftçi oturumunda bayi permission-denied uyarıları bitti. Kontrol: build 1.11 MB / 270.81 kB gz, 376/376 test, kurallar 150/150. **Canlı deploy gerekiyor:** `farmerLinks` güncellemesine `nextDue`, `overdueAmount`, `schedule` alanları eklendi (deploy edilmezse canlıda bayi eşitlemesi permission-denied verir). Sınır: ilk eşitleme ancak bir bayi uygulamayı açıkken olur (sunucu fonksiyonu yok).
- [x] **14.17 Bayi kalan işleri (31.10):** Veresiye fişi yeniden basımında taksit aralığı (`installmentIntervalMonths`) düzeltildi; Raporlar → **İptaller** (saat, satış no, satan, iptal eden, sebep, tutar; Excel/PDF); 1366×768 düzen turu (dashboard, POS, ürün/satış listesi); kurallardan kullanılmayan `isAdmin` silindi; Ayarlar → Ekip'te kişi bazlı yetki: "Alış fiyatı ve kârı görür" (yalnız arayüz) ve "Geçmiş ve başkasının satışını iptal eder" (kurallarda da). Y13, Y14, Y16, Y18 (POS'ta e-reçete no öneriden), Y19, Y23, Y25, Y26, Y27 (kör sayım), Y29, Y32 (F6 beklet), Y33 düzeltildi. **Atlanan:** Y21 (çiftçi giriş hızı, profil gerekli), Y28 (Ambar'ı ürüne göre gruplama, tasarım kararı), Y31 (fiyat/satın alma ekranı, iş kararı), Y18 kalanı. Kalan küçük: kenar çubuğunda kullanıcı adı kesiliyor. Kontrol: lint temiz, 430/430 test, kurallar 155/155, build 1.11 MB / 274.50 kB gz. **Canlı kural deploy'u gerekiyor.**
- [~] **14.16 EXE önceliği — kendi bayilerde kullanım (31.10, kullanıcı kararı):** İlk kullanıcılar kendi bayiler, Windows EXE ile. Dışarıya satış ve sunucu/hosting sonra. Yapılacaklar: (a) EXE otomatik güncelleme (Tauri updater + imzalı güncelleme, GitHub Release üzerinden; şu an yok, her sürümde elle kurulum gerekiyor), (b) fiş yazıcı ve USB barkod okuyucu ile EXE'de gerçek test, (c) EXE'de çevrimdışı/bağlantı kopması davranışı, (d) kurulum rehberi (bayiye verilecek tek sayfa), (e) SmartScreen uyarısı için kod imzalama sertifikası (ücretli, kullanıcı kararı).
  - [x] (a) Otomatik güncelleme (31.10): `tauri-plugin-updater` + `plugin-process` (yalnız masaüstü), `createUpdaterArtifacts`, endpoint GitHub `releases/latest/download/latest.json`, passive kurulum. Angular `core/updater/` (8 sn sonra + 4 saatte bir denetim, sepet doluyken yalnız bilgi, Ayarlar → Hakkında "Güncellemeleri denetle"). Workflow: secret yoksa updater kapalı derler. Android etkilenmiyor (CLI kaynağından doğrulandı). Anahtarlar `.keys/tauri-updater*` (gitignored). **Kullanıcı:** GitHub secret `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` ekle, `.keys` yedekle. 1.3.0 bir kez elle kurulur; gerçek güncelleme akışı 1.3.0 + sonraki yayımlanınca test edilecek.
  - [!] v1.3.2 yayımlandı ama `latest.json` yüklenmedi: productName'deki "ı" GitHub asset adında "i" oluyor, tauri-action eşleştiremeyip latest.json'u atlıyor. Düzeltme: workflow'a `assetNamePattern: TarimMarketPro_[version]_[arch][setup][ext]` (31.10). İlk otomatik güncelleme 1.3.3 ile denenecek. Ayrıca Ayarlar → Hakkında'dan "Açık kaynak bileşenler" kartı kullanıcı isteğiyle kaldırıldı (lisans bildirimleri `3rdpartylicenses.txt` içinde kalıyor).
  - [ ] (b) Fiş yazıcı + USB barkod okuyucu ile EXE'de gerçek test (kullanıcı, bayide).
  - [ ] (c) EXE'de bağlantı kopması davranışı testi.
  - [x] (d) `docs/KURULUM-BAYI.md` bayi kurulum rehberi; README'de güncelleme bölümü.
  - [ ] (e) Kod imzalama sertifikası (kullanıcı kararı).
- [ ] **14.15 İnternetsiz açılış (service worker / PWA):** Web sürümü internet yokken hiç açılmıyor (çiftçi raporu #8). Ayrı iş.
