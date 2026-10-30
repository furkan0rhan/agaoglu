# Superadmin, destek modu ve lisans yönetimi

Yazılımı satan firmanın (platform sahibi) müşterilere destek verebilmesi ve lisansları yönetebilmesi için.
Spark (ücretsiz) plan uyumludur: Cloud Functions / custom claims kullanılmaz; yetki Firestore kurallarındaki
`platformAdmins/{uid}` kontrolüyle verilir.

## 1. Superadmin nasıl eklenir (yalnız Firebase Console)

`platformAdmins` koleksiyonuna istemciden **yazılamaz** (kurallar: create/update/delete `false`).
Bu yüzden kimse uygulama üzerinden kendini superadmin yapamaz.

1. Superadmin olacak kişi uygulamaya normal şekilde **kayıt olur** (veya Console → Authentication → *Add user*).
   - Not: Uygulamadan kayıt olursa kendisine bir deneme işletmesi açılır; sorun değildir. İşletmesi olmasın
     isteniyorsa hesabı Console → Authentication'dan ekleyin (users dokümanı olmaz, işletme oluşturulmaz).
2. Console → **Authentication → Users** → kişinin **User UID** değerini kopyalayın.
3. Console → **Firestore Database → Data** → *Start collection* → koleksiyon kimliği: `platformAdmins`.
4. Doküman kimliği: **kopyaladığınız UID** (otomatik ID değil!). Alanlar (isteğe bağlı, bilgi amaçlı):
   - `email` (string): kişinin e-postası
   - `note` (string): ör. "Destek ekibi — Ahmet"
   - `createdAt` (timestamp)
5. Kişi çıkış yapıp tekrar giriş yapar → otomatik olarak `/admin` paneline yönlenir; menüde **Yönetim Paneli** görünür.

Yetkiyi geri almak: aynı dokümanı Console'dan silin. Etki bir sonraki istekte başlar (kurallar her istekte kontrol eder).

> Superadmin hesabında **güçlü parola** kullanın ve hesabı paylaşmayın. Bu hesap tüm müşterilerin
> (destek erişimini kapatmamış olanların) verisini okuyup değiştirebilir.

Emulator'de hazır hesap: `super@test.local` (bkz. `docs/TEST-ORTAMI.md`, `npm run emu:seed`).

## 2. Yönetim paneli (`/admin`)

- **Genel bakış:** toplam işletme, aktif (ücretli), deneme, süresi dolan, askıda, son 7 günde aktif.
  "Son aktivite" = `tenants.lastActiveAt` (her girişte yazılır) ve kullanıcıların `lastLogin`'inin en yenisi.
- **İşletmeler listesi:** arama (ad / sahip e-posta / ID), plan ve durum filtresi; ad, sahip, plan, bitiş, aktif kullanıcı sayısı, son aktivite.
- **İşletme detayı** (`/admin/tenants/:id`):
  - bilgiler, destek erişimi durumu,
  - lisans: plan, azami kullanıcı, **+30 / +365 gün** uzat, **askıya al / aktifleştir**,
  - kullanıcılar: rol değiştir (sahip hariç), pasife al / aktifleştir, **şifre sıfırlama e-postası** gönder,
  - **Destek modunda aç**,
  - denetim kaydı.
- Tüm işlemler `auditLogs` koleksiyonuna yazılır (değiştirilemez, silinemez).

## 3. Destek modu (impersonation)

- İşletme detayında **Destek modunda aç** → uygulama o işletmenin verisiyle, **admin** yetkileriyle açılır.
- Ekranın üstünde kırmızı, kapatılamaz şerit: **"Destek modu: <işletme adı> — Çık"**.
- Oturum `sessionStorage`'da tutulur: sekme kapanınca biter. Çıkışta (`Çık` veya oturumu kapatma) `/admin`'e dönülür.
- Destek modunda yapılan kayıtlarda `createdBy` **superadmin'in kendi uid'si** olur (kimin yaptığı izlenebilir).
- Her oturumun başlangıcı (`support_start`) ve bitişi (`support_end`, süre ile) `auditLogs`'a yazılır.
- Lisansı dolmuş/askıdaki işletmede de destek modu yazabilir (sorunu çözmek için).

## 4. Lisans / abonelik

`tenants/{id}` alanları (yalnız superadmin değiştirebilir — kurallar zorlar):

| Alan | Değerler | Not |
|---|---|---|
| `plan` | `trial` / `basic` / `pro` | Yoksa **eski (lisans öncesi) işletme**: kısıtsız |
| `status` | `active` / `suspended` | `suspended` → salt okunur |
| `trialEndsAt` | timestamp | Deneme bitişi (kayıtta +30 gün) |
| `licenseExpiresAt` | timestamp / `null` | Ücretli plan bitişi; `null` = süresiz |
| `maxUsers` | sayı | Deneme/temel 3, pro 10 (varsayılan) |
| `supportAccess` | bool | İşletme admini değiştirir (bkz. 5) |
| `lastActiveAt` | timestamp | Girişte yazılır |

- **Kayıt:** yeni işletme `plan: 'trial'`, 30 gün, `maxUsers: 3` ile açılır. Kurallar yeni işletmenin yalnız
  ≤ 31 günlük deneme ile oluşturulmasına izin verir.
