# Tarım Market Pro — Detaylı Denetim ve Görev Listesi

> Tarih: 2026-10-27 · Kaynak: Angular 21 + PrimeNG 21 + Ionic 8 (kabuk) + Firebase 12 + Tauri 2
> Bu dosya `memory/TODO.md`'nin yerini alır (TODO.md güncel değil; içindeki birçok madde zaten yapılmış, bazıları yanlış).
> Her görev tek bir ajana brief olarak verilebilecek şekilde yazıldı: **Dosyalar**, **Yapılacak**, **Kabul kriteri**.

---

## ✅ DURUM — 30.10.2026 (2. ajan turu sonrası, ARA VERİLDİ)

**Son doğrulama (30.10.2026):** production build temiz (initial 1.09 MB / 266 KB gz), `ng test` 30 dosya / 246 test yeşil, `ng lint` 0 hata, `npm run test:rules` 126/126. Hiçbir şey commit edilmedi, canlıya hiçbir şey deploy edilmedi. Yerel emulator (8080/9099) açık bırakıldı; veri `.emulator-data` içinde.

**Bu turda biten (27–30.10):** yerel test ortamı (Bölüm 3.18), superadmin + destek modu + lisans (Bölüm 10), bayi hukuki uyumu (Bölüm 11), veresiye vade/taksit + KVKK (5.7, 5.8, 5.16), çiftçi modülü MVP (Bölüm 8), alış faturası + tedarikçi cari + yedekleme (5.9, 5.13, Bölüm 12), Tasarım v2 "Saha / Komuta" tüm ekranlar + ayarlar merkezi + cila (Bölüm 13), canlı giriş sorunu çözümü (aşağıda).

### ▶ DÖNÜNCE SIRADAKİ ADIMLAR
1. Müşteri test ajanını yeni sürümde emulator üzerinde baştan sona çalıştır (persona: bayi sahibi; `docs/MUSTERI-TEST-RAPORU.md` yeni sürüm bölümü), bulguları düzelt.
2. Tarayıcıda doğrulanmamışlar: destek modu + live-reload, çiftçi öneri dialogu doz alanı, gider/ekstre dialog düzeltmeleri, gerçek 1366x768 pencere, 58 mm fiş.
3. Kullanıcı onayıyla: commit (büyük değişiklik seti, mantıklı parçalara bölünerek) → `firebase deploy --only firestore:rules,firestore:indexes` → `npm run release -- 1.1.0`.
4. Satıştan önce: `SUPPORT_CONTACT` gerçek telefon, aydınlatma metinleri ve destek erişimi sözleşme maddesi avukat onayı, superadmin'i Console'dan ekleme (`docs/SUPERADMIN.md`).
5. Sonraki büyük iş: veri katmanı soyutlaması (Bölüm 6.1–6.4) → kendi sunucuya geçiş hazırlığı.

---

### 27.10.2026 ilk tur özeti

