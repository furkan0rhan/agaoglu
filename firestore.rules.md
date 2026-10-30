# firestore.rules — açıklama ve test listesi

Spark (ücretsiz) plan uyumlu tenant modeli. Cloud Functions / custom claims yok; kullanıcının
işletmesi (`tenantId`), rolü (`role`) ve aktifliği (`isActive`) her istekte
`get(/users/{request.auth.uid})` ile okunur (istek başına 1 ek okuma; aynı istekte önbelleklenir).

## Veri modeli

| Doküman | Alanlar | Not |
|---|---|---|
| `users/{uid}` | `tenantId, role ('admin'/'cashier'/'staff'), isActive, email, displayName, createdAt, lastLogin?` | Sahip için `tenantId == uid` |
| `tenants/{tenantId}` | `name, ownerId, createdAt` | Kayıtta / eski hesabın ilk girişinde oluşturulur |
| `invites/{emailLowercase}` | `email, tenantId, role, createdBy, createdAt` | Admin oluşturur, davetli katılınca silinir |
| `tenants/{id}` lisans alanları | `plan ('trial'/'basic'/'pro'), status ('active'/'suspended'), trialEndsAt, licenseExpiresAt, maxUsers, supportAccess, lastActiveAt` | Lisans alanlarını yalnız superadmin değiştirir. `plan` yok = eski işletme (kısıtsız) |
| `platformAdmins/{uid}` | `email?, note?` | **Yalnız Firebase Console'dan** eklenir (docs/SUPERADMIN.md) |
| `auditLogs/{autoId}` | `tenantId, actorUid, actorEmail, action, detail, createdAt` | Değiştirilemez; create yalnız superadmin |
| veri koleksiyonları | `tenantId` zorunlu | products, stockMovements, sales, customers, expenses, creditTransactions, suppliers |

## Akışlar

