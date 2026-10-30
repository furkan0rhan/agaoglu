# Sürüm Geçmişi

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/). Sürümler `npm run release -- x.y.z` ile
etiketlenir; derlenmiş Windows (exe/msi) ve Android (apk) dosyaları GitHub Releases'ta yayınlanır.

## [Yayınlanmamış]

### Eklendi
- Kamera ile barkod / karekod okuma (masaüstü ve web: ZXing, Android: Tauri barcode-scanner); GS1 karekoddan GTIN, SKT ve parti no çözümleme.
- Partilerde şarj/parti no (`lotNo`).
- Ürün turu (ilk kullanımda ekran ekran tanıtım).

### Değişti
- README Türkçe olarak yeniden yazıldı; eski `memory/` notları kaldırıldı, GTS rehberi `docs/GTS-KAREKOD.md` oldu.

### Kaldırıldı
- Kullanılmayan Dexie / SyncQueue çevrimdışı kuyruk kodu ve `dexie` paketi (çevrimdışı çalışma Firestore'un kalıcı önbelleğiyle sağlanıyor).
- Kullanılmayan çeviri anahtarları, `stockStatus` pipe'ı ve `/account` yönlendirme kalıntısı.

## [1.1.0] — 2026-10-30

### Eklendi
- **Tasarım v2 "Saha / Komuta"**: tüm ekranlar yeniden tasarlandı; ayarlar merkezi, açık/koyu tema, yazı boyutu.
- **POS**: hızlı arama, ondalık miktar ve birimler, F tuşları, kart onayı, 58/80 mm fiş, satış bekletme, karışık ödeme, taksitli veresiye.
- **Satış geçmişi**, iptal/iade; kasa özeti.
- **Mevzuat**: e-reçete kaydı, ruhsat bilgileri, satışta GTS kaydı ve fişe yazılması, SKT'si geçmiş ürün engeli.
- **Veresiye**: vade, taksit takvimi, peşinat, hasatta ödeme, gecikmiş alacak listesi, ekstre PDF, WhatsApp/SMS hatırlatma.
- **KVKK**: aydınlatma metni, rıza kaydı, TC maskeleme, müşteri verisi dışa aktarma ve anonimleştirme.
- **Alış faturası**, tedarikçi cari hesabı, yedekleme (JSON/Excel) ve boş işletmeye geri yükleme.
- **Ekip ve roller** (yönetici / kasiyer / personel), davetle katılım.
- **Superadmin paneli**: işletmeler, lisans yönetimi, destek modu ve erişim kaydı.
- **Çiftçi modülü** (MVP): davet + PIN ile giriş, tarla/sezon, ilaçlama defteri ve hasat aralığı, ambar, borç, bayi önerisi, hava durumu.
- Firebase Emulator ile yerel test ortamı, Firestore kural testleri, ESLint.
- Windows exe/msi için GitHub Actions sürüm iş akışı ve `npm run release`.

### Değişti
- Yeni Firestore güvenlik kuralları (tenant üyeliği, superadmin, lisans, çiftçi ve alış blokları).
- Ionic kaldırıldı; Tauri'de release'de devtools kapalı, CSP eklendi.

### Düzeltildi
- Eski hesaplarda girişte "profil okunamadı" ile çıkış yapılması (eski kurallarla uyumluluk, geçici hatada yeniden deneme).
- Çok sayıda kritik hata (stok/veresiye transaction'ları, hesaplamalar).

## [1.0.0] — 2026-06-01

İlk sürüm (Angular + PrimeNG + Firebase + Tauri; Windows ve Android APK).

- Ürün ve stok yönetimi, parti bazlı GTS no ve SKT takibi, kritik stok uyarıları.
- POS: barkodla satış, nakit / kart / veresiye.
- Müşteriler ve veresiye takibi, tahsilat.
- Tedarikçiler, giderler, stok sayımı, raporlar.
- Türkçe / İngilizce arayüz, karanlık mod, çevrimdışı çalışma.
- Mobil alt menü ve güvenli alan desteği; GitHub Actions ile Android APK derlemesi.

[Yayınlanmamış]: https://github.com/furkan0rhan/agaoglu/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/furkan0rhan/agaoglu/releases/tag/v1.1.0
