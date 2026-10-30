# Çiftçi Modülü — Fizibilite, Tasarım ve Görev Planı

> Tarih: 2026-10-27 · Durum: **Öneri / karar bekliyor** · İlgili: `TASKS.md` (Bölüm 2 güvenlik, 5.1 tenant modeli, 6.x veri katmanı)
> Fikir: "Bu uygulamaya çiftçi de girebilsin; arazisi için atması gereken ilaç, gübre gibi detaylı bir alan olsun."
>
> Bu belge mevzuat konusunda hukuki görüş değildir. Mevzuat atıfları Aralık 2025 tarihli yönetmeliklerin internetteki
> metinlerinden özetlenmiştir; yayına almadan önce `mevzuat.gov.tr` üzerinden güncel metin ve bir avukat/ziraat
> mühendisi ile teyit edilmelidir.

---

## 0. Tek paragrafta sonuç

**Yapılabilir ve bayi için güçlü bir satış argümanı olur, ama sadece şu çerçevede:** çiftçi tarafı bir
**"kayıt defteri + bayiyle bağlantı"** uygulaması olur, bir **"ilaç/doz öneren tarım danışmanı"** olmaz.
Aralık 2025 yönetmelikleriyle (RG 33106) bitki koruma ürünlerinde **elektronik reçete**, **Üretici Kayıt Defteri (ÜKD)**
ve **internetten tanıtım/satış yasağı** geldi. Uygulamanın kendisi ilaç/doz önerirse hem yasal hem de kalıntı
sorumluluğu riski doğar. Doğru konum: öneriyi **bayideki yetkili kişi** (reçete yazma yetkili ziraat mühendisi)
yazar, çiftçi uygulaması bunu **gösterir, hatırlatır, kaydeder**; PHI (hasat aralığı) uyarısını etiket verisinden
hesaplar. Aynı Angular projede ayrı bir `/ciftci` alanı olarak, önce **PWA** (Firebase Hosting) şeklinde yapılmalı.
MVP yaklaşık **4–6 hafta / 1 geliştirici**; ancak **önkoşul**: `TASKS.md` Bölüm 2'deki güvenlik kuralları (2.37, 2.38)
ve 5.1 tenant modeli bitmiş olmalı. Çiftçiler projeye güvenilmeyen yeni bir kullanıcı sınıfı olarak giriyor.

---

## 1. Karar

### 1.1 Yapılabilir mi, ne kadar büyük?

| Soru | Cevap |
|---|---|
| Teknik olarak yapılabilir mi? | Evet. Mevcut yığın (Angular 21 + Firestore + Tauri/Android) yeterli. Yeni zorluklar: kiracılar arası veri paylaşımı (çiftçi ↔ birden çok bayi), Cloud Functions olmadan (Spark) güvenli davet akışı. |
| Büyüklük | MVP ≈ mevcut uygulamanın %30–40'ı kadar yeni kod (~3–4 bin satır TS). v2 + v3 ile mevcut uygulama büyüklüğüne ulaşır. |
| En büyük risk | Teknik değil **hukuki** risk: doz/ilaç önerisi, reçete ve internet satışı yasağı (bkz. §4). İkinci risk: Spark kotası **proje genelinde** paylaşılıyor (bkz. §7.3). |
| Rakip var mı? | Var, ama hepsi ya büyük firma (banka/gübre üreticisi) ya uydu-odaklı. **Yerel bayiye bağlı, veresiye + ambar + reçete gösteren** bir uygulama görünmüyor. Boşluk bu. |

### 1.2 Ayrı uygulama mı, aynı uygulamada ayrı alan mı?

**Öneri: Aynı kod tabanı, ayrı route grubu (`/ciftci`) ve ayrı layout; dağıtım önce PWA, sonra (v2) ayrı Android paketi.**

