# Yerel Test Ortamı (Firebase Emulator)

Uygulamayı **canlı Firebase'e (stok-takip-2031b) hiç dokunmadan**, gerçekçi demo verisiyle denemek için.
Her şey bilgisayarınızda çalışır: Auth (giriş) ve Firestore (veritabanı) birer yerel taklittir (emulator).
Proje kimliği `demo-tarim-market`'tir; `demo-` önekli projeler Firebase'de gerçek bir kaynağa bağlanamaz.

## Gerekenler

- Node.js ve `npm install` yapılmış proje.
- Java: **kurmanıza gerek yok.** İlk `npm run emu` çalıştırmasında, `.tools/jre/` klasöründe yoksa
  Eclipse Temurin 21 JRE (~50 MB) otomatik indirilir (Windows x64). Bu klasör git'e girmez.

## Adım adım

İki ayrı terminal açın (proje klasöründe):

**Terminal 1: emulator'ler**

```bash
npm run emu
```

- "All emulators ready" yazınca hazırdır. Emulator arayüzü: http://127.0.0.1:4000
  (Authentication sekmesinde kullanıcılar, Firestore sekmesinde veriler görünür ve elle düzenlenebilir).
- Veri `.emulator-data/` klasöründen yüklenir. Bu pencerede **Ctrl+C** ile kapatınca o anki veri aynı klasöre
  kaydedilir; bir dahaki `npm run emu` aynı veriyle açılır.

**Terminal 2: demo verisi (ilk sefer ya da sıfırlamak için)**

```bash
npm run emu:seed      # emulator'deki HER ŞEYİ siler, demo verisini baştan yükler
npm run emu:export    # (isteğe bağlı) veriyi hemen .emulator-data/'ya kaydet
```

**Terminal 2: uygulama**

```bash
npm run dev:emu
```

Tarayıcıda http://localhost:4200 açın ve aşağıdaki hesaplardan biriyle girin. Emulator modunda olduğunuzu
Ayarlar → Profil'deki uygulama adından ("Tarım Market Pro (Test)") anlayabilirsiniz.

> **Yavaş açılış:** Bu makinede Firebase CLI ve `firebase-admin` modüllerinin yüklenmesi 1–2 dakika sürebiliyor
> (antivirüs `node_modules` taramasından). `npm run emu` "All emulators ready" yazana, `emu:seed` "Seed tamam"
> yazana kadar bekleyin. İlk çalıştırmada Emulator arayüzü (UI) ayrıca indirilir.

> Normal `npm start` / `ng serve` / production build'ler canlı Firebase'e bağlanmaya devam eder. Emulator'e
> yalnızca `--configuration emulator` (yani `npm run dev:emu`) bağlanır.

## Test hesapları

Tüm şifreler: **`Test1234!`** — e-postaların hepsi **doğrulanmış** (doğrulama ekranı çıkmaz).

| E-posta | Kim | Rol |
|---|---|---|
| `admin@test.local` | Mehmet Ağaoğlu — **Ağaoğlu Tarım** sahibi | admin |
| `kasiyer@test.local` | Ayşe Demir — Ağaoğlu Tarım | cashier |
| `personel@test.local` | Hasan Çelik — Ağaoğlu Tarım | staff |
| `admin2@test.local` | Zeynep Yıldız — **Yeşil Vadi Zirai** sahibi (ikinci bayi, izolasyon testi) | admin |
| `super@test.local` | Platform destek (superadmin, `platformAdmins/{uid}`) | — |
| `ciftci@test.local` | Ali Yılmaz — çiftçi hesabı (`accountType: 'farmer'`) | — |

Bekleyen bir personel daveti de vardır: `yeni.personel@test.local` (Ağaoğlu Tarım, kasiyer). Bu e-postayla
kayıt olup davetle katılım akışı denenebilir. Emulator e-posta göndermez; doğrulama bağlantısı
**Terminal 1**'in çıktısında ve Emulator arayüzünde görünür (bağlantıyı tarayıcıda açmak e-postayı doğrular).