- **Kayıt (davetsiz):** batch → `users/{uid}` (`tenantId=uid, role=admin`) + `tenants/{uid}`.
- **Kayıt (davetli):** Auth hesabı açılır, `users` dokümanı **yazılmaz**; kişi e-postasını doğrulayınca
  (`verify-email` sayfası) token yenilenir ve batch → `users/{uid}` (davetin tenantId/role'ü) + `invites/{email}` silme.
  Kural, davetle katılımda `email_verified == true` ister: aksi halde biri başkasının e-postasıyla kayıt olup daveti kapabilirdi.
- **Eski hesap (users dokümanı yok):** ilk girişte sahip olarak oluşturulur.
- **Pasif kullanıcı:** `isActive=false` → tüm veri kuralları reddeder, uygulama oturumu kapatır.

## Kural özeti

- Veri: `read/delete: inTenant(resource.data.tenantId)`, `create: inTenant(request.resource.data.tenantId)`,
  `update: inTenant(resource) && tenantId değişmez`.
- `stockMovements`, `creditTransactions`: yalnız read + create (değişmez defter). İptal = ters kayıt (create).
- `sales`: create + update (iptal/iade), silme yok. `totalAmount >= 0`.
- `expenses.amount >= 0`, `creditTransactions.amount >= 0`; tek istisna satış iptali ters kaydı (`isReversal: true`, negatif amount — POS `cancelSale`).
- `users`: kullanıcı kendi dokümanında yalnız `displayName/email/lastLogin/onboarding` (ürün turu durumu, harita) değiştirebilir;
  aynı işletmenin admini başkalarının `role/isActive` alanını değiştirebilir (işletme sahibi ve kendisi hariç). Silme yok.
- `credits` koleksiyonu ve `isTenant()` kaldırıldı.

### Superadmin ve lisans (bkz. docs/SUPERADMIN.md)

- `isSuperAdmin()` = `exists(platformAdmins/{auth.uid})`. `platformAdmins`: kişi yalnız kendi kaydını `get` eder; list/yazma yok.
- Veri koleksiyonları (`canRead/canCreate/canUpdate/canDelete`): `inTenant(...) [&& licenseOk(...)] || supportOk(...)`.
  `supportOk(t)` = superadmin **ve** `tenants/{t}.supportAccess != false`. `tenantId` değiştirme yasağı superadmin için de geçerli.
  `inTenant` ilk sırada: normal kullanıcıda superadmin kontrolü için ek okuma yapılmaz. users dokümanı olmayan superadmin'de
  `inTenant` hata verir; kurallarda `hata || true == true` olduğundan `supportOk` yine sonuç verir.
- `licenseOk(t)`: tenant dokümanı yoksa veya `plan` yoksa geçer; `status == 'suspended'` veya süre dolmuşsa (deneme: `trialEndsAt`,
  ücretli: `licenseExpiresAt`, `null` = süresiz) **create/update/delete reddedilir**, okuma serbest. Superadmin muaf.
- `tenants`: get = üye veya superadmin (supportAccess'ten bağımsız); list = superadmin; create = yalnız ≤ 31 günlük `trial`
  (`maxUsers ≤ 3`, `licenseExpiresAt` yok); update = işletme admini **yalnız** `name, address, phone, taxOffice, taxNo,
  receiptFooter, settings, supportAccess, updatedAt, lastActiveAt, lastBackupAt` (yeni işletme alanı eklerken listeye ekleyin) /
  herhangi bir üye yalnız `lastActiveAt` / superadmin her alan (ownerId değişmez).
- `users`: superadmin get/list ve `role, isActive` update (tenantId değişmez).
- `invites`: superadmin `supportOk` ile işletme admini gibi; lisansı dolmuş işletmede davet oluşturulamaz.
- `auditLogs`: read = o işletmenin admini veya superadmin; create = superadmin, `actorUid == auth.uid`, `createdAt == request.time`,
  geçerli `action`; update/delete yok.
- `maxUsers` kurallarda zorlanamaz (sayım yok) — yalnız istemci (`LicenseService.assertCanAddUser`).
- E-posta doğrulaması kurallarda veri erişimi için **şart değil** (mevcut doğrulanmamış hesaplar kilitlenmesin); uygulama `authGuard` ile zorlar.

## Elle test (Firebase Console → Firestore → Rules → Rules Playground)

Önce test verisi: `users/OWNER {tenantId:'OWNER', role:'admin', isActive:true}`,
`users/CASH {tenantId:'OWNER', role:'cashier', isActive:true}`, `users/OFF {tenantId:'OWNER', role:'staff', isActive:false}`,
`users/OTHER {tenantId:'OTHER', role:'admin', isActive:true}`, `products/P1 {tenantId:'OWNER'}`.

| # | Kimlik (uid) | İşlem | Beklenen |
|---|---|---|---|
| 1 | CASH | get `products/P1` | izin |
| 2 | OTHER | get `products/P1` | red |
| 3 | OFF | get `products/P1` | red |
| 4 | CASH | update `products/P1` `{tenantId:'OTHER'}` | red |
| 5 | CASH | update `users/CASH` `{role:'admin'}` | red |
| 6 | CASH | update `users/CASH` `{displayName:'X'}` | izin |
| 7 | OWNER | update `users/CASH` `{role:'staff'}` / `{isActive:false}` | izin |
| 8 | OWNER | update `users/OWNER` `{role:'staff'}` | red |
| 9 | OTHER | update `users/CASH` `{isActive:false}` | red |
| 10 | NEW | create `users/NEW` `{tenantId:'NEW', role:'admin', isActive:true}` | izin |
| 11 | NEW | create `users/NEW` `{tenantId:'OWNER', role:'admin', isActive:true}` (davet yok) | red |
| 12 | NEW (email=a@b.com, email_verified=true) | `invites/a@b.com {tenantId:'OWNER', role:'cashier'}` varken create `users/NEW {tenantId:'OWNER', role:'cashier', isActive:true}` | izin |
| 13 | aynısı, `email_verified=false` | aynı create | red |
| 14 | aynısı, role:'admin' | aynı create | red |
| 15 | CASH | create `creditTransactions` `{tenantId:'OWNER', amount:-5}` | red |
| 15b | CASH | create `creditTransactions` `{tenantId:'OWNER', amount:-5, isReversal:true}` | izin |
| 16 | CASH | update/delete `creditTransactions/*` | red |
| 17 | OWNER | create `invites/x@y.com {tenantId:'OWNER', role:'staff', createdBy:'OWNER'}` | izin |
| 18 | OTHER | aynı doküman var iken set `invites/x@y.com` | red (update yok) |
| 19 | CASH | list `users where tenantId=='OWNER'` | red (admin değil) |

Otomatik testler: `npm run test:rules` (emulator + `tests/rules/*.spec.ts`; superadmin/lisans: `tests/rules/superadmin.spec.ts`).

## Deploy

```bash
firebase deploy --only firestore:rules --project <proje-id>
```

Deploy öncesi:
1. Uygulamanın yeni sürümü (auth.service) önce yayınlanmalı **veya** aynı anda; eski istemciler `users` dokümanına
   `setDoc(..., {merge:true})` ile `displayName` yazar — bu hâlâ izinli (yalnız displayName değişir).
2. Tüm eski kullanıcıların `users/{uid}` dokümanında `tenantId == uid`, `isActive == true` olduğundan emin olun
   (Console'da `users` koleksiyonuna bakın). `isActive` alanı olmayan kullanıcı veriye erişemez.
3. Veri dokümanlarının hepsinde `tenantId` alanı olmalı (yoksa okunamaz).
4. `creditTransactions` için negatif `amount` yalnız `isReversal: true` ile yazılmalı.
5. Rules Playground'da yukarıdaki tabloyu çalıştırın.