**Yapıldı (doğrulandı: production build temiz, 73/73 test, lint 0 hata, initial 1.04 MB / 256 KB gz):**
- Bölüm 1 (acil) tamamı: 1.1–1.9.
- Bölüm 2: 2.1 (satış geçmişi + iptal/iade), 2.3–2.5, 2.7–2.10, 2.12–2.18, 2.20–2.40 (2.38'in negatif stok doğrulaması hariç). 2.2 kısmen (satış ve tahsilat transaction'lı, stok düzeltmeleri değil). 2.6 rapor tarafında ayrı "vade farkı geliri". 2.11 ve 2.19 açık.
- Bölüm 3: 3.2–3.6, 3.8–3.15, 3.17, 3.20. 3.18 kısmen (ESLint + Prettier + rules emulator testi `npm run test:rules` var; lint-staged yok). 3.7 açık (Dexie/SyncQueue hâlâ ölü kod). 3.19 kısmen (Bölüm 9).
- Bölüm 4 (UI) tamamı: token katmanı, PrimeNG preset + Türkçe takvim, `src/app/shared/ui/` bileşenleri (README'li), cam kabuk + mobil alt nav, tüm sayfalar dönüştürüldü, eski koyu tema eşlemesi silindi.
- Bölüm 5: 5.1 (tenant + davet modeli, Spark uyumlu), 5.2 (Ekip sayfası), 5.3 (satış geçmişi + 80 mm fiş), 5.4 kısmen (iptal, genel indirim, karışık nakit+veresiye), 5.5 kısmen (birim + ondalık miktar), 5.6 (kasa özeti, yazdırılabilir), 5.11 kısmen (en çok satanlar, kategori, Excel/PDF), 5.15 kısmen (İşletme Bilgileri kartı).
- Bölüm 9: exe/msi otomatik release.

**Canlı giriş sorunu (30.10.2026) — çözüldü (kodda; deploy gerekmez):**
- Sebep (eski kurallı emulator'de yeniden üretildi): yeni kod eski (canlı) `firestore.rules` ile uyumsuzdu. (1) `users/{uid}` dokümanı olmayan eski hesapta `createProfile` users + **tenants** batch'i yazıyordu; canlı kurallarda `tenants` yok → PERMISSION_DENIED → "profil okunamadı, bağlantınızı kontrol edin" + çıkış (kullanıcıya "Firebase bağlanmıyor" gibi görünüyor). (2) `isActive` alanı olmayan / `tenantId` alanı olmayan eski dokümanlar `toAppUser`'da pasif sayılıp "hesabınız pasife alınmış" ile atılıyordu. (3) İlk açılıştaki tek bir "client is offline" (persistentLocalCache + multi-tab) hatası da doğrudan çıkış yaptırıyordu.
- Çözüm: `core/auth/services/profile-loader.ts` (sunucudan okuma, geçici hatada önbellek + üstel geri çekilme ~15 sn; yalnız permission-denied kesin), geçici hatada oturum KAPANMAZ → giriş sayfasında "Tekrar dene" (bağlantı gelince otomatik); tenants reddedilirse yalnız users dokümanı yazılır; `isActive` yoksa aktif, `tenantId` yoksa eski sahip (uid, admin); eski kurallarda eksik alanlar kullanıcının kendi dokümanına geri doldurulur (yeni kurallara hazırlık); `TenantInfoService`/`TenantSettingsService` okumaları best-effort; `environment.requireEmailVerification` bayrağı. Testler: `profile-loader.spec.ts`, `auth.service.spec.ts`. Ayrıntı: `docs/TEST-ORTAMI.md` "Eski (canlı) kurallarla uyumluluk testi".
- Kullanıcı: yeni sürümle (`npm start`) tekrar giriş yapması yeterli; e-postası doğrulanmamışsa doğrulama ekranından "Tekrar Gönder" (veya geçici olarak `requireEmailVerification: false`).

**Ayarlar ekranlara bağlandı (30.10.2026):** [x] fiş (kâğıt 58/80, başlık notu, logo, bayi izin no, ruhsat/GTS; ayarlar önizleme = test fişi = gerçek fiş), [x] POS veresiye varsayılan vade, [x] yeni müşteri varsayılan limit, [x] hatırlatma şablonu, [x] SKT eşikleri tek kaynak (ProductStore, dashboard, bildirimler, zil).
**Hata listesi (30.10.2026):** [x] stok hareketlerinde "Alış: <belge no>" / "Satış: <no>" + link, [x] çiftçi öneri dialogunda doz sıfırlanması (canlandırılamadı; sağlamlaştırıldı + test — ekranda denenmeli), [x] gider dialogu Esc → autocomplete paneli, [x] ekstre dialogunda takvimin kendiliğinden açılması, [x] `overlayAppendTo: 'body'`, [x] `test:rules` 126/126. [x] NG0956: `quick-cash.component.ts` → `track $index` (30.10, yönetici). [ ] Destek modu hardNavigate + live-reload: profil yükleme artık geçici hatada çıkış yapmıyor; tarayıcıda ayrıca doğrulanmadı.

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
- `npm audit`: 41 açık (4 kritik); Angular güncellemesiyle birlikte `npm audit fix`.
- Android'de `window.print()` çalışmaz; Android fiş için Bluetooth termal yazıcı eklentisi gerekir.
- Çiftçi modülü (Bölüm 8): MVP kodu yazıldı (2026-10-27; `/ciftci`, davet+PIN, tarla/sezon/defter/PHI, ambar, borç, bayi paneli, öneri/reçete, hava). Kalan: ~~8.7 POS satış anı entegrasyonu~~ ✅ 30.10, 8.11 service worker, 8.12 avukat onaylı aydınlatma metni, 8.13 pilot; canlıya almadan önce rules + indeks deploy (Tauri CSP'ye api.met.no ✅ 30.10).
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
- [ ] **2.1 Satış iptali / iadesi yok.** `SaleStatus 'cancelled'|'refunded'`, `cancelledAt`, `StockMovement 'return'` modelde var, kullanan kod yok. Stok ve bakiye geri yükleyen iptal akışı yaz. Raporlar/dashboard `status == 'completed'` filtrelesin. (`sale.service.ts`, `sales-report.page.ts`, `dashboard.store.ts`)
- [ ] **2.2 Stok yarışı (transaction yok).** `sale.service.ts:59-61` ve `product.service.ts:79-142` bayat snapshot ile mutlak `stock` yazıyor. Online iken `runTransaction`; offline için en azından `increment()` + `batches` için uzlaştırma aracı. Çok kasalı kullanımda zorunlu.
- [ ] **2.3 Ürün bulunamazsa satış stoksuz kaydediliyor** (`sale.service.ts:57`). Pasif ürün sepetteyken olur. Hata fırlat.
- [ ] **2.4 Satış numarası saniye çözünürlüklü** (`sale.service.ts:124`). İki kasa aynı saniyede çakışır. Tenant bazlı sayaç (transaction) veya `uid`-prefix ekle.
- [ ] **2.5 `creditTransactions.balance` anlamı tutarsız** (borçta işlem tutarı, tahsilatta müşteri bakiyesi). Koşan bakiye yap ya da alanı kaldır.
- [ ] **2.6 Faizli veresiyede `sale.totalAmount` faizsiz kalıyor** → raporlar faiz gelirini görmez. Karar: faiz ayrı gelir kalemi mi, ciro mu?
- [ ] **2.7 `_pendingCredit` bayrağı sıfırlanmıyor** (`pos.page.ts:350,389,415`). Dialog kapatılınca reset et.
- [ ] **2.8 Yanlış toast'lar:** stok sınırında "eklendi" (`pos.page.ts:395-413`), stok 0'da "barkod bulunamadı".
- [ ] **2.9 Sepet kalıcı değil**, global indirim satışa yazılmıyor, `totalPrice` indirimi içermiyor (`cart.store.ts:102,124`), hesaplar 4 kez kopya (`cart.store.ts:34-89`), yuvarlama yok → `1e-15 TL` borç yazılabilir.
- [ ] **2.10 Barkod directive Enter'ı odaktaki butona geçiriyor** (`barcode-input.directive.ts:18-29`). `BUTTON` dışla, `preventDefault()`, modifier tuşlarını yoksay, açık dialog varken devre dışı.
- [x] **2.11 GTS okutulunca belirli birim seçilmiyor** ✅ 27.10: okutulan GTS o birimi düşer, barkodla eklenende FEFO GTS'leri `SaleItem.gtsNos`'a yazılır, fiş + satış detayında görünür (bkz. Bölüm 11).; FEFO başka GTS'i düşürür. Satış kalemine `gtsNo[]` ekle (gübre/ilaç izlenebilirlik).

### Ürün / Stok
- [ ] **2.12 `stock ≠ Σ batches` hiçbir yerde doğrulanmıyor.** `applyFEFO` yetersiz partide sessizce yetiniyor (`batch.utils.ts:11-17`), `removeBatch` `Math.max(0,…)` ile gizliyor. Uzlaştırma (reconcile) komutu + uyarı rozeti.
- [ ] **2.13 `removeBatch` toplu satırda N adedi siliyor** ama onay metni "bu birim" diyor (`product.service.ts:162-195`).
- [ ] **2.14 Barkod ve GTS benzersizliği zorlanmıyor** (ürün içi bile `updateBatch`'te yok). Global GTS kontrolü için `where('batches', 'array-contains')` çalışmaz → ayrı `gtsIndex/{gtsNo}` koleksiyonu veya tenant-bazlı set.
- [ ] **2.15 Süresi geçmiş parti satılabiliyor**, `nearestExpiry` geçmiş SKT'yi de sayıyor. Uyarı/engel.
- [ ] **2.16 `createdAt.toDate()` null güvenli değil** (`product-detail.page.ts:225`, `stock-movements.page.ts:95`, `credit-detail.page.ts:168`). Bekleyen `serverTimestamp()` ile `null` gelir → TypeError. `?.toDate()` veya `snapshotOptions: { serverTimestamps: 'estimate' }`.
- [ ] **2.17 Stok sayımı girilen değerleri kaybediyor** (`stock-count.page.ts:271-273`, `rows` computed, snapshot gelince sıfırlanır). `counted` değerlerini ayrı `Map` signal'inde tut. Döngü atomik değil (`:345-353`).
- [ ] **2.18 KDV `NaN` yazılabiliyor** (`product-detail.page.ts:687`), ilk stok için hareket kaydı yazılmıyor, "Kategori *" zorunlu görünüp doğrulanmıyor, satış fiyatı 0 kabul.
- [ ] **2.19 Firestore belge boyutu riski:** her GTS birimi `batches[]` elemanı → binlerce birimde 1 MiB sınırı. Uzun vadede `products/{id}/batches` alt koleksiyonu.

### Müşteri / Veresiye / Tedarikçi / Gider
- [ ] **2.20 "Cari hareketler" butonu `/credit` listesine gidiyor**, `/credit/:id`'ye değil; kasiyer için rota admin-only (`customer-detail.page.ts:99-106`).
- [ ] **2.21 Müşteri silme UI yok**, `CustomerService.delete` ölü; bakiye > 0 engeli yok.
- [ ] **2.22 Türkçe harf:** `toLowerCase()` yerine `toLocaleLowerCase('tr')` (arama: `customer-list:99`, `credit-list:78`, `supplier-list:96`; isim: `auth.service.ts:72`, `profile.page.ts:258`). "İsmail" bulunamıyor, "ismail" → "Ismail".
- [ ] **2.23 `credit-detail` tüm tenant `creditTransactions`'ı çekip istemcide süzüyor** (`:278-285`); `where('customerId')` + indeks `(tenantId, customerId, createdAt desc)`; `onSnapshot` unsubscribe yok.
- [ ] **2.24 Gider "hafta" ve "ay" filtreleri ay sınırında yanlış** (`expenses.page.ts:236-241`). `new Date(y, m+1, 0)` kullan. Ortak `date-range.util.ts` yaz (raporlarla paylaşılsın).
- [ ] **2.25 Tekrarlayan gider 12 belge, atomik değil, `recurringId` yok, 31'inde ay atlıyor** (`expenses.page.ts:271-275`).
- [ ] **2.26 Tedarikçi silme partilerdeki `supplierId` referansını kontrol etmiyor** (`supplier-detail.page.ts:253`). Yanlış hata anahtarı (`supplier-list:87` `saveFailed` yerine `loadError`).
- [ ] **2.27 `catch` eksik:** `customer-form`, `forgot-password.page.ts:77`, `register.page.ts:142` (tüm hatalar genel mesaj), `login` (`user-disabled`, `network-request-failed` yok), `profile.page.ts:249` (`auth/invalid-credential` eşlenmemiş).

### Raporlar / Dashboard
- [ ] **2.28 `limit(1000)`/`limit(500)` + `orderBy` yok** (`sales-report.page.ts:340`, `dashboard.store.ts:40`). Satış sayısı limiti aşınca bugünün verisi eksik gelir. `where('createdAt','>=',start)` + `orderBy('createdAt','desc')`.
- [ ] **2.29 "Net kâr" = ciro − gider**; `purchasePrice` hiç kullanılmıyor. `SaleItem`'a `costPrice` snapshot'ı ekle, brüt kâr hesapla.
- [ ] **2.30 Gider toplamında üst sınır yok** (`sales-report.page.ts:316`): tekrarlayan kira gelecek 11 ayı bu aya sayar.
- [ ] **2.31 `cashTotal = Σ cashPaid`** para üstünü içeriyor; `cashPaid − change` olmalı. "Karma" kartı ölü.
- [ ] **2.32 Dashboard "toplam ürün" `filteredProducts()` kullanıyor** → ürünler sayfasındaki filtre dashboard'a sızar (`dashboard.page.ts:55,167`). `products()` kullan. `dashboard.store.ts`'te 5 alan hiç doldurulmuyor (haftalık/aylık/toplam ciro vb.).
- [ ] **2.33 Tahsilatlar (veresiye ödemeleri) raporlarda gelir olarak yok.** Gün sonu kasa raporu yok.

### Auth / Güvenlik
- [ ] **2.34 E-posta doğrulaması süs:** `authGuard` `emailVerified` bakmıyor, kurallar `email_verified` istemiyor. Ya zorunlu kıl ya kaldır.
- [ ] **2.35 "Beni hatırla" etkisiz** (`auth.service.ts:63-64`, her zaman `browserLocalPersistence`).
- [ ] **2.36 Profil okunamazsa `role: 'admin'` varsayılıyor** (`auth.service.ts:155,166`). Güvenli varsayılan `staff` olmalı.
- [ ] **2.37 `users/{uid}` write serbest** → kullanıcı kendi `role`/`tenantId`'sini yazabilir (`firestore.rules:14-16`). Rol sadece admin SDK / Cloud Function ile yazılmalı.
- [ ] **2.38 Update kurallarında `request.resource.data.tenantId == resource.data.tenantId` yok** → belge başka tenant'a devredilebilir. Negatif stok, negatif tutar doğrulaması yok.
- [ ] **2.39 `isActive=false` kullanıcı giriş yapabiliyor.** `login()` çift `getDoc` yapıyor. `register()` yarım hesap bırakabilir (Auth var, Firestore yok).
- [ ] **2.40 `credits` koleksiyonu kuralda/indekste var, kodda yok** → sil. `isTenant()` kullanılmıyor → sil. `creditTransactions.update` açık → defter değişmez olmalı.
- [ ] **2.41 App Check yok**, `firebase.json` `headers` yok, `.firebaserc` yok, `provideStorage` kayıtlı ama kullanılmıyor (Storage rules de yok).

---

## 3. 🟡 ORTA — Kalite, performans, temizlik

### Performans / Ölçeklenme
- [ ] 3.1 Hiçbir listede sunucu tarafı sayfalama yok (ürün, müşteri, hareket, gider, işlem). Firestore `startAfter` + `limit`.
- [ ] 3.2 `loadProducts()` her sayfa `ngOnInit`'te yeniden çağrılıyor → skeleton yanıp sönüyor, gereksiz okuma (`product-list:379,396`, `stock-count:289`, `main-layout:254`, `dashboard:729`). Store'u bir kez yükle.
- [ ] 3.3 `onSnapshot` abonelik sızıntıları: `product-detail:604-608`, `product-list:386`, `stock-movements:155`, `pos.page:372`, `credit-detail:274`. Hepsine `takeUntilDestroyed()`.
- [ ] 3.4 `retry` içinde `return EMPTY` akışı sessizce kapatıyor (`product.store.ts:82-93`, `customer-list:82-88`) → hata toast'ı hiç görünmüyor.
- [ ] 3.5 `getMovements$` limitsiz; `debtors()` şablonda 3 kez hesaplanıyor (`credit-list:23,37,55`) → `computed`.
- [ ] 3.6 Bundle: `TarimLogo.png` 667 KB (WebP ~50 KB), `favicon-512.png` 177 KB, `favicon.ico` 75 KB, PrimeIcons 4 font formatı (woff2 yeter). `anyComponentStyle` bütçesi ters (`angular.json:50-54`: warning 10kb > error 8kB).

### Offline
- [ ] 3.7 `SyncQueueService.flush()` hiçbir şey yapmıyor (`sync-queue.service.ts:60-64` yorum: "injected per-service"). `localDb.products/sales/customers` tabloları hiç yazılmıyor. **Karar:** Firestore `persistentLocalCache` yeterliyse Dexie + SyncQueue + `product.service.ts:6-8,21-22` import'larını sil; değilse gerçekten bağla.
- [ ] 3.8 Offline'da `await addDoc/updateDoc` sunucu onayı bekliyor → müşteri/tedarikçi/gider/tahsilat/stok formlarında spinner sonsuz döner (sadece `sale.service.ts:115-119` ele alıyor). Ortak `FirestoreService.write()` helper'ı: online ise await, değilse fire-and-forget + `.catch`.
- [ ] 3.9 `sale.service.ts:118` fire-and-forget commit'te `.catch` yok → unhandled rejection, satış kaybolabilir.

### Ölü kod / gereksiz
- [ ] 3.10 Kullanılmayan npm paketleri (12): `chart.js`, `ng2-charts`, `jspdf`, `jspdf-autotable`, `xlsx` (0.18.5 CVE'li), `@zxing/browser`, `@zxing/library`, `@ngrx/store`, `uuid`, `@types/uuid`, `@angular/cdk`, `@angular-eslint/eslint-plugin`. `tailwindcss/postcss/autoprefixer` → devDependencies. (Rapor/PDF/Excel/kamera özelliği yapılacaksa ilgili paket kalır.)
- [ ] 3.11 Angular şablon artıkları: `src/app/app.html` (344 satır placeholder), `app.scss`, `app.spec.ts` ("Hello, tarim-market"). `index.html` `lang="en"`, `<title>TarimMarket</title>`.
- [ ] 3.12 Ionic sadece kabuk: `app.ts` (`ion-app`), `app.config.ts` (`provideIonicAngular`), `styles.scss` (4 CSS). ~260 KB chunk için tek faydası `ion-router-outlet`. **Karar:** Ionic'i tamamen kaldır (`router-outlet` yeter) → bundle küçülür, `ng test` ESM hatası da çözülür.
- [ ] 3.13 Ölü üyeler: `ProductStore.selectedProduct/selectProduct/totalInventoryValue`, `ProductService.delete/getByBarcode$`, `SaleService.logger`, `stock-count.diffStyle`, `product-list.globalFilterFields`, `stock-movements` `ButtonModule`, `credit-list` `ButtonModule`, `dashboard` `CardModule/TagModule`, `EXPENSE_CATEGORIES`, `/suppliers/:id/edit` rotası, Rust `get_printers`/`print_receipt` (frontend `invoke` hiç çağırmıyor), `StockMovement 'adjustment'|'return'` dalları.
- [ ] 3.14 Kopya kod: kategori/KDV autocomplete (`product-form:237-276` = `product-detail:526-565`), FEFO sıralaması 4 yerde, `initials()` 3 yerde, dönem seçici 2 yerde, ödeme türü renk/ikon haritaları 4 fonksiyonda, tedarikçi formu 2 yerde, `(x as any)` cast'leri (model alanları zaten var).
- [ ] 3.15 Kullanılmayan i18n anahtarları (~35) ve sabit metinler: `GTS / Karekod` (`product-detail:368`), `'Diğer'` (`:683`), `Satış:`/`adet` (`sale.service:77,97`), `FEFO ·` (`stock-count:196`), `tr-TR`/`₺`/`dd.MM.yyyy` locale sabitleri (`credit-detail:168`, `expenses:100,150`, `profile:201-275`, `sales-report:282-309`), `t().common.piece === 'pcs' ? 'd' : 'gün'` hilesi.
- [ ] 3.16 `memory/TODO.md` ve `memory/SETUP.md` güncel değil (Capacitor anlatıyor, proje Tauri Android kullanıyor; "eski Ionic sayfalar" yok). Bu dosyayla değiştir.

### Test / Lint / CI
- [ ] 3.17 `ng test` düzelt (Ionic kaldırılınca çözülür; değilse vitest `server.deps.inline: ['@ionic/core']`). İlk testler: `applyFEFO`, `cart.store` hesapları, `sale.service` kalem eşleme, tarih aralığı util'i.
- [ ] 3.18 ESLint (`angular-eslint`) + Prettier script'leri + `lint-staged`. Firestore rules için emulator testi.
  - ✅ Rules emulator testi: `tests/rules/*.spec.ts`, `npm run test:rules` (tenant izolasyonu, rol/tenantId, değişmez defterler, negatif tutar, isReversal, davet). Kalan: `lint-staged`.
- [ ] 3.19 CI: Android release imzalama (keystore secret), Windows MSI için `tauri-apps/tauri-action`, tetikleyiciyi `paths:`/tag ile daralt, 4 Rust target yerine 1, `concurrency: cancel-in-progress`. `--legacy-peer-deps` sebebini (`@angular/fire@20` ↔ Angular 21) gider.
- [ ] 3.20 `@primeng/themes` deprecated → `@primeuix/themes`'e geç (npm uyarısı).

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
- [ ] **4.1 Tasarım token katmanı.** `src/styles/tokens.scss`: renk (brand, surface, glass, text, border, status), yarıçap, gölge, blur, spacing, tipografi. Açık/koyu için tek yerde. `tailwind.config.js` bu tokenları `theme.extend` ile kullanır (`bg-surface`, `text-primary` sınıfları CSS değişkenine bağlı). `styles.scss`'teki `html.dark .bg-white {...}` elle eşleme bloğu silinir.
- [ ] **4.2 PrimeNG preset.** `definePreset(Aura, { semantic: { primary: {...yeşil} }, components: {...} })`; `@primeuix/themes`'e geç. Global `!important` override'larını (`styles.scss:24-32`) preset'e taşı.
- [ ] **4.3 Ortak bileşenler (`src/app/shared/ui/`):** `glass-card`, `page-header` (başlık + aksiyon slotu), `stat-card` (ikon, değer, etiket, trend), `empty-state`, `status-badge`, `section` ve `data-table` sarmalayıcı (p-table + cam başlık). Her biri signal input'lu, OnPush.
- [ ] **4.4 Layout:** sidebar + mobil bottom nav + "Diğer" sheet'i yeniden yaz (`main-layout.component.ts`, `sidebar.component.ts`). Inline style ve `onmouseenter` string'leri sıfır. Cam sidebar, aktif öğe için yumuşak pill.
- [ ] **4.5 Dashboard:** stat kartları (bugün/hafta/ay ciro, kâr, kritik stok, SKT), satış trendi grafiği (Chart.js veya PrimeNG Chart), son satışlar, en çok satanlar, kritik stok listesi. `dashboard.store.ts` gerçek veriyle doldurulur (2.32).
- [ ] **4.6 POS:** en çok inline style olan sayfa. Sol: ürün arama + hızlı grid; sağ: cam sepet paneli + büyük ödeme butonları; barkod odak göstergesi; ödeme dialogları.
- [ ] **4.7 Ürün listesi / detay / form** (detay 940 satır → GTS tablosu, stok banner'ı, hareket listesi ayrı bileşen).
- [ ] **4.8 Müşteri / veresiye / tedarikçi / gider / rapor / profil / auth** sayfaları — aynı bileşen setiyle.
- [ ] **4.9 Mobil kırılma noktaları:** `grid-template-columns: repeat(3,1fr)` gibi sabit gridler (`sales-report`, `customer-detail`) mobilde taşıyor. Her sayfa 360px'te test.
- [ ] **4.10 `aria-label`** yalnızca ikonlu butonlara (`supplier-detail:34`, `expenses:108`), klavye odak halkaları.

**Tavsiye edilen sıra:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 (burada "beğendin mi?" kontrolü) → 4.6 → 4.7 → 4.8. Bölüm 1'deki kritik hatalar UI'dan **önce** düzeltilmeli; aksi halde yeniden yazılan şablonlar hatalı mantığı taşır.

---

## 5. 💰 SATILABİLİR ÜRÜN — Eksik özellikler

Sahada bir zirai ilaç/gübre bayisinin bekleyeceği, şu an olmayanlar:

### Çok kullanıcılı işletme (zorunlu, mimari değişiklik)
- [ ] **5.1 Tenant modeli.** Şu an `tenantId == auth.uid`; yani kasiyer/personel hesabı **imkânsız** (kendi uid'siyle sahibin verisini okuyamaz, `roleGuard` sadece UI). Gerekli: `tenants/{tenantId}` + `tenants/{id}/members/{uid}` (rol), kullanıcıya **custom claim** (`tenantId`, `role`) Cloud Function ile; kurallar `request.auth.token.tenantId` kullanır. `AuthService.currentTenantId()` claim'den okur. Personel davet akışı (e-posta linki).
- [ ] **5.2 Kullanıcı yönetimi sayfası** (admin): personel ekle/çıkar, rol değiştir, pasife al. Kasiyer kendi şifresini değiştirebilsin (`/settings` şu an admin-only).

### Satış
- [ ] 5.3 Fiş/makbuz yazdırma (termal 58/80 mm + A4 PDF), satış sonrası özet ekranı, satış listesi/detay sayfası (şu an satış geçmişine bakılacak ekran yok!)
- [ ] 5.4 Satış iptali/iade (2.1), askıya alma (bekleyen sepetler), indirim UI'ı, karma ödeme (nakit+kart)
- [ ] 5.5 Birim türü (kg, lt, paket, çuval) ve ondalıklı miktar; KDV'li/KDV'siz döküm
- [ ] 5.6 Gün sonu / kasa kapanış raporu (nakit, kart, veresiye, tahsilat, gider)

### Veresiye
- [~] 5.7 Vade tarihi, taksit takvimi, gecikmiş borç listesi, yaşlandırma raporu — 27.10.2026: veri modeli (`creditTransactions.dueDate`, `installments[{no,dueDate,amount,paidAmount}]`, `downPayment`), `CreditService.buildInstallmentPlan()`, tahsilatın en eski vadeden dağıtımı (`credit.utils.ts` → `buildSchedule`, hesaplanır; defter değişmez), veresiye listesinde "Vadesi geçenler" / "Bu hafta" filtreleri + gecikme rozeti, `CreditService.overdueSummary$()` (dashboard'a bağlanmadı), müşteri `creditLimit` + `CreditService.checkCreditLimit()`, tarih aralıklı ekstre PDF (Noto Sans gömülü). **Açık:** POS veresiye dialoguna bağlama (POS), dashboard kartı, yaşlandırma raporu (0-30/31-60/60+).
- [~] 5.8 Borç hatırlatma: SMS (Netgsm/İleti Merkezi) veya WhatsApp link; tahsilat makbuzu — 27.10.2026: müşteri detayında wa.me ve `sms:` linkleri, Türkçe şablon (borç, vade, işletme adı), yalnızca iletişim rızası varsa. **Açık:** otomatik/toplu gönderim (sunucu gerekir), tahsilat makbuzu.

### Stok / Satın alma
- [x] 5.9 Alış faturası / irsaliye girişi (tedarikçi cari hesabı, tedarikçi borcu-ödemesi) — 27.10.2026, `/purchases`, ayrıntı Bölüm 12
- [ ] 5.10 Barkod etiketi yazdırma, kamera ile barkod okuma (mobil; `@zxing` kurulu ama bağlı değil)
- [ ] 5.11 Stok değer raporu, en çok satanlar, kategori bazlı rapor, Excel/PDF dışa aktarma (paketler kurulu, kullanılmıyor)

### Ürün olarak satış için altyapı
- [~] 5.12 (manuel aktivasyon + deneme + salt okunur mod yapıldı, Bölüm 10; ödeme entegrasyonu açık) **Lisans/abonelik:** `tenants/{id}.plan`, `expiresAt`, deneme süresi; uygulama açılışta kontrol; ödeme (iyzico/PayTR) veya manuel aktivasyon
- [x] 5.13 **Veri yedekleme/dışa aktarma** (JSON.zip + Excel indir, boş işletmeye geri yükleme, 7 gün hatırlatması) — 27.10.2026, `/settings/backup`, ayrıntı Bölüm 12
- [ ] 5.14 **Otomatik güncelleme:** Tauri updater plugin + imzalı release (GitHub Releases); Android için Play Store veya kendi APK güncelleme kontrolü
- [ ] 5.15 **İlk kurulum sihirbazı:** işletme adı, adres, vergi no, logo, fiş başlığı, KDV oranları, para birimi
- [x] 5.16 **KVKK:** aydınlatma metni, müşteri verisi silme talebi, TC no maskeleme — 27.10.2026: `src/assets/legal/aydinlatma-metni.md` (TASLAK, avukata gösterilmeli; şablon değişkenli) + `/customers/kvkk` ve form içi gösterim, ayrı açık rıza kutuları (`customers.consents.{processing,contact} = {at, version}`), TC no liste/detayda maskeli (yalnızca admin "Göster"), müşteri verisi JSON/Excel dışa aktarma, borcu 0 iken anonimleştirme. **Açık:** `creditTransactions`/`sales` içindeki `customerName` kopyası anonimleştirilemiyor (defter değişmez kuralı); yurt dışı aktarım (KVKK m.9) hukuki süreci.
- [ ] 5.17 Hata izleme (Sentry benzeri) ve kullanım analitiği; destek/geri bildirim kanalı
- [ ] 5.18 Kullanıcı dokümantasyonu / uygulama içi yardım

---

## 6. 🖥️ KENDİ SUNUCUNA GEÇİŞ — Hazırlık

Şu an Firebase her yere sızmış: sayfalar ve store'lar doğrudan `inject(Firestore)` kullanıyor (`dashboard.store.ts`, `sale.service.ts`, `credit-detail.page.ts`, `sales-report.page.ts`), modeller `Timestamp` tipine bağlı, `serverTimestamp()`/`increment()`/`writeBatch` iş mantığının içinde. Bugün sunucu değiştirmek = her dosyaya dokunmak.

**Hedef:** Firebase'i tek bir katmanın arkasına almak; sonra o katmanın ikinci bir implementasyonunu (REST + PostgreSQL) yazmak. Para yokken **sadece hazırlık** (6.1-6.4) yapılır; geçiş (6.5+) sonra.

- [ ] **6.1 Repository arayüzleri.** `src/app/core/data/`: `ProductRepository`, `SaleRepository`, `CustomerRepository`, `CreditRepository`, `ExpenseRepository`, `SupplierRepository`, `StockMovementRepository`, `AuthProvider`. Metotlar domain tipleriyle (`Date`, `number`), Firestore tipi yok. `InjectionToken` ile sağlanır.
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

- [ ] **8.7 Satış → çiftçi ambarı (M).** — **KISMEN:** projeksiyon `farmerPurchases` (maliyet fiyatı yok, BKÜ fiyatı yok) bayinin çiftçi panelinde otomatik senkronlanır; `sale.service.ts` entegrasyonu (satış anında `syncCustomerToFarmer`) POS ajanına bırakıldı.
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

- [ ] **8.11 PWA + Hosting (M).** — **KISMEN:** `public/ciftci.webmanifest` (start_url /ciftci) layout'tan bağlanır; service worker + Hosting cache ayarı yapılmadı.
  - **Dosyalar:** `ngsw-config.json`, `public/manifest.webmanifest` (veya çiftçi için ayrı manifest), `firebase.json` (`hosting`, SPA rewrite, cache header'ları), `angular.json`.
  - **Yapılacak:** `@angular/service-worker`; `start_url: /ciftci`; "Ana ekrana ekle" yönlendirmesi; çiftçi lazy chunk'ı ≤ 250 KB gz; Tauri build'ini bozmamak (service worker Tauri'de devre dışı).
  - **Kabul:** Android Chrome'da ana ekrana eklenir, uçak modunda açılır ve önceki veriyi gösterir; `ng build` + Tauri build yeşil.

- [ ] **8.12 KVKK metinleri ve izin yönetimi (S, + hukuk incelemesi).** — **KISMEN:** izin yönetimi, bağlantı koparma, silme talebi, yasal metinler arayüzde; `docs/legal/ciftci-aydinlatma-v1.md` (avukat) yok.
  - **Dosyalar:** `src/app/features/farmer/pages/consent/`, `pages/settings/`, `docs/legal/ciftci-aydinlatma-v1.md` (metin taslağı, avukat onayı bekler).
  - **Yapılacak:** İzinleri ayrı ayrı aç/kapa, bayiyle bağlantıyı kopar (`status=revoked`), hesabımı ve verilerimi sil talebi (MVP: talep kaydı + bayi/yönetici manuel işlem). Uygulama içinde "Bu kişisel defterinizdir, resmî ÜKD değildir" ve "Uygulama ilaç/doz önermez" metinleri.
  - **Kabul:** İzin kapatınca ilgili dokümanların `sharedTenantIds`'inden tenant çıkar (rules testi 8.2 ile doğrulanır); metin sürümü ve tarih kaydedilir.

- [ ] **8.13 Pilot ve ölçüm (S).**
  - **Yapılacak:** 1 bayi, 10–20 çiftçi. Firebase kullanım panelinde günlük okuma/yazma takibi; çiftçi başına ortalama okuma ölçülür ve `docs/CIFTCI-MODULU.md` §7.3 tahmini güncellenir.
  - **Kabul:** 4 hafta sonunda: haftalık aktif çiftçi oranı, günlük okuma/çiftçi, bayinin geri bildirimi raporlanmış.

### v2 (MVP pilotundan sonra)

- [x] **8.14 Bayi mühendisi önerisi + e-reçete no (L).** `recommendations` koleksiyonu; sadece `canPrescribe`; reçeteli ürün içeriyorsa `prescriptionNo` zorunlu (rules); değiştirilemez, sadece geri çekilir; çiftçide "Bayinizin önerisi — Müh. Ad Soyad (yetki no)". Öneriden tek dokunuşla uygulama kaydı. **Kabul:** yetkisiz kullanıcı öneri yazamaz (rules testi); öneri içeriği güncellenemez. — *(MVP ile yapıldı; rules testli)*
- [ ] **8.15 Reçete görüntüleme (S).** Öneri/satış kalemine e-reçete no ve (Storage kotası doğrulanırsa) fotoğraf/PDF.
- [x] **8.16 Hava durumu ve ilaçlama uygunluk şeridi (M).** MET Norway Locationforecast, istemci önbelleği 1 saat, CC BY 4.0 atfı, ayarlanabilir eşikler (§7.4). **Kabul:** aynı tarla için saatte en fazla 1 istek; atıf metni görünür; Firestore'a yazma yok. — *(MVP ile yapıldı; tarayıcı User-Agent gönderemez → Origin/Referer; Tauri CSP'ye `https://api.met.no` eklenmeli)*
- [ ] **8.17 Yerel hatırlatmalar (M).** Vade yaklaşan borç, PHI bitişi, ÜKD'ye giriş hatırlatması (kayıttan 2 gün sonra) — istemci tarafı yerel bildirim (PWA Notification / Tauri notification plugin). Sunucu push'u kendi sunucuya geçince.
- [ ] **8.18 Ön talep — sadece gübre/tohum/malzeme (M).** `preOrders`; bayide talep listesi ve durum. BKÜ kategorisindeki ürünler seçilemez. **Kabul:** kategori kontrolü hem UI'da hem rules'ta.
- [ ] **8.19 Maliyet ve dekar başı kârlılık (M).** `costEntries` + ambar alış fiyatları + hasat geliri → sezon raporu.
- [ ] **8.20 Veresiye hareketleri çiftçiye (M).** `creditTransactions` için `(tenantId, customerId)` sorgusuna çiftçi okuma kuralı (`farmerLinks` üzerinden) + indeks.
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
- [ ] Tauri updater: `npx tauri signer generate` ile anahtar üret, private key'i GitHub secret `TAURI_SIGNING_PRIVATE_KEY` olarak ekle, `tauri-plugin-updater` + `latest.json` endpoint'i (Releases).
- [ ] Windows kod imzalama sertifikası (SmartScreen uyarısını kaldırır; satış öncesi).
- [ ] Android release keystore + imzalı AAB.

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
- [ ] 10.9 `SUPPORT_CONTACT` (`core/license/license.config.ts`) gerçek telefon/e-posta ile değiştirilmeli.
- [ ] 10.10 Canlıya geçişte: rules + `auditLogs` indeksi deploy; ilk superadmin'i Console'dan ekle; eski işletmelere (plan yok = kısıtsız) panelden plan ata.
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
- [ ] 11.8 `firestore.rules`: tenant update kuralında `settings` zaten izinli (superadmin ajanı). Öneri: `settings.prescriptionMode in ['required','warn','off']` doğrulaması eklensin. `sales` create'te alan listesi yok, yeni alanlar sorunsuz yazılıyor.
- [x] 11.9 Ayarlar UI'ında e-reçete modu seçimi (+ 'warn'/'off' seçerken sorumluluk uyarısı) — Ayarlar → Satış ayarları (30.10.2026).
- [ ] 11.10 Bakanlık B-Reçete / BKÜ takip sistemi entegrasyonu (API yok/kamuya açık değil): şimdilik elle; satışta "takip sistemine bildirildi" işareti ve günlük bildirim listesi düşünülebilir.
- [ ] 11.11 Reçeteli satış kayıtlarının 5 yıl saklanması: satış silme yok (iptal soft) — yedek/dışa aktarma (5.13) ile garanti altına alınmalı; KVKK aydınlatmasına TC/ÇKS saklama amacı eklenmeli (5.16).
- [ ] 11.12 Müşteri modelinde ÇKS no (`cksNo`) — müşteri ajanı; dışa aktarma bu alanı okuyor.
- [ ] 11.13 SKT geçmiş BKÜ için "firmaya iade (30 gün)" çıkış hareketi türü ve listesi.

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

Prototip: `docs/design/c-saha-komuta/index.html` (seçilen). B'den (`docs/design/b-bento-yumusak`) büyük "Bugünkü ciro" kartı ve POS hızlı para butonları alındı.
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
- [ ] `providePrimeNG({ overlayAppendTo: 'body' })` (app.config) — dialog içi select/autocomplete kırpılmasın, tekrar eden `appendTo="body"` kalkar. Kalan px yazı: grafik SVG (`sales-trend-chart` 11.5/12px), Chart.js tick `font.size`, fiş (yazıcı, bilerek px).
