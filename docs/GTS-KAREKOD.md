# Ürünler ve GTS / Karekod Takibi

Ürün yönetimi ve GTS (karekod) birim takibinin nasıl çalıştığı. Eski `memory/URUNLER-GTS.md` dosyasının güncel hâli.

## Temel kural

- **Barkod ürüne aittir** (tek). **GTS / karekod her birime aittir** ve benzersizdir: 10 stok = 10 farklı GTS.
- Veri modeli: `Batch` (parti). **GTS'li her birim = `quantity: 1` olan bir parti**, kendi `gtsNo`'suyla.
  GTS'siz stok tek bir `quantity: N` parti (`gtsNo: null`) olarak tutulur.
- Partide ayrıca SKT (`expiryDate`), tedarikçi (`supplierId`) ve şarj/parti no (`lotNo`) bulunur.
- Böylece FEFO (en yakın SKT önce satılır), barkod/GTS ile arama ve satışta stok düşümü aynı modelle çalışır.
- GTS uygulamada **zorunlu değildir**; zorunluluk bayi ayarlarındaki mevzuat moduna ve ürün türüne göre uyarı/engel olarak uygulanır.

## Karekod okuma (GS1)

`src/app/shared/scanner/gs1.ts` GS1 DataMatrix / GS1-128 / parantezli metni çözer:
`(01)` GTIN-14 · `(21)` sıra no · `(17)` SKT · `(10)` şarj/parti no. EAN-13 barkod başına `0` eklenerek GTIN-14 olur.
Okutulan karekoddan GTIN ürünü, SKT ve parti no alanları otomatik doldurulur. USB okuyucu GS ayırıcısını yutarsa
çözümleyici en olası bölmeyi tahmin eder (`ambiguous: true`, kullanıcıya uyarı).

Kamera ile okuma: masaüstü/web'de ZXing (`scanner-dialog.component.ts`), Android'de Tauri barcode-scanner eklentisi.

## Ekranlar

- **Ürün listesi** (`product-list.page.ts`): tablo, sıralama, sütun filtreleri, hızlı çipler (kritik stok, yakın SKT, pasif ürünler).
- **Ürün formu** (`product-form.page.ts`): yeni üründe ilk stok GTS'li girilebilir (her karekodu okut + Enter; her GTS 1 birim).
  Okutulan GTS sayısı stoktan azsa fark GTS'siz stok olarak kaydedilir.
- **Ürün detayı** (`product-detail.page.ts`):
  - GTS / karekod tablosu (`product-gts-table.component.ts`): satır düzenle (`updateBatch`), satır sil (`removeBatch`, onaylı; stok düşer, çıkış hareketi yazılır).
  - "GTS Ekle" paneli (`product-gts-add-panel.component.ts`): SKT + tedarikçi bir kez seçilir, karekodlar arka arkaya okutulur (aynı ürün içinde ve diğer ürünlerde tekrar kontrolü), "Ekle (N)".
  - Stok ile parti toplamı uyuşmazsa uyarı + "eşitle" düğmeleri (`reconcileStock`).
- **Alış faturası** (`features/purchases`): satır başına GTS listesi ve SKT girilir; kaydedilince her GTS bir birim olarak stoğa girer.
- **POS**: karekod okutulunca o birim sepete eklenir; satışta önce okutulan GTS'ler, sonra FEFO ile en yakın SKT'li partiler düşer
  (`sale.utils.ts` → `allocateFEFO`). Satılan GTS'ler satış kaydına ve fişe yazılır.

## Servis metotları (`product.service.ts`)

| Metot | İş |
|-------|-----|
| `create(dto, reason)` | Ürün + ilk stok partileri |
| `adjustStock(p, delta, reason, ref, expiry, gtsNumbers, supplierId, lotNo)` | Stok ekle/çıkar. GTS listesi doluysa her GTS için `quantity: 1` parti; boşsa tek `quantity: N` parti |
| `updateBatch(p, batchId, { expiryDate, supplierId, gtsNo, lotNo })` | Tek partinin/birimin alanlarını güncelle |
| `removeBatch(p, batchId, reason, quantity?)` | Partiyi/birimi (veya bir kısmını) çıkar, hareket yaz |
| `reconcileStock(p, mode, reason)` | Stok ile parti toplamını eşitle |
| `setActive(id, isActive)` / `getPassive$()` | Soft-delete (pasif) ve geri getirme; kalıcı silme yok |

Tüm yazımlar tenant bazlıdır ve Firestore transaction ile stok hareketi (`stockMovements`) kaydı oluşturur.

## Kullanıcıya anlatım: yeni ürün

1. **Ürünler → Yeni Ürün**: ad, barkod, kategori, fiyat; ilk stok için karekodları okut (veya GTS'siz miktar gir), Kaydet.
2. Sonradan gelen mal: ürün detayında **GTS Ekle** ya da **Alışlar → Yeni Alış**.
3. GTS'siz ürünler (hırdavat vb.): formda doğrudan stok miktarı girilir, tek parti olur.
