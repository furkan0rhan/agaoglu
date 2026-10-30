# Ürünler Modülü & GTS Takibi

Bu dosya ürün yönetimi ve GTS/karekod takip sisteminin nasıl çalıştığını anlatır.

---

## 📋 Ürün Listesi (`product-list.page.ts`)

- **Tablo görünümü** (`p-table`) — kart sistemi kaldırıldı, tek görünüm tablo.
- **Sütun sıralama:** Ad, Barkod, Kategori, Marka, Stok, Fiyat başlıklarından.
- **Sütun filtresi:** Varsayılan **kapalı**. Toolbar'daki **"Filtreler"** butonuyla açılır (Ad/Barkod/Marka metin, Kategori çoklu seçim, Stok/Fiyat sayısal).
- **Üst araç çubuğu:** arama kutusu + hızlı çipler (Tümü / kategoriler / Kritik Stok / Yakın SKT). Bunlar `ProductStore` üzerinden çalışır; tablo filtreleri bunların üstüne eklenir.
- **Pasif Ürünler çipi:** Açınca pasif (silinmiş) ürünler ayrı sorgudan (`getPassive$`) gelir, her satırda **"Aktif Et"** ile geri getirilir.
- Renkli durum noktası: 🔴 tükendi / 🟡 kritik / 🟢 normal.

## 🔎 Ürün Detay (`product-detail.page.ts`)

- **Başlıkta:** Aktif/Pasif durum etiketi + **Aktif/Pasif** butonu + **Düzenle** + **Sil**.
- **Sil = soft-delete:** Veri Firestore'da kalır (`isActive:false`), sadece listeden kalkar. "Pasif Ürünler"den geri getirilir. **Kalıcı silme YOK** (`hardDelete` bilerek kaldırıldı).
- **GTS / Karekod Listesi tablosu** (aşağıda ayrı bölüm).
- **Stok Ekle/Çıkar dialogları:** SADECE GTS'siz basit işlemler için (adet + neden + tedarikçi + SKT). GTS taraması burada DEĞİL, tabloda.

---

## 🏷️ GTS / Karekod Sistemi — EN ÖNEMLİ MANTIK

**Kural:** Barkod ürüne aittir (tek). GTS her BİRİME aittir ve benzersizdir. 10 stok = 10 farklı GTS.

**Veri modeli hilesi:** `Batch` modeli değişmedi. **GTS'li her birim = `quantity:1` olan bir Batch**, kendi `gtsNo`'suyla. Böylece FEFO, en yakın SKT, barkod/GTS arama, satış düşümü otomatik doğru çalışır.
- GTS'li ekleme → her GTS için ayrı `quantity:1` batch.
- GTS'siz ekleme → tek `quantity:N` batch, `gtsNo:null`.

### GTS Tablosu (ürün detayında, tam genişlik)
Sütunlar: **# | GTS/Karekod | SKT | Tedarikçi | Eklenme | ✎ 🗑** (Adet sütunu YOK — her GTS zaten 1 birim).
- **Stok = tablodaki birim sayısı.** Ekleyince artar, silince azalır.
- GTS'siz toplu satır: GTS hücresinde "GTS'siz · N adet" olarak görünür.
- **Satır düzenle (✎):** o birimin GTS / SKT / tedarikçisini ayrı değiştir (`updateBatch`).
- **Satır sil (🗑, onaylı):** stok düşer + çıkış hareketi kaydedilir (`removeBatch`).

### "+ GTS Ekle" paneli (toplu okut)
1. **SKT** seç (bir kez, opsiyonel)
2. **Tedarikçi** seç (bir kez, opsiyonel)
3. **GTS alanına** karekod okut / yaz + **Enter** → yeşil çip. Aynısı varsa uyarır.
4. Sırayla hepsini okut → **"Ekle (N)"**.
- Hepsi aynı SKT/tedarikçiyle eklenir; farklı olanı sonra satırdan düzenlersin.

**GTS opsiyonel** — hiçbir şey zorunlu değil (gübrede yasal zorunlu ama uygulamada zorlamıyoruz).

---

## 🔧 Servis metotları (`product.service.ts`)

| Metot | İş |
|-------|-----|
| `adjustStock(p, delta, reason, ref, expiry, gtsNumbers[], supplierId)` | Stok ekle/çıkar. `gtsNumbers` doluysa her GTS için qty:1 batch (delta=GTS sayısı); boşsa tek qty:N batch. |
| `updateBatch(p, batchId, {expiryDate, supplierId, gtsNo})` | Tek partinin/birimin alanlarını güncelle. |
| `removeBatch(p, batchId)` | Partiyi/birimi sil, stok düşür, çıkış hareketi yaz. |
| `setActive(id, isActive)` | Aktif/pasif (soft). |
| `getPassive$()` | Pasif ürünleri getir (isActive==false). |

`AuthService`, `FirestoreService` üzerinden tenant bazlı. Satış düşümü POS'ta `applyFEFO` ile (en yakın SKT'li birim önce satılır).

---

## 🚶 Yeni Ürün Ekleme Akışı (kullanıcıya anlatım)

1. **Ürünler → Yeni Ürün** → ad, barkod, kategori, fiyat gir, **Stok Miktarı = 0**, Kaydet.
2. Listeden **ürüne tıkla** → detay açılır.
3. **GTS / Karekod Listesi** kutusunda sağ üstteki yeşil **"GTS Ekle"** → SKT + tedarikçi seç → GTS'leri arka arkaya okut → **Ekle (N)**.
4. Sonuç: N birim, N benzersiz GTS, stok N.

> GTS'siz ürünler (bardak, hırdavat): formda direkt "Stok Miktarı" gir, tek parti olur.

---

## ⏳ Açık uçlar / olası sonraki adımlar

- **Yeni Ürün formuna GTS Ekle panelini taşımak** — şu an iki aşama (kur → detaydan ekle). Form içine alınırsa tek ekranda biter. (Kullanıcıyla konuşuldu, henüz yapılmadı.)
- **Global GTS benzersizlik kontrolü** — şu an dup kontrolü ürün içinde. Tüm ürünler genelinde sorguyla kontrol eklenebilir.
- **Satışta hangi GTS'nin satıldığını fişe yazmak** — şu an FEFO ile birim düşüyor ama satılan GTS fişte tutulmuyor.

---
*Son güncelleme: 2026-07-06 — çoğu iş `product-list`, `product-detail`, `product.service`, `translations.ts` dosyalarında.*