## Demo verisi (Ağaoğlu Tarım)

- **40 ürün:** gübre (çuval, dökme kg/lt), zirai ilaç (e-reçeteli, ruhsat no, etken madde, GTS'li partiler),
  tohum (paket ve dökme kg), fide (bir kısmı barkodsuz), sulama (metre), hırdavat.
  - Bazıları **kritik stokta** (CAN gübre, Azoxystrobin, Mısır tohumu, Çilek fidesi, Gübre tankı),
  - bazılarının **SKT'si 30 gün içinde** doluyor, ikisinde **SKT'si geçmiş parti** var.
  - Her ürünün stoğu = partilerinin toplamı (FEFO / GTS seçimi denenebilir).
- **15 müşteri** (Alaşehir/Sarıgöl/Salihli köyleri), çoğunda veresiye bakiyesi.
- **Son 60 güne yayılmış ~150 satış:** nakit, kart, veresiye, karışık (nakit + veresiye); bazılarında kalem
  ve genel indirim, birkaçında vade farkı (taksit), reçeteli satışlarda e-reçete no. **2 iptal edilmiş satış**
  (biri veresiye → ters kayıt `isReversal`). Tüm kalemlerde `costPrice` var (kâr raporu çalışır).
- Her satışa uygun **stok hareketleri** (açılış stoğu, mal alımı, satış, iptal iadesi, sayım farkı;
  `previousStock/newStock` zinciri tutarlı) ve **veresiye defteri** (koşan bakiye; müşteri bakiyesi =
  borçlar − tahsilatlar).
- **Tahsilatlar** (nakit/kart, kısmi ve tam), **10 gider**, **5 tedarikçi**.
- İşletme bilgileri (adres, telefon, vergi dairesi/no, fiş alt yazısı), lisans: `pro`.

**Yeşil Vadi Zirai:** 5 ürün, 3 müşteri, birkaç satış, deneme lisansı (10 gün kaldı).
admin2 ile girildiğinde Ağaoğlu verisinin hiçbiri görünmemelidir.

**Çiftçi:** `farmers/farmer-ali-yilmaz`, Ağaoğlu Tarım'a bağlantı (`farmerLinks`, müşteri "Ali Yılmaz"
kartında `farmerId`), bir tarla (`fields`). Alan adları `docs/CIFTCI-MODULU.md` §5.2'ye göre.

Veri sabit tohumla üretilir: her `emu:seed` aynı içeriği üretir, tarihler bugüne göre kayar.

## Firestore kural testleri

```bash
npm run test:rules
```

- `tests/rules/*.spec.ts` dosyalarını (vitest + `@firebase/rules-unit-testing`) ayrı bir Firestore
  emulator'ünde (port 8180) çalıştırır; `npm run emu` açıkken de çalışır, demo verisine dokunmaz.
- Kapsam: tenant izolasyonu, kullanıcının rol/tenantId değiştirememesi, defterlerin (creditTransactions,
  stockMovements) değiştirilememesi, negatif tutar reddi ve `isReversal` istisnası, davetle katılım.
- Kurallar her testte doğrudan `firestore.rules` dosyasından okunur. "Did not find a Cloud Firestore rules
  file" uyarısı normaldir (kuralları test kütüphanesi yükler).
- Yeni test: `tests/rules/helpers.ts`'deki `createEnv`, `seed`, `as` yardımcılarını kullanın.

## Eski (canlı) kurallarla uyumluluk testi

