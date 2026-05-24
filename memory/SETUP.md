# Tarım Market Pro — Kurulum & Çalıştırma Rehberi

## Web (Tarayıcıda geliştirme)

```bash
npm start
# http://localhost:4200 adresinde açılır
```

---

## Masaüstü — Windows .exe (Tauri)

### Gereksinimler

1. **Rust** — https://rustup.rs adresinden kur
   ```bash
   # Kurulumu doğrula
   rustc --version
   cargo --version
   ```

2. **Visual Studio C++ Build Tools** — Olmadan `link.exe not found` hatası alırsın
   - https://visualstudio.microsoft.com/visual-cpp-build-tools adresine git
   - "Desktop development with C++" iş yükünü seç, kur (~5 GB)
   - Alternatif: `winget install Microsoft.VisualStudio.2022.BuildTools`

3. **WebView2** — Windows 11'de zaten yüklü gelir, Windows 10'da yoksa:
   - https://developer.microsoft.com/microsoft-edge/webview2 adresinden kur

### Geliştirme modunda çalıştır (hot-reload ile)

```bash
npm run tauri:dev
```
> İlk çalıştırma Rust bağımlılıklarını derler, 5-10 dakika sürebilir. Sonraki çalıştırmalar hızlıdır.

### Kurulum dosyası üret (.exe / .msi)

```bash
npm run tauri:build
```
Çıktı: `src-tauri/target/release/bundle/` altında `.exe` ve `.msi` dosyaları oluşur.

---

## Mobil — Android (Capacitor)

### Gereksinimler

- **Android Studio** (zaten kurulu ✓)
- **JDK 17+** — Android Studio ile birlikte gelir
- Android Studio içinde SDK: `SDK Manager > Android 13+ (API 33+)` kurulu olmalı

### Capacitor kurulumu (ilk kez)

```bash
# Capacitor paketlerini ekle
npm install @capacitor/core @capacitor/cli @capacitor/android --legacy-peer-deps

# Projeyi başlat (zaten varsa atla)
npx cap init "Tarım Market Pro" "com.tarimmarket.pro" --web-dir dist/tarim-market/browser

# Android platformu ekle
npx cap add android
```

### Her değişiklikten sonra

```bash
# 1. Web uygulamasını derle
npm run build

# 2. Android projesine aktar
npx cap sync android

# 3. Android Studio'da aç
npx cap open android
```
Android Studio'da `Run > Run 'app'` diyerek telefona veya emülatöre yükle.

### Fiziksel telefona yüklemek için

1. Telefonda **Geliştirici seçenekleri > USB hata ayıklama** aç
2. Telefonu USB ile bağla
3. Android Studio'da cihazı seç, çalıştır

---

## Firebase

Proje: `stok-takip-2031b`
- Firebase Console: https://console.firebase.google.com
- Authentication: Email/Password aktif
- Firestore: `users`, `products`, `customers`, `sales`, `creditAccounts` koleksiyonları

Config dosyası: `src/environments/environment.ts`

---

## Özet

| Hedef | Komut |
|-------|-------|
| Web geliştirme | `npm start` |
| Masaüstü geliştirme | `npm run tauri:dev` |
| Masaüstü build (.exe) | `npm run tauri:build` |
| Android sync | `npm run build && npx cap sync android` |
| Android Studio aç | `npx cap open android` |
