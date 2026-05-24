# Tarim Market — Geliştirme Özeti

## Müşteriler
- Yeni müşteri ekleyince listede gözükmüyordu → Firestore composite index düzeltildi (`tenantId + isActive + firstName`)
- Customer list'e retry logic ve error toast eklendi

## Ürünler Sayfası
- Ürün kartlarında **alış fiyatı gizlendi**, sadece satış fiyatı görünüyor
- Her karta **"Sepete Ekle"** butonu eklendi
  - Sepette yoksa: turuncu "Sepete Ekle" butonu
  - Sepette varsa: `[-] [adet] [+]` kontrolü
  - Stoktan fazla artırılamıyor, `+` pasif oluyor
- **"Yakın SKT"** filtre butonu eklendi
  - 30 gün içindeki ürünlerde kart üstünde badge
  - 7 gün ve altı → kırmızı, 7-30 gün → amber

## Sepet / POS
- **Yeni akış**: Ürünler sayfasından sepete ekle → Sepet sayfasında ödeme
- POS sayfası tam genişlik sepete dönüştürüldü
  - Sol: ürün listesi (miktar kontrolü + sil)
  - Sağ: sipariş özeti + ödeme butonları
  - Sepet boşken "Ürünlere Git" linki
- **Müşteri seçimi** gerçek liste ile yapılıyor (arama destekli dialog)
- Miktar değişince `totalPrice` doğru hesaplanıyor (bug fix)
- Veresiye bakiyesi Firestore `increment()` ile atomik güncelleniyor (bug fix)
- Barkod okuyucu POS sayfasında çalışmaya devam ediyor

## Sidebar
- Sepet (POS) ikonunda **kırmızı badge** — sepetteki ürün adedini gösteriyor
- Role göre menü filtreleme düzeltildi
  - Firestore'da `role` alanı yoksa `admin` varsayılan
  - Auth yüklenirken tüm menü itemları görünür

## Dashboard
- **Son kullanma tarihi yaklaşan ürünler** listesi eklendi
  - Kritik stok uyarısının altında, kalan günle birlikte gösteriliyor
  - 7 gün altı kırmızı, 30 güne kadar amber

## Profil / Ayarlar
- **Ad soyad güncelleme**: Firebase Auth + Firestore güncelleniyor, sidebar'a anında yansıyor
- **Şifre değiştirme**: Mevcut şifre doğrulama (reauthenticate) + yeni şifre

## Firestore Index
```json
customers: tenantId (ASC) + isActive (ASC) + firstName (ASC)
```
→ Firebase Console'dan deploy edildi, Enabled durumda.
