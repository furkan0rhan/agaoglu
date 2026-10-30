# Android APK — derleme, imzalama, kurulum

Android paketi **yalnız GitHub Actions'ta** derlenir (`.github/workflows/android-build.yml`).
Yerelde Android SDK / Rust gerekmez.

| Dosya | Ne için |
|---|---|
| `TarimMarketPro-<sürüm>.apk` | Telefona doğrudan kurulum (arm64 + armv7, tek dosya) |
| `TarimMarketPro-<sürüm>.aab` | Yalnız Google Play Console'a yüklemek için (telefona kurulmaz) |
| `TarimMarketPro-<sürüm>-debug.apk` | İmza secret'ları eklenmemişse üretilen geçici, imzasız sürüm |

---

## 1. Tek seferlik kurulum: imza anahtarı ve GitHub secret'ları

Release imza anahtarı (keystore) projede üretildi:

- Keystore: `.keys/tarim-market-release.jks` (alias: `tarim-market`, RSA 2048, ~27 yıl geçerli)
- Şifre ve base64 metni: `.keys/README-GIZLI.txt`

`.keys/` klasörü `.gitignore`'dadır; **asla commit etme, kimseyle paylaşma.**

> ## **UYARI: KEYSTORE'U YEDEKLE!**
> **`.keys/tarim-market-release.jks` dosyası veya şifresi kaybolursa, telefonlara kurulmuş uygulamaya
> BİR DAHA GÜNCELLEME YAPILAMAZ.** Android, aynı uygulamanın güncellemesini yalnızca aynı anahtarla
> imzalanmışsa kabul eder; anahtar kaybolursa herkes uygulamayı silip yeniden kurmak (ve yerel verisini
> kaybetmek) zorunda kalır, Play Store'da ise uygulama güncellenemez hale gelir.
> **`.keys/` klasörünün tamamını şimdi en az iki ayrı güvenli yere (şifreli USB, parola yöneticisi,
> kurumsal kasa) kopyala.**

### GitHub'a secret ekleme (3 adet)

1. GitHub'da depoyu aç → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** düğmesine bas; aşağıdaki üç secret'ı tek tek ekle:

| Name | Secret (değer) |
|---|---|
| `ANDROID_KEY_ALIAS` | `tarim-market` |
| `ANDROID_KEY_PASSWORD` | `.keys/README-GIZLI.txt` içindeki şifre |
| `ANDROID_KEY_BASE64` | Keystore dosyasının base64 hali (aşağıya bak) |

