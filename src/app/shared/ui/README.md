# Ortak UI bileşenleri ve tasarım tokenları — v2 "Saha / Komuta"

Prototip (birebir referans): `docs/design/c-saha-komuta/index.html` — tarayıcıda açıp "Koyu tema",
"1366×768" ve "Telefon" düğmeleriyle bakın. B prototipinden (`docs/design/arsiv/b-bento-yumusak`) yalnız
dashboard'daki büyük ciro kartı ve POS hızlı para butonları alındı.

**Renk v3 "Adaçayı & Krem"** (30.10.2026, `docs/design/renk-secenekleri/index.html?v=v2`): koyu blok yok —
sidebar, mobil çubuklar, ciro kartı ve giriş paneli açık adaçayı; dolu pastel zeminlerde metin koyu mürekkep
(`text-brand-contrast`, `text-accent-contrast`, `text-fg-inverse`). Pastel dolgu (`text-brand`, `text-danger` …) METİN rengi olarak
kullanılmaz; her zaman `-text` tokenı.

**Tasarım dili:** açık adaçayı sidebar + krem kâğıt içerik; **düz, opak kartlar** (gölge yok,
1px kenarlık, 10px köşe); kart başlıklarında ince **tarla çizgili başlık şeridi**; Manrope başlık ve
rakamlar, Inter gövde; şeftali-kiremit = satış/sepet, adaçayı = marka/onay. Cam, blur, gradyan blob **YOK**.

## Kurallar
- Şablonda **hex renk yok**, **`style="..."` yok**. Renkler token sınıflarıyla (`bg-surface`, `text-fg-secondary`,
  `border-line` …). Sadece veriye bağlı tek değer (ör. `[style.width.%]="pct"`) serbest.
- Yumuşak zemin üstündeki metin `-text` tokenıyla: `bg-danger-soft text-danger-text` (AA, iki temada).
  Dolu renk (`bg-danger`) ikon/çubuk/nokta içindir; metin rengi olarak yalnız yüzey üstünde `text-danger-text`.
- Para/stok/adet: `class="num"` (Manrope + tabular) ya da `<ui-money>`. Büyük KPI rakamı: `num-xl`.
- **Yazı boyutu px YAZMAYIN** (`text-[13px]` ✗): Ayarlar > Görünüm > Yazı boyutu yalnız rem'i büyütür. İsimli adımlar
  `text-10 … text-28` (= o kadar px, rem karşılığı; yalnız font-size): 10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5,
  16, 17, 18, 19, 20, 22, 24, 26, 28. Diğerleri `text-[2.125rem]`. Dönüştürücü: `node scripts/codemods/px-to-rem-text.mjs`.
  Sabit genişlikli kutularda da (`w-[236px]` sidebar gibi) yazı taşıyorsa rem kullanın.
- Seçili segment `.seg-on` (tokenlar `--seg-on-*`); tonlu kart (`TONE_TINT` → `.ui-tinted`) içindeki soft pill'ler otomatik halkalı.
- Kontrast denetimi: `node scripts/contrast-check.mjs` (tüm `-soft`/`-text` ve dolu/gri çiftler, iki tema, AA).
- Dokunma hedefi ≥ 44px (`min-h-[44px]`, `.tap`, PrimeNG input zaten 44px, buton 42px; `size="large"` 52px).
- Etiketler: `<label for="x">` + `id="x"` (PrimeNG: `inputId="x"`). Sadece ikonlu buton: `<ui-icon-button>` (`ariaLabel` zorunlu).
- Koyu tema otomatik (`html.dark` altında tokenlar değişir) — `dark:` öneki gerekmez. Sidebar/mobil çubuklar
  `bg-side`, `text-side-*` (açıkta adaçayı, koyuda zeytin).
- `@for` içindeki her öğeye kart koymayın; uzun listede satırlar `.list-row` + `border-b border-line`.

İçe aktarma: `import { GlassCardComponent, PageHeaderComponent, ... } from '../../shared/ui';`

---

## Sayfa iskeleti