- **Uyarı:** bitişe 7 gün kala uygulamanın üstünde sarı şerit.
- **Salt okunur mod** (süre doldu / askıda): kırmızı şerit + `/license` ekranı ("Lisansınız sona erdi, destek: <telefon>").
  - Kurallar: işletme verisinde **create / update / delete reddedilir** (okuma serbest), ekip daveti reddedilir. Superadmin hariç.
  - Uygulama: POS rotası `licenseGuard` ile `/license`'a yönlenir; `FirestoreService.add/update/delete` `LicenseError` fırlatır.
- **maxUsers:** Ekip davetinde aktif kullanıcı + bekleyen davet sayısı sınırı aşamaz. Bu kontrol **yalnız istemcidedir**
  (kurallar sayım yapamaz; Spark'ta Functions yok).
- **Destek telefonu/e-postası:** `src/app/core/license/license.config.ts` (`SUPPORT_CONTACT`) — satıştan önce gerçek bilgilerle değiştirin.
- **Eski müşteriler:** `plan` alanı olmayan işletmeler kısıtsız çalışmaya devam eder. Lisanslamak için panelden plan seçip kaydedin
  (ücretli plana geçişte bitiş yoksa deneme bitişinden itibaren +30 gün atanır; sonra +365 ile uzatın).

## 5. KVKK ve şeffaflık

- `tenants/{id}.supportAccess` (varsayılan `true`). İşletme admini **Ayarlar → Destek erişim geçmişi** kartından kapatabilir.
  Kapalıyken:
  - Yönetim panelinde "Destek modunda aç" devre dışıdır,
  - kurallar superadmin'in o işletmenin **verisine** (ürün, satış, müşteri, veresiye…) erişimini reddeder,
  - superadmin yine de `tenants` dokümanını (işletme adı, lisans alanları) ve kullanıcı listesini görebilir/değiştirebilir
    (lisans ve hesap yönetimi için gerekli).
- İşletme admini aynı kartta tüm destek oturumlarını ve lisans/kullanıcı işlemlerini (kim, ne zaman, ne yaptı) görür.
- `auditLogs` değiştirilemez ve silinemez (istemciden). Not: superadmin destek modunda yaptığı **tek tek veri değişikliklerini**
  auditLogs'a yazmaz; yalnız oturumlar kaydedilir. Kayıtlardaki `createdBy` alanı superadmin uid'sini gösterir.

### Müşteri sözleşmesi için madde önerisi (taslak — hukukçuya kontrol ettirin)

> **Madde X — Teknik Destek Amacıyla Erişim**
>
> X.1. Müşteri, Hizmet Sağlayıcı'nın yalnızca teknik destek, hata giderme, veri düzeltme ve lisans yönetimi amaçlarıyla,
> Müşteri'nin talebi veya Hizmet'in sürekliliği için gerekli olduğu hâllerde Müşteri hesabındaki verilere erişebileceğini kabul eder.
>
> X.2. Bu erişim yalnızca Hizmet Sağlayıcı'nın yetkilendirdiği personel tarafından, kayıt altına alınan destek oturumları
> üzerinden yapılır. Her oturumun başlangıç ve bitiş zamanı ile oturumu açan personelin kimliği kaydedilir ve Müşteri'nin
> yönetici kullanıcısı tarafından uygulama içindeki "Destek erişim geçmişi" ekranından görüntülenebilir.
>
> X.3. Müşteri, uygulama ayarlarından destek erişimini dilediği zaman kapatabilir. Erişim kapalıyken Hizmet Sağlayıcı
> Müşteri'nin işletme verilerine erişemez; bu durumda verilere erişim gerektiren destek talepleri karşılanamayabilir.
> Lisans ve hesap bilgilerine (işletme adı, plan, süre, kullanıcı listesi) erişim, sözleşmenin ifası için her durumda devam eder.
>
> X.4. Hizmet Sağlayıcı, bu madde kapsamında eriştiği kişisel verileri 6698 sayılı Kişisel Verilerin Korunması Kanunu'na
> uygun olarak, veri işleyen sıfatıyla ve yalnızca belirtilen amaçlarla işler; üçüncü kişilerle paylaşmaz ve gizliliğini korur.
>
> X.5. Müşteri, kendi müşterilerine (çiftçiler vb.) ait kişisel verilerin bu madde kapsamında işlenebileceği hususunda
> kendi aydınlatma yükümlülüğünü yerine getirmekle sorumludur.

Ayrıca: aydınlatma metnine "teknik destek amacıyla veri işleyen olarak yazılım sağlayıcısı" ifadesi eklenmeli,
superadmin personeli için gizlilik taahhüdü alınmalıdır.

## 6. Kod haritası

| Konu | Dosya |
|---|---|
| Superadmin tespiti, destek modu, `currentUser` (destek modunda tenant + admin) | `src/app/core/auth/services/auth.service.ts` |
| Denetim kaydı | `src/app/core/auth/services/audit-log.service.ts` |
| `/admin` guard | `src/app/core/auth/guards/super-admin.guard.ts` |
| Lisans hesaplama / servis / guard / ekran | `src/app/core/license/` |
| Yönetim paneli | `src/app/features/admin/` |
| Destek + lisans şeridi | `src/app/features/admin/components/support-banner.component.ts` |
| Destek erişim geçmişi kartı (ayarlar) | `src/app/features/admin/components/support-access-log.component.ts` |
| Kurallar ve testleri | `firestore.rules`, `firestore.rules.md`, `tests/rules/superadmin.spec.ts` (`npm run test:rules`) |