`ANDROID_KEY_BASE64` değerini panoya almak için proje klasöründe **PowerShell**'de:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".keys\tarim-market-release.jks")) | Set-Clipboard
```

Sonra secret değeri kutusuna **Ctrl+V** ile yapıştır (aynı metin `README-GIZLI.txt`'nin sonunda da var).
Satır başı/boşluk eklenmemesine dikkat et.

Secret'lar eklenmezse workflow kırılmaz: imzasız **debug** APK üretir ve Actions özet sayfasında uyarı gösterir.

---

## 2. Yeni sürümün APK'sını çıkarma

1. Tüm değişiklikleri commit et.
2. `npm run release -- 1.2.0` (sürüm numarasını yaz). Script `package.json`, `tauri.conf.json`,
   `Cargo.toml` ve environment dosyalarını günceller, `v1.2.0` tag'ini push eder.
3. GitHub → **Actions**: iki iş çalışır — *Windows Release* ve *Android APK Build* (~15–25 dk).
4. GitHub → **Releases**: `Tarım Market Pro v1.2.0` **taslağında** şunlar olur:
   - Windows: `..._x64-setup.exe` (önerilen) ve `.msi`
   - Android: `TarimMarketPro-1.2.0.apk` ve `TarimMarketPro-1.2.0.aab`
5. Kontrol et → **Publish release**.

APK ayrıca ilgili Actions çalışmasının **Artifacts** bölümünde de (30 gün) bulunur.
Elle derleme: Actions → *Android APK Build* → **Run workflow** (yalnız artifact üretir, Release'e yüklemez).

**Sürüm numarası:** Android `versionName` = `tauri.conf.json` sürümü (ör. 1.2.0);
`versionCode` = major×1000000 + minor×1000 + patch (1.2.0 → 1002000). Bunu Tauri CLI her derlemede
otomatik üretir; elle bir şey yapmaya gerek yok. Sürüm hep **artmalı**, yoksa telefon güncellemeyi reddeder.

---

## 3. Telefona kurulum

1. Telefondan GitHub Releases sayfasını aç (veya APK'yı WhatsApp/USB ile telefona gönder).
2. `TarimMarketPro-<sürüm>.apk` dosyasını indir ve dokun.
3. "Bu kaynaktan uygulama yüklemeye izin verilmiyor" uyarısı çıkarsa:
   **Ayarlar** → açılan ekranda **Bu kaynaktan izin ver** (Chrome / Dosyalar / WhatsApp için) → geri dön → **Yükle**.
   (Menü adı markaya göre değişir: *Bilinmeyen uygulamaları yükle* / *Bilinmeyen kaynaklar*.)
4. Play Protect "tanınmayan uygulama" derse: **Daha fazla ayrıntı** → **Yine de yükle**.
5. Güncelleme: yeni APK'yı aynı şekilde kur — veriler korunur (aynı anahtarla imzalı olduğu sürece).

Desteklenen cihazlar: Android 7.0 (API 24) ve üzeri, ARM işlemcili telefon/tabletler (arm64 ve 32-bit armv7).

---

## 4. Google Play Store (ileride)

- Play Console'a **`.aab`** dosyası yüklenir, APK değil.
- İlk yüklemede "Play App Signing" açılır; bizim keystore'umuz **upload key** olarak kullanılır.
  Upload key kaybolursa Play desteğinden sıfırlama istenebilir, ama yine de yedekle.
- Play'e geçilirse, daha önce APK ile kurulmuş telefonlar Play sürümünü güncelleme olarak alamayabilir
  (imza Play anahtarıyla değişir) — geçişte kullanıcılara bir kez yeniden kurulum gerekebilir.

---

## 5. Sorun giderme

| Belirti | Çözüm |
|---|---|
| Actions özetinde "İmza secret'ları eksik" uyarısı, dosya adı `-debug.apk` | 3 secret'ı ekle (bölüm 1), yeni tag at veya işi yeniden çalıştır. |
| "Setup Android signing" sonrası Gradle `Keystore was tampered with, or password was incorrect` | `ANDROID_KEY_PASSWORD` yanlış ya da `ANDROID_KEY_BASE64` eksik/bozuk kopyalandı; PowerShell komutuyla yeniden kopyala. |
| `No key with alias ... found` | `ANDROID_KEY_ALIAS` tam olarak `tarim-market` olmalı. |
| Telefonda "Uygulama yüklenmedi" / "paket mevcut paketle çakışıyor" | Telefondaki sürüm farklı anahtarla (ör. eski debug APK) imzalı. Eski uygulamayı kaldırıp yeniden kur (yerel veri silinir; bulut verisi kalır). |
| "Ayrıştırma hatası" | APK eksik indirildi veya cihaz Android 7'den eski. Yeniden indir. |
| Releases'te APK yok, Windows dosyaları var | Android işi başarısız olmuş olabilir: Actions → *Android APK Build* loglarına bak; düzeltip işi **Re-run** et (aynı taslağa ekler). |
| Release'te iki ayrı taslak | Olmamalı (iki workflow `gh-release-<tag>` kilidini paylaşır). Olursa birini sil, dosyaları diğerine taşı. |
| Release derlemede açılışta beyaz ekran/çökme (debug'da yok) | Release'te R8 küçültme açık; `app/proguard-rules.pro`'ya keep kuralı gerekebilir. Logcat çıktısını ekleyerek bildir. |
