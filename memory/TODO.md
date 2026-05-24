# Yapılacaklar & Yol Haritası

---

## 🔴 Öncelikli — Eksik Sayfalar (Hâlâ Eski Ionic)

Bu sayfalar henüz PrimeNG'ye geçirilmedi:

- [x] ~~**Ürün Detay** (`product-detail.page.ts`)~~ — **TAMAMLANDI**
- [ ] **Veresiye Detay** (`credit-detail.page.ts`) — müşteri borç/ödeme geçmişi, ödeme al butonu
- [ ] **Şifremi Unuttum** (`forgot-password.page.ts`) — sade form, PrimeNG input
- [ ] **Stok Hareketleri** (`stock-movements.page.ts`) — giriş/çıkış listesi

---

## 🟡 Önemli — Eksik İşlevler

### Kullanıcı Yönetimi
- [ ] Admin panelinden kasiyer/personel hesabı açabilme
- [ ] Kullanıcı rolü değiştirme (admin → cashier → staff)
- [ ] Kullanıcı listesi sayfası

### Raporlar (Gerçek Veri)
- [ ] Günlük/haftalık/aylık satış grafiği (PrimeNG Chart veya Chart.js)
- [ ] En çok satan ürünler listesi
- [ ] Stok değer raporu (toplam alış/satış değeri)
- [ ] Veresiye/tahsilat özeti

### Müşteri İletişim
- [ ] SMS gönderme (Twilio veya Netgsm entegrasyonu) — borç hatırlatma, ödeme makbuzu
- [ ] E-posta gönderme (Firebase Extensions veya SendGrid) — fatura, özet rapor
- [ ] Toplu SMS (seçili müşterilere)

### Veresiye & Ödeme
- [ ] Veresiye detay sayfasında "Ödeme Al" butonu
- [ ] Kısmi ödeme girişi
- [ ] Ödeme geçmişi listesi

### Ürün
- [x] ~~Ürün detay sayfasında stok hareketi geçmişi~~ — **TAMAMLANDI** (detay sayfasında inline gösteriliyor)
- [ ] Toplu stok güncelleme (sayım)
- [ ] Barkod etiketi yazdırma (jsPDF ile)

---

## 🟢 Geliştirmeler — Optimizasyon & UX

### Performans
- [ ] Firestore sorguları için pagination (büyük veri setleri)
- [ ] Offline mod testi ve Firestore persistence doğrulaması
- [ ] Angular lazy loading zaten var, bundle boyutu optimize edilebilir
- [ ] `ng build --configuration=production` ile minifikasyon ve tree-shaking

### Masaüstü (Tauri)
- [ ] **Release build** → `.exe` installer üret: `npm run tauri:build`
- [x] ~~Uygulama ikonu özelleştirme~~ — **TAMAMLANDI** (TarimLogo.png'den şeffaf ikonlar üretildi)
- [x] ~~EXE yavaş başlıyor~~ — **TAMAMLANDI** (Cargo.toml release profil optimizasyonu eklendi)
- [ ] Sistem tepsisi (system tray) ikonu — arka planda çalışsın
- [ ] Otomatik güncelleme (Tauri updater plugin)
- [ ] Pencere boyutu/pozisyon hatırlama

### Mobil (Capacitor — Android)
- [ ] Capacitor kurulumu:
  ```
  npm install @capacitor/core @capacitor/cli @capacitor/android --legacy-peer-deps
  npx cap init "Tarım Market Pro" "com.tarimmarket.pro" --web-dir dist/tarim-market/browser
  npx cap add android
  ```
- [ ] Responsive tasarım düzeltmeleri (mobil ekran boyutları için)
- [ ] Android build ve fiziksel cihazda test
- [ ] Kamera ile barkod okuma (Capacitor Camera + ZXing)
- [ ] Push notification (Capacitor Push Notifications)

### Dışa Aktarma
- [ ] Satış fişi PDF (jsPDF — paket zaten kurulu)
- [ ] Günlük rapor Excel (xlsx — paket zaten kurulu)
- [ ] Müşteri listesi Excel export

### Güvenlik & Firebase
- [ ] Firestore güvenlik kuralları sıkılaştırma (tenantId bazlı)
- [ ] Firebase App Check aktifleştirme
- [ ] Oturum süresi dolunca otomatik logout

---

## ⚪ İleride — Nice to Have

- [ ] Tema desteği (açık/koyu mod)
- [ ] Dil seçeneği (TR/EN)
- [ ] Çoklu şube/mağaza desteği
- [ ] Müşteri SMS bildirimi (borç hatırlatma)
- [ ] Tauri ile barkod okuyucu donanım entegrasyonu (USB/Bluetooth)
- [ ] Cloud backup / veri yedekleme
- [ ] Fatura kesme (e-Arşiv entegrasyonu)

---

## Paketler (Kurulu ama henüz kullanılmayan)

| Paket | Amaç | Durum |
|-------|------|-------|
| `chart.js` + `ng2-charts` | Raporlar grafikleri | Kurulu, entegre edilmedi |
| `jspdf` + `jspdf-autotable` | PDF export | Kurulu, entegre edilmedi |
| `xlsx` | Excel export | Kurulu, entegre edilmedi |
| `@zxing/browser` + `@zxing/library` | Barkod okuma | Kurulu, entegre edilmedi |
| `dexie` | IndexedDB (offline) | Kurulu, entegre edilmedi |
| `@capacitor/*` | Mobil | Henüz kurulmadı |
