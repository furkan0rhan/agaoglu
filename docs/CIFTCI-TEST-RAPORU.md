# Çiftçi Alanı Kullanılabilirlik Testi (/ciftci)

> Tarih: 30.10.2026 · Ortam: yerel Firebase emulator + `ng serve --configuration emulator` (port 4463) · Claude in Chrome
> Görünüm: çiftçi her zaman telefon boyutunda, sayfa içine eklenen **360×740** ve **390×844** iframe'lerde denendi
> (çiftçi ayrı bir origin'de, `ciftci.localhost:4463`; bayi `localhost:4463` üzerinde aynı anda açıktı).
> Persona: Hüseyin Kaya, 52 yaşında, Konya Çumra; 120 da buğday, 40 da şeker pancarı, 15 da domates. Gözlüklü,
> ucuz Android telefonu var, Ağaoğlu Tarım'dan veresiye alıyor.
>
> Uçtan uca akış: bayi (admin) müşteri ekledi (Hüseyin Kaya, 0532 111 22 33, Çumra) → Çiftçiler → davet (QR + WhatsApp + link)
> → çiftçi linki açtı → izinler + telefon + PIN ile **sıfırdan kayıt** → çıkış → yanlış PIN → doğru PIN ile giriş → tur
> → 3 tarla + 3 ekim → bayi POS'tan **3 taksitli veresiye** satış yaptı (Amonyum Sülfat 10 çuval + Mankozeb, e-reçeteli)
> → borç/ambar → gübre kaydı (ambardan) + ilaç kaydı (elle, PHI uyarısı) → bayi domates için **e-reçeteli öneri** yazdı
> → çiftçi "Uyguladım, deftere işle" → hava kartı → çevrimdışı göstergesi → %125 yazı, açık tema, İngilizce
> → tarla paylaşımını kapatma → **bağlantıyı koparma**.
> Not: Emulator verisi değişti (yeni müşteri, satış, öneri, koparılmış bağlantı). Seed çalıştırılmadı.

---

## Kullanır mıydım?

**Şimdilik hayır, ama az kaldı.** Borcumu ve bayiden ne aldığımı telefonda görmek hoşuma gitti, ilacın hasat
bekleme uyarısı kırmızı kırmızı, kocaman yazıyor, işime yarar. Ama asıl merak ettiğimi göremedim: **hangi ay ne kadar
ödeyeceğim** (3 taksit yaptık, uygulamada taksit yok, sadece toplam var). Bayinin yazdığı öneri de satış da ben
uygulamayı kapatıp açmadan gelmedi, kimse "yeni bir şey var" demedi. Alışveriş tarihi de alt alta harf harf
yazılmış, okuyamadım. Bunlar düzelirse tutarım; yoksa iki hafta sonra açmayı unuturum, telefondan silerim.

---

## Bulgular

Önem: **Kritik** (kullanmayı bıraktırır / yanlış bilgi) · **Yüksek** · **Orta** · **Düşük**

| # | Ekran | Sorun (çiftçinin ağzından) | Tür | Önem | Önerilen değişiklik |
|---|---|---|---|---|---|
| 1 | Bayi POS → çiftçi Borcum/Ambar | "Bayi satışı yaptı ama bende 'Bayiniz henüz güncellemedi' yazıyor." POS satışı çiftçiye **otomatik düşmedi**. Bayi sonradan müşteri kartını açınca panel sessizce eşitledi, ancak o zaman geldi. Sebep: `FarmerSyncService` `customers/{id}.farmerId` alanına bakıyor, davet akışında bu alanı **hiçbir kod yazmıyor** (yalnız seed elle yazıyor, `scripts/emulator/seed.mjs:681`). Gerçek davetle bağlanan her çiftçide 8.7 çalışmıyor. | hata | **Kritik** | `farmer-sync.service.ts`: `farmerId` yoksa `findLinkForCustomer(tenantId, customerId)` ile bağlantıyı doğrudan arasın. Ya da bayi tarafı bağlantıyı ilk gördüğünde (Çiftçiler sayfası / müşteri kartı) `customers.farmerId`'yi yazsın. Bunu yakalayacak bir test ekleyin: seed'siz davetle bağlan, POS'ta sat, ambar dolsun. |
| 2 | Borcum → bayi detayı | "3 taksit yaptık; 29 Kasım'da 2.143 TL, sonra Aralık, Ocak. Uygulamada sadece toplam 6.430 var. Ne zaman ne ödeyeceğim?" Vade/taksit planı ve gecikme bilgisi **hiç yok**. Bayi ekranında bunların hepsi var. | eksik özellik | **Kritik** | `farmerLinks` eşitlemesine `nextDue {date, amount}`, `overdue` ve taksit listesi eklensin (`firestore-dealer.repository.ts` `syncCustomerToFarmer`). `debts.page.ts`'te en üstte "Sıradaki ödeme: 29 Kasım — 2.143,33 ₺", altında taksit listesi olsun. Ana sayfadaki borç kartında da sıradaki vade görünsün. |
| 3 | Borcum → Alışverişler | Tarih "30 / E / k / i / m / 2 / 0 / 2 / 6" diye **harf harf alt alta** yazılıyor. Hem 360 hem 390 genişlikte böyle. | görsel/hata | **Yüksek** | `debts.page.ts:94-95`: tarih `min-w-0 flex-1`, fiş no `shrink-0` olduğu için uzun fiş no ("Fiş S-20261030-130608-AGAO-XLS") tarihi eziyor. Fiş no ikinci satıra alınsın veya `truncate min-w-0` yapılsın, tarihe `shrink-0 whitespace-nowrap` verilsin. %125 yazıda bu sayfa yatay da kayıyor (scrollWidth 405 > 360). |
| 4 | Tüm çiftçi alanı | "Bayi öneri yazdı, satış yaptı; ben uygulamayı kapatıp açana kadar hiçbir şey değişmedi." Veriler **canlı güncellenmiyor**, aşağı çekip yenileme yok, bildirim yok. Öneri ancak tam yeniden yüklemeden sonra göründü. | eksik özellik | **Yüksek** | `farmer-store.service.ts`: links/purchases/recommendations için `onSnapshot` dinleyicisi (en azından ana sayfaya dönüşte ve `visibilitychange`'de yeniden yükleme) ve "Yenile" düğmesi eklensin. Alt menüde "Bayim" sekmesine yeni öneri için rozet konsun. |
| 5 | İzinler / Ayarlar | "'Bayim bana hatırlatma gönderebilir' dedim, hiçbir hatırlatma gelmedi." Bildirim izni alınıyor ama **arkasında bir özellik yok** (farmer klasöründe Notification/FCM kodu yok). Bu, olmayan bir hizmete rıza almak oluyor. | eksik özellik/hukuki | **Yüksek** | Özellik gelene kadar bu kutuyu gizleyin veya "(yakında)" yazın. V4'te (FCM / uygulama içi bildirim) bağlansın. |
| 6 | Ambarım | Amonyum Sülfat (gübre) satırında "E-reçete: RX2026103001" yazıyor. Gübreye reçete olmaz. Bu, satıştaki ilacın reçete numarası. | hata/hukuki | **Yüksek** | `firestore-dealer.repository.ts:252` `str(it['prescriptionNo']) ?? str(s['prescriptionNo'])` → satış düzeyindeki numaraya yalnız `requiresPrescription` olan kalemde düşülsün. |
| 7 | Ambarım | "Mankozeb'i deftere işledim, ambardan **tamamen kayboldu**. GTS'si, SKT'si, reçete no'su da gitti." Ana sayfa "Ambarım 2 ürün" diyor, ambar 1 ürün gösteriyor. | UX/hata | Orta | `barn.page.ts:67` `remaining > 0` filtresi yerine biten ürünleri "Biten / kullanılan" katlanır bölümünde gösterin (kayıt, denetim ve iade için gerekli). Ana sayfa sayacı ambarla aynı kuralı kullansın. |
| 8 | Kayıt ekle → Ne kadar? | "8 çuval attım, '0,067 çuval/dekar' yazdı. Bu ne demek?" Dekar başına hesap anlamsız birimle çıkıyor. Çiftçi "dekara kaç kilo" diye düşünür. Ayrıca birim her yerde "cuval" (ç yok). | UX | Orta | `dose.util.ts`: ürün adından/üründen çuval ağırlığı biliniyorsa (50 kg) kg/da gösterilsin ("= 3,3 kg/dekar"). `units.ts`'te görünen etiket "çuval" olsun (kod değeri `cuval` kalabilir), EN çevirisi "sack". |
| 9 | Kayıt ekle (3/3) | Ambarda ürün varken varsayılan seçim "Başka ürün (yazın)". Öneriden gelen kayıtta birim boş geliyor, Kaydet'e basınca "Miktarın birimini seçin" hatası çıkıyor. | UX | Orta | `log-form.page.ts`: ambarda uygun ürün varsa ilki (öneride geçen ürün) seçili gelsin. Öneri/ambar kaleminin birimi (`adet`/`kg`) otomatik seçilsin. |
| 10 | Davet / kayıt ekranı | Sayfa 360 genişlikte ~2.000 px uzun (2,7 ekran). "Hesabımı aç" düğmesi gri, ama **neden** basılmadığını söylemiyor: onay kutusu iki ekran yukarıda kaldı. Hata mesajı ("numara eşleşmiyor") düğmenin altında, ekranın dışında. | UX | Yüksek | `invite.page.ts`: düğmeyi devre dışı bırakmak yerine basınca eksik adımı söyleyip ona kaydırın ("Önce yukarıdaki onay kutusunu işaretleyin"). Rıza onayını hesap formunun hemen üstüne taşıyın. Hata çıkınca `scrollIntoView` kullanın. "Aydınlatma metni / açık rıza" yanında tek cümlelik sade açıklama olsun. |
| 11 | Davet → ilk açılış | Kayıttan sonra ana sayfa **ortadan** açıldı ("KAYIT EKLE" yarım görünüyor). Sayfalar arası geçişte kaydırma yeri sıfırlanmıyor. Kaydırma kabı `app-root`, Angular'ın `scrollPositionRestoration`'ı ise yalnız `window`'u sıfırlar. | hata | Orta | `farmer-layout.component.ts`: `NavigationEnd`'de kaydırma kabını `scrollTop = 0` yapın (ya da kaydırmayı `window`'a bırakın). |
| 12 | Çiftçi girişi | Yanlış PIN'de yalnız "Telefon veya şifre hatalı" çıkıyor. "Şifremi unuttum" bağlantısı yok. Ne yapacağım ekranın altında, küçük gri yazıda ("bayinizden yeni davet isteyin"). | UX | Orta | `login.page.ts`: hata kutusunun içine "Şifrenizi mi unuttunuz? Bayinizi arayın, size yeni link göndersin. Kayıtlarınız kaybolmaz." yazın, bayi telefonu/WhatsApp düğmesi koyun. |
| 13 | Çiftçi girişi (güvenlik/performans) | Bir yanlış PIN denemesi konsolda **5 ayrı** Auth hatası üretiyor (1 `wrong-password` + 4 `user-not-found`). Giriş her slot e-postasını sırayla deniyor. Zayıf internette yavaş. Firebase hız sınırına 5 kat hızlı takılır, hesap kilitlenir. | performans/güvenlik | Orta | `farmer-auth.service.ts:60`: `wrong-password` (veya `invalid-credential`) gelince döngüyü kesin. Ya da telefon → aktif slot eşlemesini `farmers` / bir `phoneIndex` dokümanından okuyup tek deneme yapın. |
| 14 | Tanıtım turu | "Sadece 4 adım" yazıyor, sayaç "1/5". Defter adımında "ÜKD (ürün kayıt defteri)" yazıyor, doğrusu **Üretici Kayıt Defteri**. | içerik/hukuki | Orta | `core/onboarding/onboarding.i18n.ts:83,85`: "5 adım" veya sayaçtan karşılama adımını çıkarın; "ÜKD (Üretici Kayıt Defteri)". |
| 15 | Ekim kaydı | Tarih kutusuna tıklayınca açılan takvim altındaki "Beklenen hasat" kutusunu kapatıyor. Kapattıktan hemen sonraki dokunuş da boşa gidiyor (iki kez denemem gerekti, bir ekim kaydı bu yüzden kaydedilmedi). 360 genişlikte "Hasat edildi" düğmesi kenara dayanıyor. | UX | Orta | `ui-date-field`: mobilde takvimi alt sayfa (bottom sheet) olarak açın veya yalnız takvim simgesiyle açın. Elle yazma serbest kalsın. Durum düğmeleri 360'ta 2+1 satıra insin. |
| 16 | Tarla ekle | Ürünü tarla eklerken soramıyor: önce tarla, sonra ayrı ekranda "Ekim ekle". 3 tarla için ~30 dokunuş. Konum yalnız "Şu an buradayım (GPS)" ile alınıyor, yani tarladayken. Sonuç "37.57310, 32.77450" diye ham sayı, harita yok. İl/İlçe/Köy her tarlada baştan yazılıyor, bayideki "Çumra" bilgisi gelmiyor. | UX | Orta | `field-form.page.ts`: "Ne ekili?" ürün seçimini (isteğe bağlı) aynı forma koyup sezonu birlikte oluşturun. Son girilen il/ilçe/köy ve müşteri kartındaki köy önceden dolsun. Konumu küçük harita önizlemesiyle gösterin, "Haritada işaretle" seçeneği ekleyin. |
| 17 | Hava kartı | Saat saat sayılar var (15°, rüzgar 3, 💧0) ama "**bugün ilaçlamaya uygun mu?**" diye tek bir özet yok. Yeşil/sarı/kırmızı kutuların ne demek olduğu yazmıyor. Yalnız 12 saat var, yarın sabah yok. Rüzgar simgesi küçük ve anlaşılmıyor. Belgede söz verilen 48 saatlik şerit yok. | UX/eksik özellik | Orta | `weather-card.component.ts`: üstte tek satır özet ("Bugün 13–17 arası rüzgar düşük, yağış yok"; karar dili korunarak). Renk açıklaması, "Yarın sabah" bölümü (en az 24–48 saat) ve "km/s" birimi kutunun içinde olsun. |
| 18 | Öneri ekranı | Öneri net ve okunur. Ama "15 dekara ne kadar ilaç, ne kadar su?" sorusunun cevabı yok, "Bayiyi ara / soru sor" düğmesi yok. Öneri 14 gün hasat bekleme diyor, benim beklenen hasadım 5 Kasım; öneri ekranında bu çakışma uyarısı yok (deftere işlerken çıkıyor). Bayi tarafı da öneri yazarken çiftçinin paylaşılan hasat tarihine karşı uyarmıyor. | eksik özellik | Orta | `recommendations.page.ts`: bağlı tarlanın beklenen hasadıyla PHI çakışması uyarısı ve bayiyi arama/WhatsApp düğmesi. Toplam miktar hesabı yalnız yetkilinin yazdığı doz × alan aritmetiği olarak, "hesap bayinizin dozuna göredir" notuyla eklenebilir (öneri üretmez). `recommendation-dialog.component.ts`: paylaşılan sezonun beklenen hasadı < bugün + PHI ise uyarı. |
| 19 | Bağlantıyı kopar | Onay metni "Bayi artık bilgilerinizi göremez" diyor. Ama **benim de borcumu, aldıklarımı göremeyeceğimi** ve geri bağlanmak için yeni davet gerektiğini söylemiyor. Kopardıktan sonra "Bağlantı kopuk" yazıyor ama "yeniden bağlan" yolu yok. Borcum hâlâ var, bunu da söylemeli. Ayrıca "Bağlantıyı kopar" düğmesi "Kaydet"in hemen yanında. | UX/hukuki | Orta | `farmer.i18n.ts` `revokeConfirm`: "Borcunuzu ve aldıklarınızı da artık burada göremezsiniz. Bayideki borcunuz silinmez. Tekrar bağlanmak için bayinizden yeni davet isteyin." Düğmeyi ayrı "Tehlikeli işlemler" bölümüne taşıyın. Native `confirm()` yerine uygulama içi onay penceresi kullanın (Tauri/Android WebView'de native confirm sorunlu olabilir; `settings.page.ts:163,181`, `logbook.page.ts:82`, `field-form.page.ts:121`). |
| 20 | Bayi Çiftçiler sayfası (koparınca) | Bağlantıyı koparan Hüseyin "Bağlı çiftçiler" listesinde duruyor, izin rozetleri hâlâ yeşil (Tarlalar/Defter/Bildirim). "Bağlı çiftçi: 2" sayısıyla liste uyuşmuyor. Öneri hâlâ "Geçerli". | UX | Düşük | `farmers.page.ts`: koparanları ayrı "Bağlantıyı koparanlar" bölümüne alın (i18n anahtarı `revokedTitle` zaten var), rozetleri gizleyin. |
| 21 | %125 yazı boyutu | Alt menü "Ana s…", "Tarlal…" diye kesiliyor, başlık "Tarım Market …" oluyor. Hava kutuları sabit 60 px, "13:00" taşıyor. Ayrıca çiftçi ayarlarında **yazı büyüt** seçeneği yok (bayi tarafında var). | görsel/eksik özellik | Orta | `farmer-layout.component.ts` alt menüde ikon + kısa etiket (ya da 2 satır), `weather-card` kutularında `min-w-[60px]`. Çiftçi Ayarlar'a bayideki yazı ölçeği seçeneğini (Normal/Büyük/Çok büyük) ekleyin. |
| 22 | Ayarlar → Görünüm | Koyu temadayken düğmede "Açık" yazıyor ve `aria-pressed=true`. "Açık" = ışık mı, açık/kapalı mı? Ekran okuyucu için de ters. "Sistem gibi" seçeneği yok. | UX/erişilebilirlik | Düşük | İki seçenekli segment: "☀️ Gündüz / 🌙 Gece" (+ "Telefon gibi"), `aria-pressed` seçili olanı göstersin. |
| 23 | Hesap → Bilgilerim | İki ayrı "Kaydet" düğmesi var (profil ve izinler). İl/İlçe/Köy boş geliyor, bayide "Çumra" kayıtlı. | UX | Düşük | Bayideki köy/ilçe davetle `farmers` dokümanına aktarılsın. İzin değişikliği anında kaydedilsin (toggle), tek Kaydet kalsın. |
| 24 | Borcum / tutarlar | Para "₺6.430,00" diye yazılıyor, bayi fişi "6.430,00 ₺". İlacın fiyatı yok (doğru), ama satırlar toplamı tutmuyor (6.100 + ? = 6.430). Not var ama küçük. | UX | Düşük | Tek para biçimi ("6.430,00 ₺"). İlaç satırına fiyat yerine "tutar toplamda" etiketi koyun. |
| 25 | Bitki ikonları | Şeker pancarı listede 🟫 kahverengi kare, ekim kartında 🟣 mor daire. Gübre için 🧴 (losyon şişesi), ilaç için 💧. | görsel | Düşük | `crops.ts` ve kayıt türü ikonları: pancar için tutarlı bir SVG, gübre için çuval ikonu. |
| 26 | İngilizce | "1 recommendations", birimler ("cuval", "adet") çevrilmemiş, kullanıcının yazdığı Türkçe metinler doğal olarak Türkçe kalıyor. | i18n | Düşük | `newRecs` için tekil/çoğul, birim etiketleri i18n'e. |
| 27 | Çiftçi oturumu (konsol) | Her açılışta bayi `AuthService` çiftçi için de çalışıyor: `tenants dokümanı kontrol edilemedi` ve `Eski profil alanları tamamlanamadı` **permission-denied** uyarıları. Zayıf internette boşa iki istek gidiyor. | performans | Düşük | Core auth servisi `accountType === 'farmer'` ise tenant/profil tamamlama adımlarını atlasın. |
| 28 | Bayi öneri penceresi | Esc tuşu yarım doldurulmuş öneri formunu uyarısız kapatıp siliyor. E-reçete numarası yazıldıktan sonra da "e-reçete numarası zorunlu" kırmızı uyarısı kalıyor. Kaydet ~15 sn döndü (arka plan sekmesi etkisi olabilir, kayıt oluştu). | UX (bayi) | Düşük | `recommendation-dialog.component.ts`: kirli formda kapatma onayı, uyarıyı değer girilince temizleme. |
| 29 | Bayi panelinde defter | Tarla paylaşımı kapalıyken son kayıtlar "30 Ekim 2026 ·" diye sonda boş ayraçla görünüyor. | görsel (bayi) | Düşük | `farmer-customer-panel.component.ts`: tarla adı yoksa ayracı yazmayın. |
| 30 | Çevrimdışı | `offline` olayında üstte sarı "İnternet yok — kayıtlarınız telefonda saklanıyor" bandı anlaşılır. **Gerçek** çevrimdışı kayıt ve geri eşitleme bu ortamda denenemedi (iframe/emulator, ağ kesilemedi). Service worker yok (8.11): uygulama kapalıyken internetsiz **açılmaz**. Tarlada sinyal yoksa bu çiftçi için kritik. Başlıktaki "• ☁" eşitleme simgesi çok küçük ve anlamı belli değil. | eksik özellik/performans | Yüksek | 8.11'deki planı (yalnız `/ciftci` için SW) uygulayın. Android Chrome'da uçak modu testi yapın. Simgeye metin ekleyin ("Gönderildi ✓" / "3 kayıt bekliyor"). |

---

## Beğendiklerim

- **Hasat bekleme uyarısı** çok iyi: ilaç kaydı girerken ve ana sayfada kırmızı kutuda "Bu ilaçtan sonra 14 gün hasat
  yapmayın · En erken hasat: 13 Kasım · Dikkat: beklenen hasat (5 Kasım) bu tarihten önce!" Okuması kolay, kaynağı
  yazıyor (bayinin ürün kartı / bayideki yetkilinin önerisi).
- **Kayıt ekle** sihirbazı (1/3 – 2/3 – 3/3) koca, renkli düğmelerle: İLAÇ / GÜBRE / SULAMA / ÇAPA / EKİM. "Bugün / Dün"
  düğmeleri, tarla seçince ekimin ve alanın kendiliğinden gelmesi pratik.
- **Bayinin önerisi** ekranı güven veriyor: kimin yazdığı, yetki belge no, e-reçete no, doz, uygulama aralığı, not.
  "Uyguladım, deftere işle" tek dokunuşla kaydı doldurdu.
- **Ambarım**: bayiden aldığım ilacın GTS/karekodu, e-reçete no'su ve SKT'si görünüyor. Denetimde işe yarar.
- Ürün seçimi (Buğday, Şeker pancarı, Domates…) resimli ve büyük. Tarla listesinde "120 dekar · Kuru" gibi kısa bilgi.
- İzinler tek tek seçiliyor, isteğe bağlı olanlar **varsayılan kapalı**. Sonradan Ayarlar'dan değiştirilebiliyor,
  bayi tarafında da anında "Çiftçi bu bilgiyi paylaşmıyor" oluyor.
- Davet linki WhatsApp mesajıyla hazır geliyor. Ad önceden dolu, telefonun son 4 hanesi ipucu olarak var.
- "Oku" (sesli okuma) düğmesi gözlüklü biri için iyi bir fikir.
- 360 px'te (normal yazıda) borç detayı dışında yatay kayma yok. Dokunma hedefleri çoğunlukla 56–60 px.

---

## Bayime ne söylerdim

- "Borcumu buradan görmek güzel. **Taksitleri, ne zaman ne ödeyeceğimi** de göster, hasatta kaç para hazırlayacağımı bileyim.
  Vadesi yaklaşınca bir haber versin, ben de dükkâna gelirim."
- "Satış yapınca hemen bende görünsün; sizin ekranı açmanızı beklemesin (1 numaralı hata)."
- "Mühendis bey öneri yazınca telefonuma bir ses gelsin. Yoksa bakmayı unuturum."
- "Tarlalarımı, ekim tarihlerimi görmenize itirazım yok. Ama karşılığında bana 'hangi gübreyi ne zaman alayım' diye
  sezon başında haber verin, ön sipariş vereyim (gübre/tohum için; ilaç için değil, biliyorum)."
- İlişkiye katkısı: Bu uygulama bayiyle aramdaki **güveni** artırır (borç şeffaf, reçete kayıtlı, kimin yazdığı belli).
  Bayi için de tahsilatı kolaylaştırır. Ancak taksit/vade görünmezse ve veriler gecikirse çiftçi yine bayiyi arar,
  uygulamanın bayiye sağladığı fayda da kaybolur.

---

## Hukuki kısıtlara uyum gözlemi

| Kural | Gözlem | Durum |
|---|---|---|
| Uygulama ilaç/doz önermez | Çiftçi tarafında hiçbir yerde uygulamanın kendi önerisi yok. Doz yalnız bayi yetkilisinin önerisinde ve çiftçinin kendi girdiğinde var. Hava kartı "Karar sizin; ürün etiketindeki koşullar önceliklidir" diyor, "uygun" demiyor. | ✅ Uyumlu |
| Öneriyi yalnız yetkili yazar | Bayi öneri penceresinde "yetkili kişi olarak ben yazıyorum" onayı zorunlu. Yazan, yetki belge no, reçeteli üründe e-reçete no zorunlu. Çiftçide yazanın adı ve belge no'su görünüyor. | ✅ Uyumlu |
| Çiftçide BKÜ kataloğu / fiyat / sipariş yok | Katalog ve sipariş yok. Ambar ve borçta **ilaç fiyatı gizli** ("Bitki koruma ürünlerinde fiyat uygulamada gösterilmez"), gübre fiyatı görünüyor. Sızıntı görülmedi. | ✅ Uyumlu |
| Defter resmî ÜKD değildir | Defter, kayıt formu, ana sayfa ve Ayarlar'da "Resmî Üretici Kayıt Defteri'nin (ÜKD) yerine geçmez" + "3 gün içinde ÜKD'ye girin" hatırlatması var. **Ancak tanıtım turunda "ÜKD (ürün kayıt defteri)" yanlış açılımı** var (bulgu 14). | ⚠️ Düzeltilmeli |
| Reçete bilgisinin doğruluğu | Gübre kalemine ilacın e-reçete numarası yazılıyor (bulgu 6). Yanlış belge bilgisi denetimde sorun çıkarır. | ⚠️ Düzeltilmeli |
| KVKK açık rıza | İzinler ayrı ayrı, isteğe bağlılar varsayılan kapalı, sürüm + tarih saklanıyor. Ancak "hatırlatma" iznine karşılık gelen bir özellik yok (bulgu 5). Aydınlatma metni "taslak — hukuk onayı bekliyor" (8.12 açık). | ⚠️ Kısmen |

---

## Konsol hataları

Çiftçi origin'i (`ciftci.localhost:4463`), oturum boyunca:

- **ERROR ×5 (tek yanlış PIN denemesinde):** `FirebaseError: Firebase: Error (auth/wrong-password)` ×1 +
  `(auth/user-not-found)` ×4. Kaynak: `farmer-auth.service.ts:60` slot döngüsü. Hatalar yakalanmasına rağmen
  zone.js konsoluna ERROR olarak düşüyor (bulgu 13).
- **WARN (her uygulama açılışında, ×5):** `tenants dokümanı kontrol edilemedi FirebaseError: [code=permission-denied]` ve
  `Eski profil alanları tamamlanamadı (yeni kurallarda beklenen) … PERMISSION_DENIED … 'update' @ L147 / L433`.
  Bayi auth akışı çiftçi oturumunda gereksiz çalışıyor (bulgu 27).
- Bayi sekmesinde (`localhost:4463`) izlenen süre boyunca hata yok.
- Uygulama hatası (NG0…) veya yakalanmamış istisna görülmedi.

## Test ortamı notları / sınırlar

- Gerçek ağ kesintisi (uçak modu) ve servis çalışanı davranışı denenemedi; `navigator.onLine=false` + `offline` olayı ile
  yalnız gösterge doğrulandı.
- GPS, iframe içinde `navigator.geolocation` taklidiyle (Çumra koordinatı) verildi; gerçek izin istemi denenmedi.
- Native `confirm()` diyalogları tetiklenmedi; iframe'de `confirm` taklit edilip metni kaydedildi.
- "Oku" (sesli okuma) düğmesinin sesi dinlenemedi.
- Emulator'de oluşan veri: müşteri `Hüseyin Kaya` (fd8rgANYIzKE7bO9pRku), farmerId `R2xaTIuLhWCjjH3rDbMq`, 3 tarla,
  3 ekim, 3 defter kaydı, 1 veresiye satış (S-20261030-130608-AGAO-XLS, 6.430 ₺, 3 taksit), 1 öneri (RX2026103002).
  Bağlantı test sonunda **koparıldı** (`status: revoked`).