```html
<ui-page-header [title]="t().products.title" [subtitle]="count() + ' ürün'" backLink="/products">
  <p-button severity="secondary" icon="pi pi-download" label="Excel" />
  <p-button icon="pi pi-plus" [label]="t().common.new" routerLink="/products/new" />
</ui-page-header>

<div class="page-body">
  <!-- Özet şeridi / durum blokları -->
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    <ui-stat-card icon="pi-box" label="Toplam ürün" [value]="n" />
    <ui-stat-card icon="pi-exclamation-triangle" tone="danger" tinted label="Kritik stok" [value]="crit" />
  </div>

  <!-- Liste kartı: başlık şeridi + filtre + tablo -->
  <ui-glass-card title="Ürünler" icon="pi-box" padding="none" clip>
    <ui-segmented card-actions size="sm" [options]="views" [(value)]="view" ariaLabel="Görünüm" />
    <div class="flex flex-wrap gap-2 border-b border-line p-3 sm:px-4">…arama + çipler…</div>
    <p-table [value]="rows">…</p-table>
  </ui-glass-card>
</div>
```

- **Başlık kabukta:** ana kabuk içinde `ui-page-header`'ın `title`, `subtitle` ve `backLink`'i masaüstünde
  **topbar'a** (h1 + gri alt satır + geri oku), mobilde **üst çubuğa** taşınır (`PageTitleService`).
  Bileşenin kendisi yalnız **sağa yaslı aksiyon satırını** çizer; aksiyon yoksa yer kaplamaz.
  Alt başlık verilmezse topbar bugünün tarihini yazar. Kabuksuz yerlerde (superadmin) başlığı kendisi çizer.
  Kabuk içinde yerinde başlık gerekiyorsa `[hoist]="false"`.
- `.page-body` = `max-w-[1600px]`, yan boşluk mobil 12px / masaüstü 24px, dikey `gap` 12/16px.
- Tam yükseklik sayfalar (POS) `.page-body` yerine `flex h-full flex-col`; `main` zaten `flex-col overflow-y-auto`.
- Izgara: kart araları `gap-3 lg:gap-4`. İki sütun: `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`. Mobilde her şey tek sütun,
  durum blokları 2 sütun.

---

## Eski → yeni (v1 glassy → v2)