Gerekçe:
- **Kod paylaşımı:** modeller, i18n, tema, auth, Firestore katmanı (ve `TASKS.md` 6.1'deki repository soyutlaması) ortak.
  Ayrı repo = iki kez bakım.
- **Kullanıcı karışıklığı yok:** giriş sonrası `accountType` (`business` | `farmer`) farklı kabuk yükler. Çiftçi POS'u,
  stoku, raporları hiç görmez (lazy-load ile kodu bile indirilmez).
- **Dağıtım:** çiftçiye "uygulamayı Play Store'dan indir" demek bayi APK'sının bugünkü imzasız-debug durumunda gerçekçi değil.
  **PWA linki WhatsApp'tan/fişteki QR'dan açılır, ana ekrana eklenir.** Firebase Hosting Spark planda ücretsiz.
- **v2'de ayrı Android uygulaması:** Play Store'da "Tarım Market Çiftçi" adıyla ayrı `applicationId` (Tauri'de ikinci
  bir config veya Capacitor/TWA ile aynı PWA'yı sarmak). Bayi uygulamasının Play listesi ile çiftçininki karışmamalı.

### 1.3 İş modeli

**Bayi öder, çiftçi ücretsiz.** Çiftçiden para istemek benimsenmeyi öldürür; Türkiye'deki benzer çiftçi uygulamaları
(Şekerbank Hasat Mobil, Ziraat Çiftçi Platformu, Toros Çiftçi) çiftçiye ücretsizdir.
Kaynak: [Hasat Mobil](https://www.capital.com.tr/sirket-panosu/sirket-panosu-haberleri/ciftciler-icin-hasat-mobil-uygulamasi-baslatti),
[Ziraat Çiftçi Platformu](https://www.ziraatbank.com.tr/tr/sss/diger/ziraat-ciftci-platformu),
[Toros Çiftçi](https://www.capital.com.tr/sirket-panosu/sirket-panosu-haberleri/toros-tarim-ciftci-uygulamasi-ile-ureticiye-katki-sunuyor).

- Lisans planı (`TASKS.md` 5.12): `tenants/{id}.plan = 'basic' | 'pro'`; çiftçi modülü **Pro** özelliği.
  Fiyat önerisi: bağlı çiftçi sayısına göre kademe (ör. 50'ye kadar dahil, sonrası ek ücret) — Firestore maliyetiyle orantılı.
- Çiftçi birden çok bayiye bağlanabilir (gerçekte de öyle). Her bayi **sadece kendi** satışlarını/veresiyesini görür;
  çiftçi hepsini birlikte görür. Bu çiftçi için asıl değer önerisidir.

**Bayiye ne kazandırır?**

| Kazanç | Nasıl |
|---|---|
| Müşteri bağlılığı | Çiftçinin tarlası, ekim takvimi, aldığı ürünler bu bayinin uygulamasında. Başka bayiye geçmenin "maliyeti" artar. |
| Veresiye tahsilatı | Çiftçi borcunu ve vadesini telefonda görür; hasat sonrası ödeme hatırlatması bayi adına gider. Bugün veresiye en büyük nakit sorunu. |
| Sezon önü satış | Ekim planı (ne, kaç dekar, ne zaman) bayiye görünür → gübre/tohum ön talebi, stok planlaması, toplu alımda pazarlık. |
| Reçete/ÜKD yükünü hafifletme | Bayinin ziraat mühendisi öneriyi bir kere yazar, çiftçi uygulama kaydını kendisi tutar; denetimde düzenli kayıt. |
| Farklılaşma | Rakip bayi "sadece kasa" kullanırken bu bayi "dijital hizmet" verir. Kooperatif/banka uygulamalarına karşı yerel avantaj. |

---

## 2. Kullanıcı rolleri ve giriş

### 2.1 Roller

| Rol | Nerede | Not |
|---|---|---|
| `admin`, `cashier`, `staff` | Bayi (tenant) | Auth ajanının kurduğu `users/{uid}.tenantId + role` modeli. |
| `agronomist` (yeni, bayrak) | Bayi | Ayrı rol değil, `users/{uid}.canPrescribe = true` + `prescriberLicenseNo`. Sadece bu kişiler çiftçiye **uygulama önerisi** yazabilir (§4). |
| `farmer` | Kendi alanı | `users/{uid}.accountType = 'farmer'`, `tenantId = null`. Hiçbir tenant koleksiyonuna genel erişimi yok. |

> **Auth ajanı ile koordinasyon şart:** kural fonksiyonları (`isStaffOf(tenantId)`) `accountType == 'farmer'` olan
> kullanıcıyı **asla** kabul etmemeli. `users/{uid}` dokümanında `role`, `tenantId`, `accountType` alanları istemci
> tarafından yazılamamalı (`TASKS.md` 2.37).

### 2.2 Çiftçi hesabı nasıl açılır?

**Telefon OTP (SMS) Spark planda yok** — Firebase fiyat sayfasında Spark sütununda SMS kotası listelenmiyor; SMS Blaze'de
mesaj başı ücretli ([firebase.google.com/pricing](https://firebase.google.com/pricing)). Cloud Functions de Spark'ta yok.
Bu yüzden öneri:

**MVP: Bayi daveti + telefon numarası + 6 haneli PIN (e-posta/şifre auth arkasında)**

1. Bayi, müşteri kartında **"Çiftçi uygulamasına davet et"** der → `farmerInvites/{code}` oluşur
   (`code` = 10 karakter rastgele, tahmin edilemez; 7 gün geçerli; tek kullanımlık; `tenantId`, `customerId`, telefon son 4 hane).
2. Kod **QR** olarak ekranda/fişte gösterilir veya **WhatsApp linki** (`https://wa.me/90…?text=…/ciftci/davet/{code}`) ile gönderilir.
   (WhatsApp link açmak API değildir, ücretsizdir; mesajı bayi kendisi gönderir.)
3. Çiftçi linki açar → telefon numarası (bayinin kayıtlı numarasıyla son 4 hanesi eşleşmeli) + 6 haneli PIN belirler.
4. Arka planda Firebase Auth **e-posta/şifre** hesabı açılır: e-posta = `90XXXXXXXXXX@ciftci.<alan-adı>` (sentetik),
   şifre = 6 haneli PIN (Firebase en az 6 karakter ister).
   Brute force'a karşı Firebase Auth'un kendi hız sınırlaması + App Check (`TASKS.md` 2.41) devreye alınmalı.
5. Aynı istemci işlemi (`writeBatch`) içinde: `users/{uid}` (farmer), `farmers/{farmerId}`, `farmerLinks/{tenantId}_{farmerId}`
   oluşturulur ve davet `used = true` yapılır. Kural tarafı `getAfter()` ile davetin geçerli olduğunu ve
   tek kullanımlık olduğunu doğrular (§5.3).

**PIN unutulursa:** sentetik e-postaya sıfırlama gidemez ve Cloud Functions olmadan bayi şifre değiştiremez.
Çözüm: bayi **yeni davet** üretir; yeni uid aynı `farmerId`'ye bağlanır (`farmers/{id}.ownerUids` dizisi,
eski uid listeden çıkarılır). Veri uid'e değil `farmerId`'ye bağlı olduğu için kayıp olmaz. **Bu yüzden veri modelinde
`farmerId ≠ uid`** (PostgreSQL'e geçişte de doğru tasarım).

**Bayisiz kayıt (v2):** Çiftçi kendisi kayıt olabilir (aynı telefon+PIN akışı, davet kodu olmadan), sonra bayiye
"bağlantı isteği" gönderir. Kendi sunucuya geçince (veya Blaze'e geçilirse) gerçek **SMS OTP** eklenir.

### 2.3 Bayi–çiftçi bağlantısı ve mevcut `customers` kaydı

- `farmerLinks/{tenantId}_{farmerId}`: `{ tenantId, farmerId, customerId, status: 'active'|'revoked', consent: {...}, ... }`.
- Bağlantı **davetle** kurulduğu için eşleştirme kesin: davet bir `customerId`'den üretilir. İsim/telefon ile
  otomatik eşleştirme **yapılmaz** (yanlış kişiye borç gösterme riski).
- `customers/{id}.farmerId` alanı eklenir (POS satışında "bu müşteri uygulamalı" ikonunu göstermek ve ambar kaydı
  yazmak için).

### 2.4 KVKK

- **Kim veri sorumlusu?** Bayinin müşteri kayıtlarında veri sorumlusu bayidir, biz (yazılım sağlayıcı) veri işleyeniz.
  Çiftçi uygulamasında çiftçinin **kendi girdiği** veriler (tarla konumu, ekim, ilaçlama kayıtları) için ise uygulama
  sağlayıcısı veri sorumlusu olur → ayrı **aydınlatma metni** ve **kullanım koşulları** gerekir.
- **Açık rıza / izin ekranı:** Bağlantı kurulurken çiftçiye net, ayrı ayrı işaretlenebilir izinler:
  - [x] Bayi benim alışverişlerimi ve borcumu bana gösterebilir (zorunlu — hizmetin kendisi)
  - [ ] Bayi tarlalarımı ve ekim planımı görebilir (isteğe bağlı)
  - [ ] Bayi ilaçlama/gübreleme kayıtlarımı görebilir (isteğe bağlı)
  - [ ] Bayi bana hatırlatma/bildirim gönderebilir (isteğe bağlı; ticari ileti ise İYS kapsamı ayrıca değerlendirilmeli)
  İzinler `farmerLinks.consent` içinde tarih + metin sürümüyle saklanır, çiftçi istediği an geri alır (kural tarafında anında etkili).
- **Yurt dışına aktarım:** Firestore sunucuları Türkiye dışında. 2024 KVKK değişikliği (7499 sayılı Kanun) ile açık rıza
  artık genel aktarım dayanağı değil (1 Eylül 2024'ten itibaren); yeterlilik kararı yoksa **standart sözleşme** ve
  imzadan itibaren **5 iş günü içinde Kuruma bildirim** gerekir.
  Kaynak: [EY – KVKK değişikliği](https://www.ey.com/tr_tr/insights/law/kvkk-degisikliginin-yurt-disi-veri-aktarimina-etkisi),
  [KVKK standart sözleşme bildirim modülü duyurusu](https://www.alomaliye.com/2024/10/30/kvkk-standart-sozlesme-bildirim-modulu/).
  Bu konu bayi tarafı için de zaten geçerli (`TASKS.md` 5.16); çiftçi modülü öncesi bir KVKK uzmanıyla netleştirilmeli.
  Kendi sunucuya (Türkiye'de barındırılan PostgreSQL) geçiş bu riski büyük ölçüde kaldırır.
- TC kimlik no çiftçi tarafında **istenmez**. ÇKS numarası isteğe bağlı.

---

## 3. Özellikler (MVP / v2 / v3)

### 3.1 MVP — "Bayimle bağlıyım, tarlamı ve ambarımı görüyorum"

| # | Özellik | Açıklama | Neden MVP |
|---|---|---|---|
| M1 | Davetle hesap + bağlantı + izin ekranı | §2.2–2.4 | Temel |
| M2 | **Ambarım (alınanlar)** | Bayide satış yapılıp müşteri çiftçiye bağlıysa satış kalemleri otomatik `farmers/{id}/purchases`'a düşer: ürün, miktar, tarih, bayi, parti/GTS no, SKT. | Çiftçiye sıfır veri girişiyle ilk gün değer verir. |
| M3 | **Borcum** | Her bayi için bakiye, son hareketler, vade (varsa). Sadece okuma. | Bayiye en hızlı geri dönüş: tahsilat. |
| M4 | **Tarlalarım** | Ad, alan (dekar), il/ilçe/köy, ada/parsel (elle), konum (haritada tek pin veya GPS), sulu/kuru, ÇKS no (opsiyonel). | Diğer her şeyin bağlamı. |
| M5 | **Sezon / ekim kaydı** | Tarla + ürün (buğday, mısır, domates…) + çeşit + ekim tarihi + beklenen hasat. | PHI ve maliyet hesabının temeli. |
| M6 | **Uygulama defteri** (ilaçlama/gübreleme/sulama/çapa) | Tarih, tarla, ürün (ambardan seç veya elle), miktar, dekar başı doz, uygulayan kişi, not, fotoğraf (v2). **ÜKD'nin resmi kaydının yerine geçmez**, kişisel defter ve ÜKD'ye girmeye hazırlık. | Çiftçinin günlük kullanım sebebi. |
| M7 | **PHI uyarısı** | İlaç uygulaması kaydedilince, ürünün **etiket bilgisinden** (bayinin ürün kartına girdiği `labelUses[].phiDays`) "En erken hasat: 12 Kasım" hesaplanır; hasat tarihi bundan önceyse kırmızı uyarı. Etiket bilgisi yoksa "Hasat aralığını etiketten kontrol edin" uyarısı. | Kalıntı = çiftçinin sorumluluğu (yönetmelik md. 17). Yüksek değer, düşük risk (öneri değil, etiket bilgisi). |
| M8 | Bayi tarafı: müşteri kartında "uygulamalı çiftçi" ekranı | Bağlı çiftçinin (izin verdiyse) tarlaları, ekim planı, son uygulamaları. | Bayiye görünür değer. |

### 3.2 v2 — "Bayimden öneri ve hatırlatma alıyorum"

| # | Özellik | Açıklama |
|---|---|---|
| V1 | **Uygulama planı / öneri (bayi mühendisi yazar)** | Sadece `canPrescribe` kullanıcısı yazabilir. Alanlar: tarla/sezon, hedef (zararlı/hastalık), ürün, doz, uygulama penceresi, **e-reçete no** (reçeteli üründe zorunlu), yazanın adı + yetki belge no. Çiftçide "Bayinizin önerisi — Mühendis X" başlığıyla görünür. Uygulama kendi öneri **üretmez**. |
| V2 | **Reçete görüntüleme** | E-reçete numarası + reçete PDF/fotoğrafı (bayi yükler). Resmi sisteme entegrasyon yok (API bilinmiyor); sadece referans. |
| V3 | **Hava durumu ve ilaçlama uygunluğu** | Tarla konumu için 48 saatlik tahmin; saat saat "uygun / dikkat / uygun değil" şeridi (rüzgar, yağış, sıcaklık). Eşikler etiketten önce gelmez; ayarlanabilir. §7.4 API seçimi. |
| V4 | **Borç hatırlatma** | Vade yaklaşınca uygulama içi bildirim (FCM ücretsiz). Bayi tarafında "hatırlat" butonu → WhatsApp linki. |
| V5 | **Ön talep (sadece gübre/tohum/genel malzeme)** | Çiftçi "Mart başı için 40 çuval 20.20.0" der → bayide talep listesi. **Bitki koruma ürünleri için ön talep / katalog / fiyat gösterme YOK** (internet tanıtım ve satış yasağı, §4.3). BKÜ için sadece "Bayiyle görüşme talebi" (konu serbest metin). |
| V6 | **Maliyet ve dekar başı kârlılık** | Ambardaki alımlar (fiyatıyla) + elle giderler (mazot, işçilik, su, kira) + hasat (miktar × fiyat) → sezon/tarla bazında dekar başı maliyet ve kâr. |
| V7 | Fotoğraf (uygulama kaydı, zararlı fotoğrafı bayiye gönder) | Firebase Storage Spark kotası değişti/kısıtlı olabilir; **v2'de doğrula**, gerekirse fotoğrafı sıkıştırıp küçük boyutta sakla veya kendi sunucuya geçişi bekle. |
| V8 | Ayrı Android paketi (Play Store) | §1.2 |

### 3.3 v3 — "Planlı sezon"

| # | Özellik | Açıklama |
|---|---|---|
| T1 | **Toprak analizi kaydı** | Laboratuvar raporu: pH, EC, kireç, organik madde, N, P, K, mikro elementler, bünye; rapor fotoğrafı/PDF. |
| T2 | **Gübre hesaplayıcı (öneri motoru değil)** | Girdi: laboratuvarın veya mühendisin **önerdiği saf madde** (kg/da N, P₂O₅, K₂O). Çıktı: seçilen ticari gübrelerle kaç kg/da ve tarlaya toplam kaç çuval. Ör. üre (%46 N) için 100/46 ≈ ×2,17; amonyum sülfat (%21 N) için 100/21 ≈ ×4,76 (kaynaklarda yuvarlanmış 2,2 ve 5,0 geçer). Kaynak yaklaşımı: Bakanlık/TAGEM bölgesel gübre tavsiye çizelgeleri + saf maddeden ticari gübreye dönüşüm ([TAGEM gübre tavsiye verileri](https://www.tarimorman.gov.tr:443/TAGEM/Belgeler/yayin/TOPRAKSU%20GÜBRE%20TAVSİYE%20%20Verileri.pdf), [Sebzelerde Gübreleme – Alata](https://arastirma.tarim.gov.tr/alata/Belgeler/brosurler/brosur2022/SebzelerdeGübreleme-RasimARSLAN.pdf)). Analizden **saf madde önerisini** otomatik çıkarmak (çizelge tabanlı) ancak bir ziraat mühendisi tabloları onaylarsa ve "bayi mühendisi onayı" adımıyla yapılmalı. |
| T3 | Sezon şablonları | Bayi mühendisi "Konya buğday sezonu" şablonu hazırlar (taban gübre, üst gübre, yabancı ot dönemleri) → çiftçinin takvimine **tarih olarak** düşer, ürün adı içermeyen genel adımlarla. Ürün bazlı öneri yine V1 akışıyla. |
| T4 | Hasat kaydı + ÜKD çıktısına benzer döküm | Hasat tarihi/miktarı; tarla-sezon bazında uygulama listesi PDF (çiftçinin ÜKD'ye girişini ve alıcıya bilgi vermesini kolaylaştırır; resmi belge gibi görünmemeli). |
| T5 | Sesli not / sesli okuma | Kayıtları sesle ekleme (Web Speech API, Türkçe destek cihaza bağlı) ve ekran okuma. |
| T6 | Uydu/NDVI | **Yapma.** Agrovisio, Doktar gibi uzman şirketlerin alanı; maliyetli. Gerekirse ortaklık. |

---

## 4. Hukuki / sorumluluk riskleri

### 4.1 Mevzuat çerçevesi (Aralık 2025)

13 Aralık 2025 tarihli, 33106 sayılı Resmî Gazete'de iki yönetmelik yayımlandı; 2019 satış yönetmeliği yürürlükten
kalktı; pilot iller dışında hükümler **1 Temmuz 2026**'dan itibaren uygulanıyor (yani bugün, Ekim 2026'da yürürlükte).

**Bitki Koruma Ürünlerinin Toptan ve Perakende Satılması ile Depolanması Hakkında Yönetmelik**
([metin – alomaliye](https://www.alomaliye.com/2025/12/13/bitki-koruma-urunlerinin-toptan-ve-perakende-satilmasi-ile-depolanmasi/amp/)):
- Reçete zorunlu ürünleri Bakanlık risk değerlendirmesiyle belirler; BKÜ Veri Tabanı'nda yayımlanır (md. 15).
- Reçeteyi Bakanlıktan **yetki almış** bitki koruma bölümü mezunu ziraat mühendisleri ile yetki almış bayi/toptancı
  izin belgesi sahipleri ve sorumlu yöneticiler yazar (md. 16).
- Reçete **elektronik reçete sistemi** üzerinden düzenlenir; kullanıcı ürünü e-reçete numarasıyla bayiden alır (md. 18).
- Bayi reçeteli ürünü reçetesiz satamaz, reçeteli satış kayıtlarını ve belgeleri 5 yıl saklar (md. 21/o);
  alış/satış/iade/transferi işlem anında takip sistemine bildirir (md. 21/m); karekodsuz ürünü bulunduramaz/satamaz (md. 21/l, n).
- **Md. 7: Ruhsatlı bitki koruma ürünlerinin internet ve sosyal medya üzerinden tanıtımı ve satışı yasak**; reklam,
  video, görsel de dahil. Ruhsat sahipleri dışında kimse tanıtım yapamaz.

**Bitki Koruma Ürünlerinin Uygulanması ve Denetimine İlişkin Yönetmelik**
([metin – alomaliye](https://www.alomaliye.com/2025/12/13/bitki-koruma-urunlerinin-uygulanmasi-ve-denetimine-iliskin-yonetmelik/)):
- Reçete zorunlu ürünler reçetesiz **uygulanamaz** (md. 11/1).
- **Üretici Kayıt Defteri (ÜKD)** elektronik bir kayıttır (md. 4/çç); uygulama kayıtları Bakanlık sistemine
  **en geç 3 gün içinde** girilir ve 5 yıl saklanır (md. 15). Sisteme kaydı olmayan ürün satılamaz (md. 18/1).
- Üretici hasat tarihi ve miktarını sisteme kaydeder, satışta ÜKD çıktısını alıcıya verir (md. 17/3).
- **"Bitki koruma ürününün hatalı uygulamasından kaynaklanan kalıntıdan üretici sorumludur"** (md. 17/5).
- Uygulamayı profesyonel uygulayıcı veya **yetkilendirilmiş üretici** yapar (md. 6, 4/gg).

Ek kaynaklar: [CNBC-e – B-Reçete zorunlu](https://www.cnbce.com/haberler/bitki-koruma-urunlerinin-satisinda-elektronik-b-recete-takip-sistemi-zorunlu-oldu-h21186),
[Ekonomi Gazetesi – reçetesiz satışa ceza](https://www.ekonomigazetesi.com/sektor-haberleri/recetesiz-bitki-koruma-urunu-satan-bayilere-5-bin-tl-para-cezasi-verilecek-67117),
[Bakanlık – 2026 ÜKD tutulacak ürünler](https://www.tarimorman.gov.tr/Konu/893),
[ÜKD SSS (eski, Bakanlık)](https://www.tarim.gov.tr/GKGM/Belgeler/Uretici_Bilgi_Kosesi/Merak_Ettikleriniz/UKD_Sikca_Sorulan_Sorular.pdf),
[Efeler B-reçete bilgilendirme (BKÜTS kapsamında)](https://www.gazetebirlik.com/gundem/efelerde-bitki-koruma-urunleri-ve-b-recete-sistemi-bilgilendirme-toplantisi-yapildi/1049950).

Gübre tarafında ayrı bir izlenebilirlik sistemi (GTS: karekod + DNA işaretleyici) var; dağıtıcıya kamera vb. yükümlülükler
getiriyor ([Bakanlık haberi](https://www.tarimorman.gov.tr/Haber/4561/Dna-Barkod-Ve-Dna-Bandrollu-Gubre-Numuneleri-Analiz-Ediliyor)).
Projede zaten parti bazlı GTS no tutuluyor; çiftçinin ambarına GTS no ile düşmesi izlenebilirliği güçlendirir.

### 4.2 Risk matrisi ve kararlar

| Risk | Olasılık / Etki | Karar |
|---|---|---|
| Uygulama kendi başına "şu zararlıya şu ilacı şu dozda at" der | Yüksek / Çok yüksek (reçete mevzuatı, kalıntı → hasat imhası, tazminat davası) | **Yapılmaz.** Otomatik ilaç/doz önerisi yok. Öneriyi sadece `canPrescribe` yetkili kişi yazar, adı ve yetki no'su öneride görünür. |
| Reçeteli ürünü reçetesiz "öneri" ile çiftçiye yönlendirme | Orta / Yüksek | Reçeteli ürün içeren öneride **e-reçete no zorunlu alan**. Ürün kartında `requiresPrescription` bayrağı (bayi işaretler; BKÜ Veri Tabanı'ndaki listeye göre). |
| İnternet tanıtım/satış yasağı (md. 7) | Orta / Yüksek | Çiftçi uygulamasında **BKÜ kataloğu, fiyatı, kampanyası, "sepete ekle"si yok**. BKÜ yalnızca çiftçinin **zaten satın aldığı** kalemler (ambar) ve mühendisin **kişiye özel** önerisi olarak görünür. Ön talep sadece gübre/tohum/malzeme. Hukukçuya "kişiye özel, satış sonrası kayıt gösterimi md. 7 kapsamında mı?" sorusu sorulmalı. |
| Yanlış PHI verisi → erken hasat → kalıntı | Orta / Yüksek | PHI **etiketten** ve **ürün+bitki** bazında girilir (aynı ilacın PHI'si bitkiye göre değişir). Veri yoksa hesap yapılmaz, uyarı gösterilir. Her PHI ekranında: "Bilgi etiketten alınmıştır; uygulamadan önce etiketi okuyun." Veri kaynağı ve giren kişi kaydedilir. |
| Uygulama defterinin resmi ÜKD sanılması | Orta / Orta | Ekranlarda açıkça: "Bu sizin kişisel defterinizdir. Resmî Üretici Kayıt Defteri'ne (Bakanlık sistemi) giriş ayrıca yapılmalıdır — 3 gün içinde." Hatırlatıcı olarak işe yarar. |
| Hava durumu "uygun" dedi ama sürüklenme oldu | Düşük / Orta | Dil: "uygun görünüyor" değil "Rüzgar 18 km/s — etiket koşullarını kontrol edin". Karar çiftçide. |
| Gübre hesabı yanlış | Düşük / Orta | Sadece **aritmetik dönüşüm** (saf madde → ticari gübre). Saf madde girdisi lab/mühendisten; kaynak alanı zorunlu. |
| BKÜ Veri Tabanı'ndan veri kazıma (scraping) | — | **Yapılmaz.** [bku.tarimorman.gov.tr](https://bku.tarimorman.gov.tr/) resmi ruhsat/tavsiye/MRL arama sunuyor ama API ya da açık veri lisansı yok, "Tüm hakları saklıdır". Bayi mühendisi etiket bilgisini kendi ürün kartına girer; uygulama BKÜ sayfasına **link** verir. |
| TKGM parsel verisi | — | Otomatik sorgu/kazıma yok; kullanım koşulları bulunamadı. Ada/parsel **elle** girilir; "TKGM Parsel Sorgu'da aç" linki verilir (parselsorgu.tkgm.gov.tr). Ticari entegrasyon için TKGM'ye yazılı başvuru. |
| Sorumluluk reddi tek başına koruma sağlar mı? | — | Hayır; ama kullanım koşulları + her öneride yazarın kimliği + kaynak alanları + değişiklik logu (immutable) birlikte savunma sağlar. Kullanım koşullarını avukat yazmalı. |

### 4.3 Altın kural

> **Uygulama bir "ziraat danışmanı" değil, bir "defter ve iletişim kanalı"dır.**
> Bilgi üreten taraf her zaman ya **etiket** (ruhsat sahibinin onaylı metni), ya **yetkili kişi** (bayi mühendisi),
> ya **laboratuvar**dır. Uygulama yalnızca saklar, hesaplar (tarih farkı, birim dönüşümü), hatırlatır.

---

## 5. Veri modeli ve güvenlik kuralları

### 5.1 İlkeler

- **İlişkisel düşün:** her koleksiyon PostgreSQL'de bir tablo; dizi/harita yerine ayrı doküman; yabancı anahtar
  alanları açık (`farmerId`, `fieldId`, `seasonId`, `tenantId`). Alt koleksiyon yerine **kök koleksiyon + ID alanları**
  tercih edildi (rules ve sorgular kolay, Postgres'e 1:1 taşınır).
- **Çiftçi verisi tenant verisi değildir.** `farmers/*` ve altındaki her şey çiftçinindir; bayi okuma izni
  `farmerLinks` üzerinden ve izin kapsamıyla verilir.
- **Paylaşımı her dokümana denormalize et:** rules içinde her okumada `get()` çağırmak hem okuma kotası harcar hem
  `list` sorgularında kısıtlıdır. Bu yüzden çiftçi dokümanlarında `sharedTenantIds: string[]` alanı tutulur
  (izin verilen bayilerin listesi, izin türüne göre ayrı alanlar). İzin değişince ilgili dokümanlar toplu güncellenir
  (çiftçi başına birkaç yüz doküman, sorun değil).
- Tarihler: Firestore'da `Timestamp`, modelde `Date` (`TASKS.md` 6.3 ile uyumlu). Para: kuruş olarak `number` (tam sayı) veya 2 hane yuvarlama.

### 5.2 Koleksiyonlar

```
users/{uid}                         (auth ajanının modeli + ek alanlar)
  accountType: 'business' | 'farmer'
  tenantId: string | null           (farmer → null)
  role: 'admin'|'cashier'|'staff'|null
  farmerId: string | null           (farmer → bağlı çiftçi profili)
  canPrescribe: boolean             (bayi mühendisi)
  prescriberLicenseNo: string|null

farmers/{farmerId}                  ↔ PG: farmer
  ownerUids: string[]               (PIN sıfırlama sonrası yeni uid eklenir, eski çıkarılır; normalde 1)
  displayName, phone (E.164), city, district, village
  cksNo: string|null
  language: 'tr'|'en'
  createdAt, updatedAt

farmerInvites/{code}                ↔ PG: farmer_invite
  tenantId, customerId, phoneLast4
  farmerId: string|null             (mevcut çiftçiye yeni cihaz/uid bağlamak için)
  expiresAt, used: boolean, usedBy: uid|null, createdBy, createdAt

farmerLinks/{tenantId}_{farmerId}   ↔ PG: farmer_tenant_link (PK: tenant_id, farmer_id)
  tenantId, farmerId, customerId, inviteCode   (kuralda davet doğrulaması için)
  status: 'active'|'revoked'
  consent: { purchases: true, fields: bool, logs: bool, notifications: bool,
             textVersion: 'v1', grantedAt, updatedAt }
  balanceSnapshot: number            (POS veresiye yazarken günceller → çiftçi tek okumayla borcunu görür)
  nextDueDate: Timestamp|null
  tenantName (denormalize, bayi adı)
  createdAt

fields/{fieldId}                    ↔ PG: field
  farmerId, name, areaDecare: number
  city, district, village, ada: string|null, parsel: string|null
  location: { lat, lng } | null      (tek nokta; poligon v3)
  irrigation: 'irrigated'|'dry'
  sharedTenantIds: string[]          (consent.fields == true olan bayiler)
  isActive, createdAt, updatedAt

seasons/{seasonId}                  ↔ PG: season (bir tarlada bir ürün dönemi)
  farmerId, fieldId, crop: string (kod: 'wheat','maize','tomato'… sabit liste), variety
  sowingDate, expectedHarvestDate, harvestDate|null, harvestQtyKg|null, harvestPricePerKg|null
  status: 'planned'|'active'|'harvested'
  sharedTenantIds: string[]

purchases/{purchaseId}              ↔ PG: farmer_purchase (bayi yazar, çiftçi okur)
  farmerId, tenantId, saleId, saleItemIndex
  productId, productName, category, quantity, unit, unitPrice, totalPrice
  gtsNo: string|null, batchExpiry: Timestamp|null
  requiresPrescription: boolean, prescriptionNo: string|null
  purchasedAt
  remainingQty: number               (çiftçi uygulama kaydı girdikçe düşer — "ambar")

applicationLogs/{logId}             ↔ PG: application_log (çiftçi yazar)
  farmerId, fieldId, seasonId
  type: 'pesticide'|'fertilizer'|'irrigation'|'tillage'|'sowing'|'other'
  date, purchaseId|null, productName, quantity, unit, dosePerDecare|null, areaDecare
  appliedBy: string, notes
  phiDays: number|null, phiSource: 'label'|'manual'|null, earliestHarvestDate: Timestamp|null
  recommendationId: string|null
  sharedTenantIds: string[]
  createdAt, updatedAt

recommendations/{recId}  (v2)       ↔ PG: recommendation (bayi mühendisi yazar, değiştirilemez)
  tenantId, farmerId, fieldId|null, seasonId|null
  target: string (zararlı/hastalık/besin eksikliği)
  items: [{ productId, productName, dose, doseUnit, phiDays, requiresPrescription }]
           (PG'de recommendation_item tablosu)
  prescriptionNo: string|null        (requiresPrescription varsa zorunlu — rules ile)
  windowStart, windowEnd, notes
  authorUid, authorName, authorLicenseNo
  status: 'active'|'withdrawn'       (geri çekme yeni bir doküman/alan; içerik güncellenmez)
  createdAt

productLabelUses/{id}  (MVP M7)     ↔ PG: product_label_use (bayi ürün kartına ekler)
  tenantId, productId, crop, target|null, dose, doseUnit, phiDays, source: 'label'|'bku', note

preOrders/{id}  (v2)                ↔ PG: pre_order
  farmerId, tenantId, items[{ description, qty, unit }], neededBy, status, category: 'fertilizer'|'seed'|'other'

costEntries/{id} (v2)               ↔ PG: cost_entry
  farmerId, seasonId, type: 'fuel'|'labor'|'water'|'rent'|'other', amount, date, note

soilAnalyses/{id} (v3)              ↔ PG: soil_analysis
  farmerId, fieldId, lab, sampledAt, ph, ec, lime, organicMatter, n, p, k, texture, extras{}, fileUrl
```

Bayi tarafı ekleri: `customers/{id}.farmerId: string|null`, `products/{id}.requiresPrescription: boolean`.

### 5.3 Kural yaklaşımı (taslak)

```
function signedIn()      { return request.auth != null; }
function me()            { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
function isFarmerOf(fid) { return signedIn() && request.auth.uid in get(/databases/$(database)/documents/farmers/$(fid)).data.ownerUids; }
function isStaffOf(tid)  { let u = me(); return u.accountType == 'business' && u.tenantId == tid && u.isActive == true; }
function myTenant()      { return me().tenantId; }

match /fields/{id} {
  allow read:   if isFarmerOf(resource.data.farmerId)
               || (me().accountType == 'business' && myTenant() in resource.data.sharedTenantIds);
  allow create: if isFarmerOf(request.resource.data.farmerId) && validField(request.resource.data);
  allow update: if isFarmerOf(resource.data.farmerId)
               && request.resource.data.farmerId == resource.data.farmerId;      // sahiplik devredilemez
  allow delete: if isFarmerOf(resource.data.farmerId);
}

match /purchases/{id} {
  // bayi yazar: sadece aktif bağlantısı olan çiftçiye, kendi tenantId'siyle
  allow create: if isStaffOf(request.resource.data.tenantId)
    && get(/databases/$(database)/documents/farmerLinks/$(request.resource.data.tenantId + '_' + request.resource.data.farmerId)).data.status == 'active';
  allow read:   if isFarmerOf(resource.data.farmerId) || isStaffOf(resource.data.tenantId);
  // çiftçi sadece remainingQty'yi düşürebilir
  allow update: if isFarmerOf(resource.data.farmerId)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['remainingQty'])
    && request.resource.data.remainingQty >= 0;
}

match /farmerInvites/{code} {
  allow create: if isStaffOf(request.resource.data.tenantId) && request.resource.data.used == false;
  allow get:    if signedIn();                      // kodu bilen okuyabilir; list YOK (kod sızmasın)
  allow list:   if false;
  allow update: if signedIn() && resource.data.used == false && resource.data.expiresAt > request.time
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used','usedBy'])
    && request.resource.data.used == true && request.resource.data.usedBy == request.auth.uid
    // aynı batch'te link oluşturulduğunu doğrula:
    && existsAfter(/databases/$(database)/documents/farmerLinks/$(resource.data.tenantId + '_' + getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.farmerId));
}

match /farmerLinks/{id} {
  allow read:   if isStaffOf(resource.data.tenantId) || isFarmerOf(resource.data.farmerId);
  allow create: if isFarmerOf(request.resource.data.farmerId) && request.resource.data.status == 'active'
    && getAfter(/databases/$(database)/documents/farmerInvites/$(request.resource.data.inviteCode)).data.usedBy == request.auth.uid;
  // çiftçi: sadece consent ve status (revoke); bayi: sadece balanceSnapshot/nextDueDate/tenantName
  allow update: if (isFarmerOf(resource.data.farmerId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['consent','status']))
               || (isStaffOf(resource.data.tenantId) && resource.data.status == 'active'
                   && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['balanceSnapshot','nextDueDate','tenantName']));
}

match /recommendations/{id} {
  allow create: if isStaffOf(request.resource.data.tenantId) && me().canPrescribe == true
    && request.resource.data.authorUid == request.auth.uid
    && (!hasPrescriptionItem(request.resource.data) || request.resource.data.prescriptionNo is string);
  allow read:   if isStaffOf(resource.data.tenantId) || isFarmerOf(resource.data.farmerId);
  allow update: if isStaffOf(resource.data.tenantId)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);   // sadece geri çekme
  allow delete: if false;
}
```

Notlar:
- `users/{uid}` içindeki `accountType`, `tenantId`, `role`, `canPrescribe`, `farmerId` alanları **istemciden yazılamaz**
  olmalı; tek istisna: davet akışında `accountType == 'farmer' && tenantId == null && role == null && canPrescribe == false`
  ile yeni oluşturma. `canPrescribe` bayide sadece admin tarafından verilir.
- `me()` her kural değerlendirmesinde 1 doküman okuması sayılır (aynı istek içinde önbelleklenir). Kota hesabına dahil (§7.3).
- Rules emulator testleri (`TASKS.md` 3.18) **zorunlu kabul kriteri**: "çiftçi A, çiftçi B'nin tarlasını okuyamaz",
  "bayi X, izin verilmemiş tarlayı okuyamaz", "izin geri alınınca bayi okuyamaz", "kullanılmış davet tekrar kullanılamaz".
- PostgreSQL'de aynı mantık Row-Level Security politikalarına (`farmer_tenant_link` join'i ile) birebir çevrilir;
  `sharedTenantIds` denormalizasyonu orada gereksizleşir (view/join ile).

---

## 6. UI/UX — çiftçi tarafı

### 6.1 Tasarım ilkeleri

- **Mobil öncelikli, tek el:** alt navigasyon 4 sekme, ana butonlar ≥ 56 px yükseklik, yazı ≥ 18 px, yüksek kontrast
  (güneş altında okunur — cam efekti çiftçi tarafında **yok**, düz ve kontrastlı).
- **Düşük okuryazarlık:** her eylemde ikon + kısa kelime; ürün tipleri renk + ikonla (ilaç = kırmızı damla, gübre = mavi çuval,
  tohum = yeşil filiz, sulama = su damlası). Rakamlar büyük, birimler kelimeyle ("dekar", "çuval", "litre").
- **Sesli:** v1'de her kartta 🔊 değil, "Oku" butonu (Web Speech API `speechSynthesis`, tr-TR ses cihazda varsa);
  v3'te sesle kayıt. Ses yoksa buton gizlenir.
- **Az yazma:** tarih seçimi "Bugün / Dün / Takvim"; ürün seçimi ambardan liste; doz için önceki değer önerilir.
- **Offline:** tarlada çekim yok. Firestore persistent cache + yazmalar kuyruklanır; ekranda "Gönderilmeyi bekliyor ⏳" rozeti.
- **Dil:** sade Türkçe ("hasat aralığı" yanında "ilaçtan sonra kaç gün beklemelisin"). i18n anahtarları `farmer.*` altında.

### 6.2 Ekran listesi

| Ekran | Rota | MVP |
|---|---|---|
| Davet / karşılama | `/ciftci/davet/:code` | ✔ |
| Giriş (telefon + PIN) | `/ciftci/giris` | ✔ |
| İzinler (KVKK) | `/ciftci/izinler` | ✔ |
| Ana sayfa (bugün) | `/ciftci` | ✔ |
| Tarlalarım / tarla detay / tarla formu | `/ciftci/tarlalar`, `/ciftci/tarlalar/:id`, `.../yeni` | ✔ |
| Sezon formu | `/ciftci/tarlalar/:id/sezon/yeni` | ✔ |
| Uygulama kaydı formu | `/ciftci/kayit/yeni` | ✔ |
| Defter (tüm kayıtlar) | `/ciftci/defter` | ✔ |
| Ambarım | `/ciftci/ambar` | ✔ |
| Borcum (bayi listesi → hareketler) | `/ciftci/borc`, `/ciftci/borc/:tenantId` | ✔ |
| Ayarlar / bayilerim / izinleri yönet / çıkış | `/ciftci/ayarlar` | ✔ |
| Öneriler | `/ciftci/oneriler` | v2 |
| Hava | `/ciftci/hava` | v2 |
| Ön talep | `/ciftci/talep` | v2 |
| Maliyet | `/ciftci/maliyet` | v2 |
| Toprak analizi / gübre hesap | `/ciftci/toprak` | v3 |

Alt nav: **🏠 Ana · 🌾 Tarlalar · ➕ Kayıt (ortada büyük) · 💰 Borcum**. Ambar ve ayarlar ana sayfadan/üst menüden.

### 6.3 Wireframe tarifleri

**Ana sayfa**
```
┌─────────────────────────────┐
│ Merhaba Ahmet Bey     ⚙️    │
├─────────────────────────────┤
│ ⚠️  Kuzey Tarla (domates)   │  ← PHI uyarısı varsa en üstte, kırmızı
│ Hasat en erken 12 Kasım     │
│ (ilaç: X, 7 gün bekleme)    │
├─────────────────────────────┤
│ 🌤  Yarın sabah rüzgar az   │  ← v2: hava şeridi
│ ▓▓▓░░▓▓▓▓░░  06—18          │
├─────────────────────────────┤
│ 💰 Borcunuz                 │
│ Yıldız Tarım     4.250 ₺    │
│ Vade: 15 Kasım          ›   │
├─────────────────────────────┤
│ 🌾 Tarlalarım (3)       ›   │
│ 📦 Ambarım (5 ürün)     ›   │
├─────────────────────────────┤
│        [ ➕ KAYIT EKLE ]     │  ← 64px, tam genişlik
├─────────────────────────────┤
│ 🏠    🌾    ➕    💰         │
└─────────────────────────────┘
```

**Kayıt ekle (3 adım, her adım tek ekran)**
```
Adım 1: Ne yaptınız?            Adım 2: Nereye, ne zaman?      Adım 3: Ne kadar?
┌──────────┬──────────┐         ┌─────────────────────────┐    ┌─────────────────────────┐
│ 💧 İLAÇ  │ 🧴 GÜBRE │         │ Tarla: [Kuzey Tarla ▾]  │    │ Ürün (ambarınızdan):    │
├──────────┼──────────┤         │ Tarih:                  │    │ ○ X ilaç  (2 lt kaldı)  │
│ 🚿 SULAMA│ 🚜 ÇAPA  │         │ [Bugün][Dün][📅]        │    │ ○ Başka ürün (yaz)      │
├──────────┼──────────┤         │ Alan: [ 12 ] dekar      │    │ Miktar: [ 1,5 ] litre   │
│ 🌱 EKİM  │ ✏️ DİĞER │         │ (tarlanın tamamı)       │    │ = 125 ml / dekar        │
└──────────┴──────────┘         └─────────────────────────┘    │ ─────────────────────── │
                                                                │ ⏳ Bu ilaçtan sonra     │
                                                                │ 7 gün hasat yapmayın    │
                                                                │ En erken: 12 Kasım      │
                                                                │ (etiket bilgisi)        │
                                                                │ ⓘ Resmi ÜKD'ye 3 gün    │
                                                                │   içinde girmeyi unutma │
                                                                │      [ KAYDET ]         │
                                                                └─────────────────────────┘
```

**Tarla detay**
```
┌─────────────────────────────┐
│ ‹  Kuzey Tarla        ✏️    │
│ 12 dekar · Sulu · Ada 104/7 │
│ [📍 Haritada] [TKGM'de aç]  │
├─────────────────────────────┤
│ 🍅 Domates 2026 (aktif)     │
│ Ekim: 10 Mayıs · Hasat: Eyl │
├─────────────────────────────┤
│ Son kayıtlar                │
│ 💧 20 Eki  X ilaç  1,5 lt   │
│ 🧴 02 Eki  20.20.0  2 çuval │
│ 🚿 28 Eyl  sulama           │
│        [ tümü › ]           │
├─────────────────────────────┤
│ 📋 Bayinizin önerileri (v2) │
└─────────────────────────────┘
```

**Bayi tarafı — müşteri detayında "Çiftçi" sekmesi**
```
┌────────────────────────────────────────────────┐
│ Ahmet Yılmaz  [📱 Uygulamada ✔]  İzinler: 🌾✔ 📒✔ │
├──────────────┬─────────────────────────────────┤
│ Tarlalar     │ Kuzey Tarla 12 da — Domates     │
│              │ Güney Tarla 30 da — Buğday      │
├──────────────┼─────────────────────────────────┤
│ Son kayıtlar │ 20 Eki X ilaç 1,5 lt (Kuzey)    │
├──────────────┼─────────────────────────────────┤
│ [ + Öneri yaz (sadece yetkili) ] [ Davet gönder ]│
└────────────────────────────────────────────────┘
```

---

## 7. Teknik plan

### 7.1 Yapı

```
src/app/features/farmer/                 (lazy, kendi layout'u)
  farmer.routes.ts                       (/ciftci/**, farmerGuard)
  layout/farmer-layout.component.ts      (alt nav, büyük butonlar, cam efekti yok)
  pages/ home, fields, field-detail, field-form, season-form, log-form, logbook,
         barn (ambar), debts, debt-detail, settings, consent, invite, login
  services/ farmer-auth.service.ts, field.repository.ts, season.repository.ts,
            application-log.repository.ts, purchase.repository.ts, farmer-link.repository.ts
  utils/ phi.util.ts (+ spec), dose.util.ts (+ spec), units.ts
src/app/features/customers/customer-detail/farmer-tab/   (bayi tarafı)
src/app/core/auth/guards/farmer.guard.ts, business.guard.ts
src/app/shared/models/farmer.model.ts, field.model.ts, season.model.ts, application-log.model.ts, farmer-purchase.model.ts, recommendation.model.ts
```

- `app.routes.ts`: mevcut `''` kabuğuna `businessGuard`, yeni `ciftci` kabuğuna `farmerGuard`. Girişten sonra
  `accountType`'a göre yönlendirme. Çiftçi bundle'ı ayrı lazy chunk → bayi uygulamasını şişirmez.
- **Repository katmanı (`TASKS.md` 6.1) ile yazılmalı:** çiftçi modülü sıfırdan yazıldığı için baştan
  `inject(Firestore)` sayfalarda olmamalı; PostgreSQL geçişinde en kolay taşınan parça olur.
- **Satış → ambar:** `sale.service.ts` içinde satış batch'ine, müşterinin `farmerId`'si varsa her kalem için
  `purchases` dokümanı eklenir (aynı batch, atomik). Veresiye yazılınca `farmerLinks.balanceSnapshot` `increment()` ile güncellenir.
- **PWA:** `@angular/service-worker` (ng add @angular/pwa), manifest'te `start_url: /ciftci`, ayrı ikon/isim
  ("Tarım Market Çiftçi"). Firebase Hosting'e deploy (`firebase.json` `hosting` bölümü, SPA rewrite).
- **Bildirim (v2):** FCM web push ücretsiz; ama **gönderen tarafı** (sunucu) Spark'ta Cloud Functions olmadan yok.
  MVP/v2'de bildirimler **istemci tarafı yerel hatırlatma** (uygulama açılınca hesaplanan uyarılar + PWA/Android yerel
  bildirim — Tauri `notification` plugin'i projede zaten var). Sunucu tetikli push, kendi sunucuya geçince.

### 7.2 Ayrı Tauri/Android uygulaması mı?

- **MVP: Hayır.** PWA. Çiftçinin cihazına APK yükletmek (bilinmeyen kaynak izni) güven ve destek sorunu yaratır.
- **v2:** Aynı Angular build'den ikinci Tauri config'i (`tauri.farmer.conf.json`, ayrı `identifier` ör. `com.tarimmarket.ciftci`,
  başlangıç URL'i `/ciftci`) veya TWA (Trusted Web Activity) ile Play Store. Bayi APK'sının imzalama/CI işi (`TASKS.md` 3.19)
  önce bitmeli.

### 7.3 Spark plan limitleri ve kapasite tahmini

Spark (proje genelinde, günlük): **50.000 okuma, 20.000 yazma, 20.000 silme**, 1 GiB depolama, 10 GiB/ay çıkış;
Hosting 10 GB depolama + **360 MB/gün** transfer; SMS ve Cloud Functions yok; FCM ücretsiz
([firebase.google.com/pricing](https://firebase.google.com/pricing)).
**Kota proje düzeyinde** — yani tüm bayiler ve tüm çiftçiler aynı 50 bin okumayı paylaşır. Bu çiftçi modülünden
bağımsız olarak SaaS için en büyük darboğaz.

Varsayımlar (persistent cache açık, listeler `limit`'li, aynı oturumda önbellekten okuma):

| Kullanıcı | Günlük okuma | Günlük yazma |
|---|---|---|
| Aktif bayi (1–2 kasa, `onSnapshot` dinleyicileri, `TASKS.md` 3.1–3.2 düzeltilmiş halde) | ~2.000–4.000 | ~200–500 |
| Aktif çiftçi oturumu (ana sayfa + 1–2 ekran; kural `get()`'leri dahil) | ~40–80 | ~2–5 |
| Pasif çiftçi (o gün açmadı) | 0 | ~1 (bayi satışı → ambar) |

Hesap: 10 aktif bayi × 3.000 = 30.000 okuma → çiftçilere ~20.000 kalır → **~250–400 günlük aktif çiftçi**.
Çiftçilerin günlük aktiflik oranı sezonda ~%25–35 → **~800–1.200 kayıtlı çiftçi** (10 bayi ile) Spark'ta sığar.
Bayi sayısı arttıkça bu hızla düşer: 15 bayi civarında bayi tarafı tek başına kotayı zorlar.
Yazma (20 bin) ve depolama (çiftçi başına ~50–200 KB → 1 GiB'da ~5.000+ çiftçi) darboğaz değil.
Hosting: çiftçi bundle'ı ~150–250 KB gz hedeflenirse, service worker sonrası tekrar indirme yok → günde ~1.000+ ilk yükleme sığar.

**Kota koruma önlemleri (MVP'de zorunlu):**
- Çiftçi ekranlarında `onSnapshot` yerine **tek seferlik `getDocs`** + çek-yenile (ana sayfa hariç).
- Ana sayfa özetini tek dokümandan okumak için `farmerLinks.balanceSnapshot` gibi denormalize alanlar.
- Hava durumu **Firestore'a yazılmaz**, istemcide 1 saat önbellek (localStorage).
- `firebase` konsolunda kullanım uyarısı; kota aşılınca Firestore o gün için hata döner → uygulama "Sunucu yoğun, kayıtlarınız
  telefonda saklandı" mesajı vermeli (persistent cache sayesinde yazmalar ertesi gün gider).
- Pratik eşik: **~10 bayi / ~500 aktif çiftçi** aşıldığında ya Blaze (ödeme kartı + bütçe uyarısı; bu ölçekte aylık maliyet düşük)
  ya kendi sunucu. `TASKS.md` 6.x hazırlığı bu yüzden çiftçi modülünden **önce** veya birlikte yapılmalı.

### 7.4 Dış servisler

| İhtiyaç | Seçim | Not |
|---|---|---|
| Hava tahmini | **MET Norway Locationforecast** (`api.met.no`) | Veri CC BY 4.0 (ticari kullanıma izin verir, atıf zorunlu), kimliklendirici User-Agent (tarayıcıda Origin/Referer yeterli), yanıtları önbellekle, `Expires`'tan önce tekrar sorma; 20 istek/sn üstü özel anlaşma ([kullanım koşulları](https://api.met.no/doc/TermsOfService)). |
| (alternatif) | Open-Meteo | Ücretsiz katman **ticari kullanıma kapalı** (<10.000 çağrı/gün, CC BY 4.0) ([terms](https://open-meteo.com/en/terms)). Bayi ücret ödediği için ücretsiz katman uygun değil; ücretli plan veya kendi sunucuda self-host (açık kaynak) seçenek. |
| Harita | Leaflet + OSM karoları (sadece pin koyma ekranında, düşük hacim) | OSM tile politikası yoğun kullanımı yasaklar; ölçekte ücretli karo sağlayıcı. Tarla listesinde harita yok, sadece "Haritada aç" (geo: URI → telefonun harita uygulaması). |
| Parsel | TKGM Parsel Sorgu'ya **link** | Otomatik sorgu yok; koşullar doğrulanamadı. |
| İlaç etiket/PHI | Bayinin ürün kartına girdiği `productLabelUses` + BKÜ Veri Tabanı **linki** | [bku.tarimorman.gov.tr](https://bku.tarimorman.gov.tr/) — API/açık veri yok. |
| ÇKS | Yalnızca numara alanı | e-Devlet entegrasyonu yok ([ÇKS hakkında](https://tarimorman.gov.tr/Haber/6127/Ciftci-Kayit-Sistemine-Basvurular-2-Ocak-2024-Tarihinde-Sona-Erecek)). |

**İlaçlama uygunluğu eşikleri (varsayılan, ayarlanabilir, etiket her zaman önceliklidir):** rüzgar ≤ 10 km/s "uygun",
10–15 "dikkat", > 15 "uygun değil"; önümüzdeki 6 saatte yağış > 0,5 mm "dikkat"; sıcaklık > 28 °C "dikkat";
tamamen durgun hava (< 2 km/s, sabah erken inversiyon) "dikkat". Bu eşikler genel iyi uygulama değerleridir; bayi
mühendisi bölgeye göre değiştirebilmeli ve metin "karar sizin, etiketi okuyun" demeli.

### 7.5 Benzer uygulamalar (Türkiye) ve alınacak dersler

| Uygulama | Ne yapıyor | Ders |
|---|---|---|
| Şekerbank **Hasat Mobil** | Uydu ile tarla sağlığı, hava/afet uyarısı, tarla yönetimi; ücretsiz ([kaynak](https://www.capital.com.tr/sirket-panosu/sirket-panosu-haberleri/ciftciler-icin-hasat-mobil-uygulamasi-baslatti)) | Hava/afet uyarısı çiftçinin en çok açtığı özellik. |
| **Ziraat Çiftçi Platformu** | Girdi satış noktaları haritası, tarımsal kredi başvurusu; ücretsiz ([kaynak](https://www.ziraatbank.com.tr/tr/sss/diger/ziraat-ciftci-platformu)) | Finansman/borç çiftçi için merkezi konu → "Borcum" MVP'de. |
| **Toros Çiftçi** (Toros Tarım) | Tarla koordinatı, hava ve toprak analizine dayalı gübreleme önerisi; 2016'dan beri ücretsiz ([kaynak](https://www.capital.com.tr/sirket-panosu/sirket-panosu-haberleri/toros-tarim-ciftci-uygulamasi-ile-ureticiye-katki-sunuyor)) | Gübre önerisini **üretici firma** veriyor (kendi ürünü, kendi sorumluluğu). Bayinin buna rakip olması gereksiz; hesaplayıcı yeter. |
| **İmeceMobil** (İş Bankası grubu) | Tarla/bahçe kaydı, hava, hal fiyatları, uydu, mühendise soru ([kaynak](https://webrazzi.com/2023/03/24/turkiye-is-bankasi-grubu-tarim-teknolojisi-imecemobil-tarim-platformu-elektronik-hizmetler-ticaret-anonim-sirketi/)) | "Mühendise sor" modeli → bizde "bayime sor / fotoğraf gönder" (v2). |
| **Tarfin** | Girdi fiyat karşılaştırma ve vadeli girdi finansmanı; 2022'de 260 bin çiftçi ([kaynak](https://paradergi.com.tr/is-dunyasi-kulis/2022/04/21/260-bin-ciftciyi-dijitale-tasidi)) | Çiftçi vadeli alımı çok önemsiyor → veresiye/vade görünürlüğü değerli. |
| **Doktar** (Orbit, Filiz sensör) | Uydu tarla takibi, sensör istasyonu, yapay zekâ ([kaynak](https://www.ekonomigazetesi.com/sektor-haberleri/tarimin-doktari-20-ulkede-tarlalarin-verimini-artiriyor-23472)) | Uydu/sensör pahalı ve uzmanlık işi; bizim alanımız değil. |
| **Agrovisio** | Uydudan ekili alan, rekolte, hasat tespiti; TürkTraktör yatırımı ([kaynak](https://webrazzi.com/2023/12/19/turktraktor-agrovisio-4-milyon-euro-degerleme-ile-260-bin-euro-yatirim/)) | Aynı: ortaklık adayı, rakip değil. |
| TarlaNet | **Doğrulanamadı** (aramada bulunamadı). | — |
| Tarım Kredi | Çiftçiye yönelik bir saha uygulaması doğrulanamadı; bulunan "Toprak" uygulaması iç kullanım ([App Store](https://apps.apple.com/us/app/id6502436988)). | Kooperatif kanalında dijital boşluk olabilir. |

**Boşluk:** Hiçbiri "çiftçinin kendi yerel bayisiyle" (alışveriş geçmişi, veresiye, bayi mühendisinin önerisi) bağ kurmuyor.
Tarım Market Pro'nun avantajı tam bu: veri zaten bayide.

---

## 8. Önkoşullar ve sıralama

1. **Önce:** `TASKS.md` 1.x kritik hatalar, 2.34–2.41 güvenlik, 5.1 tenant modeli (auth ajanı), 3.18 rules emulator testi.
   Çiftçi = internetten gelen, güvenilmeyen yeni kullanıcı; mevcut zayıf kurallarla açılırsa tüm bayilerin verisi risk altında.
2. **Birlikte:** 6.1–6.3 repository katmanı (çiftçi modülü baştan bu katmanla yazılır).
3. **Hukuki ön kontrol (paralel, kod dışı):** KVKK aydınlatma + kullanım koşulları + md. 7 (internet tanıtım) yorumu için avukat;
   PHI/etiket akışı için bir bayi ziraat mühendisiyle 1 saatlik gözden geçirme.
4. **Pilot:** 1 bayi, 10–20 çiftçi, bir sezon (ör. ilkbahar ekimi). Ölçüt: çiftçilerin %50'si 4 hafta sonra hâlâ haftada ≥1 açıyor mu,
   bayinin veresiye tahsil süresi kısaldı mı.

---

## 9. Görev listesi — TASKS.md'ye kopyalanacak bölüm

> Aşağıdaki bölüm `TASKS.md` formatındadır (Dosyalar / Yapılacak / Kabul). Büyüklük: **S** ≤ 1 gün, **M** 2–3 gün, **L** 4–6 gün.
> MVP toplamı ≈ 22–30 iş günü (1 geliştirici), pilot dahil ~6 hafta.

---

## 8. 🌾 Çiftçi Modülü

> Tasarım ve gerekçe: `docs/CIFTCI-MODULU.md`. **Önkoşul:** 2.37, 2.38, 2.41 (App Check), 3.18 (rules testi), 5.1 (tenant modeli) bitmiş olmalı; 6.1 repository arayüzleriyle yazılır.
> Altın kural: uygulama **ilaç/doz önermez**; öneriyi yalnızca `canPrescribe` yetkili bayi personeli yazar. Çiftçi tarafında bitki koruma ürünü kataloğu/fiyatı/sipariş **yok** (BKÜ satış yönetmeliği md. 7).

### MVP

- [ ] **8.1 Modeller ve sabitler (S).**
  - **Dosyalar:** `src/app/shared/models/farmer.model.ts`, `field.model.ts`, `season.model.ts`, `application-log.model.ts`, `farmer-purchase.model.ts`, `farmer-link.model.ts`, `product-label-use.model.ts`; `src/app/features/farmer/utils/crops.ts` (ürün kodu → TR/EN ad + ikon), `units.ts`.
  - **Yapılacak:** `docs/CIFTCI-MODULU.md` §5.2'deki alanlar; `Timestamp` yerine `Date` (6.3 ile uyumlu). `customer.model.ts`'e `farmerId: string | null`, `product.model.ts`'e `requiresPrescription: boolean`.
  - **Kabul:** `ng build` yeşil; modellerde `any` yok; `farmerId` ile `uid` ayrı alanlar.

- [ ] **8.2 Firestore kuralları + indeksler + emulator testleri (L).**
  - **Dosyalar:** `firestore.rules`, `firestore.indexes.json`, `tests/rules/farmer.rules.spec.ts`.
  - **Yapılacak:** §5.3 taslağı. `users` alanlarının (`accountType`, `tenantId`, `role`, `canPrescribe`, `farmerId`) istemciden yazılamaması (davet akışındaki farmer oluşturma hariç). İndeksler: `fields (farmerId, isActive)`, `applicationLogs (farmerId, date desc)`, `applicationLogs (fieldId, date desc)`, `purchases (farmerId, purchasedAt desc)`, `purchases (tenantId, farmerId, purchasedAt desc)`, `seasons (fieldId, sowingDate desc)`.
  - **Kabul:** Emulator testleri geçer: çiftçi A ↔ B izolasyonu; bayi X izinsiz tarlayı okuyamaz; izin geri alınınca okuyamaz; farmer hesabı hiçbir tenant koleksiyonunu (`products`, `sales`, `customers`, `creditTransactions`) okuyamaz; kullanılmış/süresi geçmiş davet reddedilir; davet `list` edilemez; çiftçi `purchases`'ta sadece `remainingQty`'yi azaltabilir.

- [ ] **8.3 Davet akışı — bayi tarafı (M).**
  - **Dosyalar:** `src/app/features/customers/customer-detail/` (yeni "Çiftçi uygulaması" kartı), `src/app/features/customers/services/farmer-invite.service.ts`.
  - **Yapılacak:** "Davet et" → 10 karakterlik kriptografik rastgele kod (`crypto.getRandomValues`), 7 gün geçerli; QR (mevcut bağımlılıklarla veya hafif bir QR kütüphanesi) + "WhatsApp ile gönder" (`https://wa.me/<tel>?text=<encoded link>`). Bağlı çiftçide "Uygulamada ✔" rozeti ve izin özetini göster. "Yeni cihaz/PIN sıfırla" = mevcut `farmerId` ile yeni davet.
  - **Kabul:** Admin/kasiyer davet üretir; staff üretemez; aynı müşteri için aktif davet varsa yenisi eskisini geçersiz kılar.

- [ ] **8.4 Davet akışı — çiftçi tarafı, giriş, PIN (L).**
  - **Dosyalar:** `src/app/features/farmer/pages/invite/`, `pages/login/`, `pages/consent/`, `src/app/features/farmer/services/farmer-auth.service.ts`, `src/app/core/auth/guards/farmer.guard.ts`, `business.guard.ts`, `src/app/app.routes.ts`.
  - **Yapılacak:** `/ciftci/davet/:code` → telefon (son 4 hane eşleşmesi) + 6 haneli PIN (2 kez) → sentetik e-posta ile Auth hesabı → tek `writeBatch`: `users/{uid}`, `farmers/{id}` (yoksa), `farmerLinks/{tenantId}_{farmerId}`, davet `used`. İzin ekranı (§2.4, metin sürümü `v1`). `/ciftci/giris`: telefon + PIN. Girişte `accountType`'a göre `/ciftci` veya `/dashboard`. Mevcut bayi rotalarına `businessGuard`.
  - **Kabul:** Davetle açılan hesap sadece `/ciftci/**` görür; bayi hesabı `/ciftci`'ye giremez; aynı kod ikinci kez kullanılamaz; PIN sıfırlama davetiyle yeni uid eski `farmerId`'nin verisini görür, eski uid göremez.

- [ ] **8.5 Çiftçi layout ve ana sayfa (M).**
  - **Dosyalar:** `src/app/features/farmer/farmer.routes.ts`, `layout/farmer-layout.component.ts`, `pages/home/home.page.ts`, `src/app/core/i18n/translations.ts` (`farmer.*`).
  - **Yapılacak:** Alt nav (Ana · Tarlalar · ➕ Kayıt · Borcum), büyük butonlar (≥56px), ≥18px yazı, yüksek kontrast, açık/koyu tema. Ana sayfa kartları: PHI uyarıları, borç özeti (`farmerLinks.balanceSnapshot`), tarla/ambar sayaçları, büyük "Kayıt ekle". "Oku" (speechSynthesis, yoksa gizli).
  - **Kabul:** 360px genişlikte yatay kaydırma yok; Lighthouse erişilebilirlik ≥ 90; ana sayfa ≤ 10 doküman okuması (soğuk açılış).

- [ ] **8.6 Tarlalar ve sezonlar (M).**
  - **Dosyalar:** `pages/fields/`, `pages/field-detail/`, `pages/field-form/`, `pages/season-form/`, `services/field.repository.ts`, `services/season.repository.ts`.
  - **Yapılacak:** Tarla CRUD (ad, dekar, il/ilçe/köy, ada/parsel, sulu/kuru, konum: "Şu an buradayım" GPS veya haritada pin), "TKGM'de aç" ve "Haritada aç" linkleri. Sezon: ürün (sabit liste + ikon), çeşit, ekim/beklenen hasat tarihi, durum. İzin değişince `sharedTenantIds` toplu güncelleme yardımcı fonksiyonu.
  - **Kabul:** Offline'da tarla eklenir, çevrim içi olunca senkron olur ("bekliyor" rozeti); dekar > 0 doğrulaması; silinen tarla soft-delete (`isActive=false`).

- [ ] **8.7 Satış → çiftçi ambarı (M).**
  - **Dosyalar:** `src/app/features/pos/services/sale.service.ts`, `src/app/features/farmer/services/purchase.repository.ts`, `pages/barn/barn.page.ts`.
  - **Yapılacak:** Satış batch'inde müşterinin `farmerId`'si ve aktif link varsa her kalem için `purchases` dokümanı (gtsNo, SKT, `requiresPrescription`, `remainingQty = quantity`). Veresiye yazımında `farmerLinks.balanceSnapshot` `increment()`. Satış iptali (2.1) yapıldığında ilgili `purchases` da iptal edilir. Ambar ekranı: ürün tipine göre gruplu, kalan miktar, SKT yaklaşan uyarısı.
  - **Kabul:** Bağlı müşteriye satış → çiftçi ambarında 1 sn içinde (online) görünür; bağlı olmayan müşteride ek yazma yok; satış batch'i atomik kalır.

- [ ] **8.8 Uygulama defteri + PHI hesaplama (L).**
  - **Dosyalar:** `pages/log-form/`, `pages/logbook/`, `services/application-log.repository.ts`, `utils/phi.util.ts` + `phi.util.spec.ts`, `utils/dose.util.ts` + spec; bayi tarafı `src/app/features/products/product-detail/` → "Etiket kullanımları" (`productLabelUses`) bölümü (ayrı bileşen, `product-detail.page.ts`'yi büyütme).
  - **Yapılacak:** 3 adımlı kayıt (§6.3). Ambardan ürün seçilirse `remainingQty` düşer. PHI: `productLabelUses` içinde `(productId, crop)` eşleşmesi varsa `earliestHarvestDate = date + phiDays`; yoksa "etiketi kontrol edin" uyarısı ve hesap yok. Sezonun beklenen hasat tarihi PHI'dan önceyse kırmızı uyarı. Her ilaç kaydında "Resmî ÜKD'ye 3 gün içinde giriniz" bilgisi. Bayi tarafında etiket kullanımı girişi sadece `canPrescribe` veya admin.
  - **Kabul:** `phi.util` testleri: aynı ürün farklı bitkide farklı PHI; birden çok ilaçta en geç tarih esas alınır; PHI verisi yoksa `null`. Doz = miktar / alan doğru, birim dönüşümleri (ml↔lt, g↔kg) testli.

- [ ] **8.9 Borcum (S).**
  - **Dosyalar:** `pages/debts/`, `pages/debt-detail/`, `services/farmer-link.repository.ts`.
  - **Yapılacak:** Bayi başına bakiye (`balanceSnapshot`), vade; detayda son 20 `purchases` (veresiye olanlar). Hareket listesi için tenant `creditTransactions`'a çiftçi erişimi **MVP'de yok** (v2, kural+indeks ile).
  - **Kabul:** İki bayiye bağlı çiftçi iki ayrı bakiye görür; bayi A'nın verisi bayi B'ye görünmez.

- [ ] **8.10 Bayi tarafı: müşteri detayında çiftçi sekmesi (M).**
  - **Dosyalar:** `src/app/features/customers/customer-detail/farmer-tab/farmer-tab.component.ts`.
  - **Yapılacak:** İzin verilen kapsamda tarlalar, aktif sezonlar, son 10 uygulama kaydı; izin yoksa "Çiftçi bu bilgiyi paylaşmıyor". Okumalar `getDocs` (dinleyici yok).
  - **Kabul:** İzin geri alındığında sekme bir sonraki açılışta boş/uyarılı; staff rolü görmez (admin/cashier görür).

- [ ] **8.11 PWA + Hosting (M).**
  - **Dosyalar:** `ngsw-config.json`, `public/manifest.webmanifest` (veya çiftçi için ayrı manifest), `firebase.json` (`hosting`, SPA rewrite, cache header'ları), `angular.json`.
  - **Yapılacak:** `@angular/service-worker`; `start_url: /ciftci`; "Ana ekrana ekle" yönlendirmesi; çiftçi lazy chunk'ı ≤ 250 KB gz; Tauri build'ini bozmamak (service worker Tauri'de devre dışı).
  - **Kabul:** Android Chrome'da ana ekrana eklenir, uçak modunda açılır ve önceki veriyi gösterir; `ng build` + Tauri build yeşil.

- [ ] **8.12 KVKK metinleri ve izin yönetimi (S, + hukuk incelemesi).**
  - **Dosyalar:** `src/app/features/farmer/pages/consent/`, `pages/settings/`, `docs/legal/ciftci-aydinlatma-v1.md` (metin taslağı, avukat onayı bekler).
  - **Yapılacak:** İzinleri ayrı ayrı aç/kapa, bayiyle bağlantıyı kopar (`status=revoked`), hesabımı ve verilerimi sil talebi (MVP: talep kaydı + bayi/yönetici manuel işlem). Uygulama içinde "Bu kişisel defterinizdir, resmî ÜKD değildir" ve "Uygulama ilaç/doz önermez" metinleri.
  - **Kabul:** İzin kapatınca ilgili dokümanların `sharedTenantIds`'inden tenant çıkar (rules testi 8.2 ile doğrulanır); metin sürümü ve tarih kaydedilir.

- [ ] **8.13 Pilot ve ölçüm (S).**
  - **Yapılacak:** 1 bayi, 10–20 çiftçi. Firebase kullanım panelinde günlük okuma/yazma takibi; çiftçi başına ortalama okuma ölçülür ve `docs/CIFTCI-MODULU.md` §7.3 tahmini güncellenir.
  - **Kabul:** 4 hafta sonunda: haftalık aktif çiftçi oranı, günlük okuma/çiftçi, bayinin geri bildirimi raporlanmış.

### v2 (MVP pilotundan sonra)

- [ ] **8.14 Bayi mühendisi önerisi + e-reçete no (L).** `recommendations` koleksiyonu; sadece `canPrescribe`; reçeteli ürün içeriyorsa `prescriptionNo` zorunlu (rules); değiştirilemez, sadece geri çekilir; çiftçide "Bayinizin önerisi — Müh. Ad Soyad (yetki no)". Öneriden tek dokunuşla uygulama kaydı. **Kabul:** yetkisiz kullanıcı öneri yazamaz (rules testi); öneri içeriği güncellenemez.
- [ ] **8.15 Reçete görüntüleme (S).** Öneri/satış kalemine e-reçete no ve (Storage kotası doğrulanırsa) fotoğraf/PDF.
- [ ] **8.16 Hava durumu ve ilaçlama uygunluk şeridi (M).** MET Norway Locationforecast, istemci önbelleği 1 saat, CC BY 4.0 atfı, ayarlanabilir eşikler (§7.4). **Kabul:** aynı tarla için saatte en fazla 1 istek; atıf metni görünür; Firestore'a yazma yok.
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