Yeni `firestore.rules` canlıya deploy edilmeden önce, uygulamanın **canlıdaki eski kurallarla** (users dışında
`tenants`, `platformAdmins`, `invites`, `auditLogs` yok) çalıştığını doğrulamak için (30.10.2026'da yapıldı):

1. `git show <eski-commit>:firestore.rules > <geçici>/old.rules` ve aynı klasöre bir `firebase.legacy.json`:
   `{"firestore":{"rules":"old.rules"},"emulators":{"singleProjectMode":true,"hub":{"port":4520},"logging":{"port":4521},"auth":{"port":9299},"firestore":{"port":8280,"websocketPort":9260},"ui":{"enabled":false}}}`
   (4410/4510/8180/9160 kural testlerinde, 8080/9099/4400/4500 ana emulator'de kullanılıyor).
2. `node scripts/emulator/firebase.mjs emulators:start --only auth,firestore --project demo-tarim-legacy --config <geçici>/firebase.legacy.json`
3. Eski şema kullanıcıları firebase-admin ile seed edin (`users/{uid}` dokümanı olmayan, `isActive` alanı olmayan,
   `tenantId` alanı olmayan, e-postası doğrulanmamış hesaplar).
4. `src/environments/environment.legacy-test.ts` (git dışı; `environment.emulator.ts` kopyası, `projectId: 'demo-tarim-legacy'`,
   `emulators: { authPort: 9299, firestorePort: 8280, persistentCache: true }`) + angular.json'a geçici `legacy-test`
   build/serve konfigürasyonu; `ng serve --configuration legacy-test --port 4300`. `persistentCache: true` canlıdaki
   IndexedDB önbelleğini taklit eder. İş bitince ortam dosyasını ve konfigürasyonu silin.

`app.config.ts` emulator portlarını `environment.emulators.authPort/firestorePort` alanlarından okur.

## E-posta doğrulaması bayrağı

`environment.requireEmailVerification` (varsayılan `true`). `false` yapılırsa e-postası doğrulanmamış (eski) hesaplar
doğrulama ekranına takılmadan girer (`authGuard` + giriş sonrası yönlendirme). Davetle katılım her durumda doğrulama ister
(kurallar `email_verified` şartı arar). Doğrulama ekranındaki "Tekrar Gönder" ile e-posta yeniden gönderilebilir.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `Port 8080 is not open` / `port taken` | Önceki emulator kapanmamış. Görev yöneticisinden `java.exe`'yi kapatın ya da `netstat -ano \| findstr :8080`. |
| Seed: "emulator'üne ulaşılamadı" | Önce Terminal 1'de `npm run emu`. |
| Giriş: "profil okunamadı" | Seed çalıştırılmamış ya da emulator sıfırlanmış: `npm run emu:seed`. |
| Giriş: "sunucuya şu an ulaşılamıyor… Tekrar dene" | Profil ~15 sn boyunca okunamadı (çevrimdışı). Oturum açık kalır; bağlantı gelince otomatik ya da "Tekrar dene" ile yüklenir. |
| Eski veri görünüyor | `npm run emu:seed` (her şeyi siler ve yeniden yükler). Tamamen sıfırlamak için `.emulator-data/` klasörünü silin. |
| JRE indirilemiyor | https://adoptium.net adresinden Temurin 21 JRE (Windows x64 zip) indirip `.tools/jre/` altına açın (`.tools/jre/bin/java.exe` olmalı). |

## Dosyalar

- `firebase.json` → `emulators` bloğu (auth 9099, firestore 8080, ui 4000, hub 4400, logging 4500).
- `scripts/emulator/firebase.mjs` → Firebase CLI'yi proje içi JRE ile çalıştırır; `--project demo-*` zorunlu.
- `scripts/emulator/seed.mjs` → demo verisi (yalnız `demo-*` proje ve 127.0.0.1 emulator'e yazar).
- `scripts/emulator/firebase.rules-test.json` → kural testleri için ayrı portlu emulator yapılandırması.
- `src/environments/environment.emulator.ts` + `angular.json` `emulator` konfigürasyonu;
  `src/app/app.config.ts` `useEmulators` ise `connectAuthEmulator` / `connectFirestoreEmulator`
  (emulator modunda Firestore bellek önbelleği kullanır: çevrimdışı kalıcılık bu modda test edilemez).
- `tests/rules/**`, `vitest.rules.config.ts` → kural testleri.