| v1 | v2 | Not |
|---|---|---|
| `ui-glass-card` (cam) | aynı seçici, **opak C kartı** | `title` → başlık şeridi. `variant` artık görünümü değiştirmez |
| `iconTone="info"` | `tone="info"` (yeni ad; eskisi çalışır) | ikon karesi tonu |
| — | `tinted` | bütün kart tonlu zemin (durum bloğu: gecikme, uyarı) |
| `ui-stat-card` (ikon üstte, cam) | C durum bloğu: 40px şerit (ikon + etiket) + büyük Manrope rakam | `highlight` = şerit/kenarlık tonlu, `tinted` = tüm blok tonlu, `trendLabel` |
| `ui-page-header` büyük başlık | başlık topbar'da; burada yalnız aksiyonlar | API aynı |
| `ui-status-badge` yuvarlak + kenarlık | 6px köşe "pill", kenarlıksız, 24px | API aynı |
| `ui-icon-button variant="glass"` | `variant="outline"` (kâğıt + kenarlık); `glass` aynı çizilir | |
| `ui-section` başlığı | küçük büyük harf etiket (menü grubu gibi) | |
| `ui-avatar variant="solid"` (gradyan) | açık adaçayı kare + koyu yeşil harf | |
| `.glass`, `.glass-strong`, `.surface-card` | opak kart (geriye uyum). Yenide `.ui-card` / `<ui-glass-card>` | |
| `bg-brand-gradient` | yalnız logo karesi | butonlarda düz `bg-brand` |
| `bg-accent-gradient` | düz `bg-accent` olarak çizilir | |
| `shadow-glass`, `backdrop-blur-*` | etkisiz (none / 0px) — kullanmayın | |
| `text-brand` (soft zemin üstünde) | `text-brand-text` | `TONE_SOFT` haritası güncellendi |
| `rounded-token-xl` (18px) | 10px (kart). `-2xl` 12px (dialog/sheet) | |
| `bg-surface-muted` iç kutu | aynı (#f2eee3 / #31332c) | |
| — | `bg-surface-strong` | nötr rozet, ilerleme izi |

## Dönüştürme kılavuzu (2. aşama sayfaları için)

1. **Başlık:** sayfanın en üstünde `<ui-page-header [title] [subtitle] [backLink]>` + aksiyonlar. Sayfada ayrı bir h1/başlık bandı bırakmayın.
2. **Kartlar:** her blok `<ui-glass-card title=… icon=… tone=…>`. Tablo/liste gömüyorsanız `padding="none" clip`
   (içinde açılır panel varsa `clip` vermeyin, PrimeNG panelleri zaten `appendTo="body"` olmalı).
3. **Başlık şeridinin sağı:** `card-actions` slot'u — "Tümü ›" bağlantısı (`text-13.5 font-semibold text-brand-text`),
   `ui-segmented`, küçük buton. Kart başlığının altına açıklama: `subtitle`.
4. **KPI / durum:** `ui-stat-card` (2×2 mobil, 4'lü masaüstü). Sorun varsa `tinted` + `tone="danger|warning"`; içine pill'ler (`ui-status-badge`).
5. **Özet şeridi** (C "sumstrip"): `ui-card grid grid-cols-2 lg:grid-cols-4` + hücreler `border-r border-line px-4 py-3`, ikon karesi `TONE_SOFT`.
6. **Tablo:** PrimeNG `p-table` otomatik C tablosu (40px büyük harf başlık, 52px satır, okunur hover). Elle tablo: dashboard'daki
   "Son satışlar" kalıbı. Para sütunu `text-right num font-extrabold`. Kritik satıra `shadow-[inset_3px_0_0_var(--danger)]`.
7. **Filtre çipleri** (C "chip"): 40px, `rounded-token-md border border-line-strong`; seçili `border-brand-line bg-brand-soft text-brand-text`.
   Tek seçimli dönem/görünüm için `ui-segmented`.
8. **Butonlar:** birincil `p-button` (adaçayı + koyu mürekkep), satış/sepet `severity="warn"` (şeftali), diğerleri `severity="secondary"` (düz kâğıt + kenarlık),
   ikincil metin `text`/`link`. Klavye kısayolu `<ui-kbd>F1</ui-kbd>` (dolu buton içinde `tone="inverse"`).
9. **Uyarı kutusu** (C "note/grant"): `rounded-token-lg border border-warning-line bg-warning-soft` + 40px dolu ikon karesi (`bg-warning text-fg-inverse`) + metin + düz buton. Örnek: dashboard yedek hatırlatması.
10. **Ayarlar:** kart başına bir konu; satırlar `ui-settings-row` (switch için `inline`), kurulum durumu `ui-progress-ring`.
11. **Boş durum:** `ui-empty-state` (kart içinde `compact`).
12. Her sayfayı **1366×768**, **390px** ve **koyu temada** kontrol edin. Sabit renk (`bg-white`, `text-gray-*`, `#…`) kalmasın.

---

## Bileşenler

### `ui-glass-card` (C kartı)
| input | tip | varsayılan |
|---|---|---|
| `title`, `subtitle`, `icon` (`pi-…`) | string | `''` |
| `tone` / `iconTone` (eski ad) | `UiTone` | `brand` |
| `padding` | `none \| sm \| md \| lg` | `md` (16px) |
| `clip` | attr | false — tablo gömerken köşe |
| `interactive` | attr | false — hover'da marka kenarlığı |
| `tinted` | attr | false — tüm kart `tone` yumuşak zemini |
| `variant` | `glass \| strong \| solid` | görünümü değiştirmez (geriye uyum) |

Slotlar: varsayılan, `[card-actions]` (şeridin sağı; yalnız `title` varsa), `[card-footer]`.
> `@if` içinde slot'a giden öğe tek kök olmalı (NG8011).

### `ui-page-header`
`title` (zorunlu), `subtitle`, `backLink`, `backLabel`, `icon`/`iconTone` (yalnız kabuksuz), `sticky`, `hoist` (true). Aksiyonlar içerik olarak.

### `ui-stat-card` (C durum bloğu)
`label` (zorunlu), `value`, `hint`, `icon`, `tone` (`brand`), `highlight`, `tinted` (attr), `loading`, `trend` (%; null gizli), `trendLabel`, `link`.
Slotlar: `[stat-badge]` (şeridin sağı), varsayılan (gövdenin altı: pill'ler).
```html
<ui-stat-card icon="pi-clock" tone="danger" tinted label="Gecikmiş alacak" [value]="x | currencyTr" hint="3 müşteri" link="/credit" />
```

### `ui-segmented` (yeni)
`options: {value, label, icon?}[]` (zorunlu), `[(value)]`, `ariaLabel`, `size` (`sm` 32px | `md` 36px), `block` (tam genişlik).
```html
<ui-segmented [options]="[{value: 7, label: '7G'}, {value: 14, label: '14G'}, {value: 30, label: '30G'}]" [(value)]="days" ariaLabel="Dönem" />
```

### `ui-date-field` (tek tarih girişi)
Uygulamadaki **tüm** tarih girişleri bu bileşendir — `<input type="date">` ya da doğrudan `p-datepicker` YAZMAYIN.
PrimeNG DatePicker sarmalayıcı: Türkçe takvim (`primeng-locale.ts`), `dd.mm.yyyy`, panel `appendTo="body"`,
dokunmatik cihazda (`pointer: coarse`) `touchUI` + salt-okunur input (klavye açılmaz).
- Bağlama: `formControlName` / `[(ngModel)]` (ControlValueAccessor) **veya** signal `[(value)]`.
- Değer: `Date | null`, yerel gün başına (00:00) normalize. `endOfDay` → 23:59:59.999 ("bitiş" filtreleri).
  `valueType="iso"` → `"yyyy-mm-dd"` metni (boşken `''`; eski string modeller için).
- `label` + `inputId` (`<label for>` bağlı; `inputId` yoksa otomatik), `labelClass` (ör. `sr-only`, küçük etiket),
  `ariaLabel` (etiketsiz, ör. tablo hücresi), `placeholder`, `min` / `max` (Date ya da iso), `clearable` (true: × + "Bugün / Temizle"),
  `error` (metin: kırmızı çerçeve + altta `role="alert"`), `invalid`, `disabled`.
- Saf yardımcılar: `parseDateFieldValue()`, `toIsoDay()`, `normalizeDay(d, endOfDay?)`.
```html
<ui-date-field inputId="pf-date" [label]="t().purchases.documentDate" [clearable]="false" [(value)]="documentDate" />
<ui-date-field inputId="pf-expiry" formControlName="expiryDateVal" [min]="today" [error]="expiryError()" />
<ui-date-field inputId="pu-to" [label]="t().sales.to" endOfDay [ngModel]="to()" (ngModelChange)="to.set($event)" />
```

### `ui-kbd` (yeni)
`<ui-kbd>F2</ui-kbd>`, dolu buton içinde `tone="inverse"`. Dekoratif — butona `aria-keyshortcuts="F2"` ekleyin.

### `ui-settings-row` (yeni)
`title` (zorunlu), `description`, `labelFor` (kontrol id → `<label for>`), `inline` (attr; mobilde de yan yana). Kontrol içerik olarak.
Kart içinde `padding="none"` ile alt alta dizin; çizgiler otomatik.

### `ui-progress-ring` (yeni)
`value` (0–100), `size` (56), `tone`, `showLabel` (true), `ariaLabel`.
```html
<ui-progress-ring [value]="80" ariaLabel="Kurulum yüzde 80 tamamlandı" />
```

### `ui-quick-cash` (yeni, B prototipi — POS)
`total`, `[(value)]` (alınan tutar), `label` ("Alınan:"), `exactLabel` ("Tam"), `count` (3). "Tam" + toplamın üstündeki
yuvarlak tutarlar (50/100/200/500/1000 adımları). `quickCashAmounts(total)` saf fonksiyon olarak da dışa açık.

### `ui-logo-mark` (yeni)
Zümrüt gradyan kare + filiz ikonu. `size` (px).

### `ui-empty-state`
`title` (zorunlu), `description`, `icon`, `tone`, `compact` (attr). Aksiyonlar içerik olarak.

### `ui-status-badge` (pill)
`tone`, `icon`, `dot` (attr), `size` (`sm` 20px | `md` 24px). `p-tag` yerine tercih edin.

### `ui-section`
`title`, `subtitle`; slot `[section-actions]`. Kart değildir; başlık küçük büyük harf etiket.

### `ui-icon-button`
`icon`, `ariaLabel` (**zorunlu**), `tone`, `variant` (`ghost|soft|solid|outline|glass`), `size` (`sm` 36 | `md` 44), `type`, `disabled`,
`pressed`, `badge`, `badgeTone`. Tıklama host üzerinde `(click)`.

### `ui-money`
`value`, `symbol` (true), `signed` (attr), `colorize` (attr: negatif `danger-text`, pozitif `success-text`).

### `ui-avatar` + `initialsOf()`
`name`, `size` (`sm|md|lg`), `tone` (`auto|brand|accent|neutral|info`), `variant` (`soft|solid`), `decorative`.

### `ui-auth-shell`
Solda açık adaçayı, tarla desenli tanıtım paneli, sağda kâğıt form. `title` (zorunlu), `subtitle`, `eyebrow`, `icon`. Slot `[auth-footer]`.

### `PageTitleService`
Kabuk ↔ `ui-page-header` köprüsü (`hosted()`, `current()`). Sayfalar doğrudan kullanmaz.

### `tone.ts`
`UiTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info'`; haritalar
`TONE_SOFT` (zemin + `-text`), `TONE_BORDER`, `TONE_TEXT`, `TONE_SOLID`, `TONE_TINT` (zemin + kenarlık).
Dinamik sınıf için bunları kullanın (`'bg-' + tone` Tailwind tarafından görülmez).

---

## Yardımcı CSS sınıfları (`src/styles/_components.scss`)
| sınıf | ne |
|---|---|
| `.ui-card` | opak kart (surface + 1px line + 10px) |
| `.card-head` (+ `.card-head-sm`, `.card-head-icon`) | tarla çizgili başlık şeridi (48px / 40px), 30px ikon karesi |
| `.field-dark` | tarla zemini — v3'te açık adaçayı `--side-bg` + `--furrow` (giriş paneli, ciro kartı, plan kartı; ad geriye uyum) |
| `.kbd` | klavye rozeti |
| `.eyebrow` | 11px büyük harf etiket (Manrope 700) |
| `.num` / `.num-xl` | Manrope tabular rakam / büyük KPI rakamı |
| `.font-display` | Manrope |
| `.list-row` | satır hover |
| `.page-body` | sayfa içerik kabı |
| `.tap` | min 44×44 |
| `.glass`, `.glass-strong`, `.surface-card` | **eski** — opak karta eşlendi |

## Tailwind token sınıfları (`tailwind.config.js`)
| Grup | Sınıflar |
|---|---|
| Metin | `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-fg-inverse` |
| Yüzey | `bg-page`, `bg-surface`, `bg-surface-raised`, `bg-surface-muted`, `bg-surface-hover`, `bg-surface-strong` |
| Kenarlık | `border-line`, `border-line-strong` (+ `bg-line` ayırıcı) |
| Marka | `bg-brand`, `text-brand-contrast`, `bg-brand-soft`, `text-brand-text`, `border-brand-line`, `hover:bg-brand-hover`, ölçek `brand-50..950` |
| Vurgu | `bg-accent`, `text-accent-contrast`, `bg-accent-soft`, `text-accent-text`, `border-accent-line`, ölçek `accent-50..950` |
| Durum | `bg-{success,warning,danger,info,neutral}` + `-soft` + `-line` + `-text` |
| Sidebar / ciro kartı | `bg-side`, `bg-side-2`, `border-side-line`, `text-side-text`, `text-side-muted`, `text-side-hi`, `bg-side-active`, `text-side-active-text`, `text-side-em`, `text-side-soft`, `bg-side-count`, `bg-side-count-alt`, `bg-sale text-sale-text` |
| Desen | `bg-furrow` (başlık şeridi çizgileri), `bg-side-pattern` |
| Yazı | `font-sans` (Inter), `font-display` (Manrope), `font-mono` |
| Yarıçap | `rounded-token-sm` 6 · `-md` 8 · `-lg` 10 · `-xl` 10 · `-2xl` 12 |
| Gölge | `shadow-overlay` (açılır katman), `shadow-focus`, `shadow-xs` |
| Ölçü | `pt-safe-t`, `pb-safe-b`, `h-topbar`, `h-mtop`, `h-bottom-nav`, `min-h-tap` |
| Z | `z-sticky`, `z-topbar`, `z-sidebar`, `z-nav`, `z-sheet-backdrop`, `z-sheet` |

Token renkleri CSS değişkeni olduğu için `/50` opaklık değiştiricisini desteklemez; `-soft` varyantlarını kullanın.

## Token değerleri (özet)
Renk v3 "Adaçayı & Krem". Tam liste: `src/styles/_tokens.scss` (prototipteki token tablosuyla birebir).

| | Açık (krem) | Koyu (zeytin-kömür) |
|---|---|---|
| `--bg-page` | `#f7f4ec` | `#22231e` |
| `--surface` / `-muted` / `-strong` | `#fffdf8` / `#f2eee3` / `#e6e0d2` | `#2a2b25` / `#31332c` / `#3e4036` |
| `--border-subtle` / `-strong` | `#e6e0d3` / `#cdc4b1` | `#3b3d34` / `#535649` |
| `--text-primary` / `-secondary` / `-muted` / `-inverse` | `#2a2c25` / `#4d5044` / `#5f6254` / `#1f241c` | `#eeebe0` / `#c9c6b8` / `#a8a597` / `#1d2119` |
| `--brand` / `-contrast` / `-soft` / `-text` | `#9ec6a2` / `#1b3822` / `#e7f0e2` / `#3a6140` | `#a8cfac` / `#1b3822` / `#34442f` / `#bcdcbd` |
| `--accent` / `-contrast` / `-soft` / `-text` | `#eab691` / `#47230e` / `#f9ece0` / `#8a4520` | `#ebbd9c` / `#47230e` / `#4a3a2d` / `#f0c6a7` |
| `--danger` / `-soft` / `-text` | `#e8a69b` / `#f9e6e1` / `#96392d` | `#eaa99f` / `#4c3330` / `#f2b8ae` |
| `--warning` / `-soft` / `-text` | `#ebca80` / `#f9f0d8` / `#714d12` | `#eccf8f` / `#47402a` / `#f0d69c` |
| `--info` / `-soft` / `-text` | `#a8c2db` / `#e8eff6` / `#36597c` | `#b0c8e0` / `#323c48` / `#c0d4e9` |
| `--side-bg` / `--side-2` / `--side-active` | `#edf0e4` / `#e2e8d8` / `#d3e5cc` | `#2a2d25` / `#33372d` / `#3d5137` |
| `--side-hi` (aktif çizgi, odak halkası) | `#6f9c76` | `#a8cfac` |
| `--side-count` / `-alt` (beyaz yazılı sayaç, bilerek doygun) | `#b2453a` / `#a2542a` | aynı |
| `--sale` / `--sale-text` | `#eab691` / `#47230e` | `#ebbd9c` / `#47230e` |
| `--chart-1..6` | `#7fae86 #86a6c9 #e09486 #e3a979 #b4a0cf #c9b46a` | `#9fcba6 #a3bedc #eba395 #edb88d #c5b2de #d8c47c` |

**Eski isimler (alias, korunuyor):** `--bg-surface`, `--bg-muted`, `--border`, `--border-mid`, `--nav-active-bg`, `--icon-bg`,
`--icon-color`, `--surface-glass*`, `--border-glass*`, `--blob-1..4` (şeffaf), `--blur-*` (0px), `--chart-1..6`, `--chart-grid`.

## PrimeNG
Preset: `src/app/core/theme/primeng-preset.ts`. Global `!important` override YAZMAYIN; preset'e token ekleyin, olmuyorsa `src/styles/_primeng.scss`.
- `severity` yok / `success` → adaçayı (koyu mürekkep metin); outlined/text/link → `--brand-text`; odak halkası `--side-hi`; `warn` → şeftali-kiremit (satış/sepet); `secondary` → düz kâğıt buton (C "btn"); `danger` kırmızı.
- Input/select 44px, buton 42px (`size="large"` 52px), form köşesi 8px; dialog 12px + başlık şeridi; select/datepicker/popover opak + `shadow-overlay`.
- Tablo: büyük harf 12.5px başlık `bg-surface-muted`, 52px satır, hover `surface-hover` (koyu temada okunur).
- Toast: opak kart + sol 4px renk şeridi. Tooltip: koyu (metin rengi) zemin.
- Türkçe yerelleştirme `LangService` ile dil değişince güncellenir.

## Kabuk (src/app/layout)
- `sidebar/` açık adaçayı menü; grup = `NavItem.group` (`ops | analysis | manage`, `nav-items.ts`). POS listede değil, şeftali "Hızlı Satış F2" butonunda.
  Sayaçlar: Ürünler = kritik stok (ProductStore), Veresiye = gecikmiş müşteri (`ShellStatusService`, dashboard doldurur).
- `topbar/` başlık + tarih, arama (Enter → Ürünler'de aranır, Ctrl+K odaklar), durum rozeti, `notification-bell`, tema/dil, kullanıcı menüsü.
- `main-layout/` mobil üst çubuk + alt nav + "Diğer" sheet; F2 → POS (POS içinde F2 = kart, POS yönetir); `<app-support-banner />` tek satır.
- Metinler: `layout/shell.i18n.ts` (`t().shell`), dashboard: `features/dashboard/home.i18n.ts` (`t().home`).
