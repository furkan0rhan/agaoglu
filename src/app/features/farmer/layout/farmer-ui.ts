import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApplicationType } from '../../../shared/models/farmer.model';
import { LangService } from '../../../core/i18n/lang.service';
import { TONE_SOFT, TONE_TINT, UiTone } from '../../../shared/ui/tone';
import { FarmerStore } from '../services/farmer-store.service';

/**
 * Çiftçi arayüzü ortakları — tasarım v2 "Saha / Komuta" (sıcak kâğıt / kömür tokenları, düz kartlar).
 * Çiftçi ilkeleri (docs/CIFTCI-MODULU.md §6.1): büyük dokunma alanı (≥56px), ≥18px yazı, ikon + kısa kelime,
 * güneş altında okunur yüksek kontrast; cam/gölge yok. Renkler yalnız token sınıflarıyla (koyu tema otomatik).
 */

export const TYPE_ICON: Record<ApplicationType, string> = {
  pesticide: '💧', fertilizer: '🧴', irrigation: '🚿', tillage: '🚜', sowing: '🌱', other: '✏️',
};

/** Uygulama tipi rengi (ilaç = kırmızı, gübre = mavi, ekim = yeşil …). */
export const TYPE_UI_TONE: Record<ApplicationType, UiTone> = {
  pesticide: 'danger', fertilizer: 'info', irrigation: 'brand', tillage: 'warning', sowing: 'success', other: 'neutral',
};

/** Tip seçici / etiket: tonlu zemin + kenarlık (TONE_TINT) + okunur metin. */
export const TYPE_TONE: Record<ApplicationType, string> = {
  pesticide: `${TONE_TINT.danger} text-danger-text`,
  fertilizer: `${TONE_TINT.info} text-info-text`,
  irrigation: `${TONE_TINT.brand} text-brand-text`,
  tillage: `${TONE_TINT.warning} text-warning-text`,
  sowing: `${TONE_TINT.success} text-success-text`,
  other: `${TONE_TINT.neutral} text-fg`,
};

/** Defter kartının sol renk şeridi (tip). Sınıflar literal: Tailwind kaynakta tarar. */
export const TYPE_STRIPE: Record<ApplicationType, string> = {
  pesticide: 'shadow-[inset_5px_0_0_var(--danger)]',
  fertilizer: 'shadow-[inset_5px_0_0_var(--info)]',
  irrigation: 'shadow-[inset_5px_0_0_var(--brand)]',
  tillage: 'shadow-[inset_5px_0_0_var(--warning)]',
  sowing: 'shadow-[inset_5px_0_0_var(--success)]',
  other: 'shadow-[inset_5px_0_0_var(--border-strong)]',
};

/** İkon karesi (yumuşak zemin + tonlu ikon). */
export function typeTile(t: ApplicationType): string {
  return TONE_SOFT[TYPE_UI_TONE[t]];
}

export const PRODUCT_TYPE_ICON: Record<string, string> = { bitki_koruma: '💧', gubre: '🧴', tohum: '🌱', fide: '🌿', diger: '📦' };
export const PRODUCT_TYPE_TONE: Record<string, UiTone> = { bitki_koruma: 'danger', gubre: 'info', tohum: 'success', fide: 'success', diger: 'neutral' };

/** Sınıf sabitleri (Tailwind bunları kaynakta tarar). */
export const F = {
  card: 'block rounded-token-2xl border border-line bg-surface p-4 text-fg',
  /** Kart başlık şeridi (C "ch") — kartın içinde en üstte, `-m-4 mb-3` ile kenara yaslanır. */
  head: '-mx-4 -mt-4 mb-3 flex min-h-[52px] items-center gap-2.5 rounded-t-token-2xl border-b border-line bg-surface-muted bg-furrow px-4 py-2',
  btn: 'flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-token-xl border-0 bg-brand px-4 font-display text-18 font-bold text-brand-contrast no-underline shadow-brand transition-[filter] hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:shadow-none ui-btn-disabled-soft',
  btn2: 'flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-token-xl border border-line-strong bg-surface px-4 font-display text-18 font-bold text-fg no-underline transition-colors hover:bg-surface-muted active:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-50',
  btnDanger: 'flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-token-xl border border-danger-line bg-danger-soft px-4 font-display text-18 font-bold text-danger-text transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50',
  input: 'block min-h-[56px] w-full rounded-token-lg border border-line-strong bg-surface px-3.5 text-18 text-fg placeholder:text-fg-muted focus:border-brand focus:shadow-focus focus:outline-none',
  label: 'mb-1.5 block text-16 font-semibold text-fg-secondary',
  /** `ui-date-field` (ortak bileşen) host'una: içteki girişi çiftçi ölçüsüne (56px, 18px yazı) büyütür. */
  date: '[&_input]:min-h-[56px] [&_input]:text-18 [&_.p-datepicker-dropdown]:min-w-[56px] [&_.p-datepicker-input-icon-container]:text-18',
  /** Hatırlatma / dikkat (sarı). */
  note: 'rounded-token-lg border border-warning-line bg-warning-soft px-3.5 py-3 text-16 leading-snug text-warning-text',
  /** Hukuki bilgi: görünür ama sade (nötr kâğıt kutu). */
  legal: 'rounded-token-lg border border-line bg-surface-muted px-3.5 py-3 text-15 leading-snug text-fg-secondary',
  danger: 'rounded-token-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-16 font-semibold text-danger-text',
  muted: 'text-16 text-fg-muted',
  h2: 'm-0 font-display text-20 font-extrabold text-fg',
  /** Seçim düğmesi (seçili / seçili değil). */
  choice: 'min-h-[56px] cursor-pointer rounded-token-lg border px-3 text-18 font-bold transition-colors',
  on: 'border-brand bg-brand text-brand-contrast',
  off: 'border-line-strong bg-surface text-fg hover:bg-surface-muted',
  /** 44px ikon karesi */
  tile: 'grid h-11 w-11 shrink-0 place-items-center rounded-token-lg text-22',
  row: 'flex min-h-[56px] cursor-pointer items-center gap-3 rounded-token-lg border border-line-strong bg-surface p-3 text-fg has-[:checked]:border-brand has-[:checked]:bg-brand-soft',
  radio: 'h-6 w-6 shrink-0 accent-[var(--brand)]',
  chevron: 'pi pi-chevron-right shrink-0 text-16 text-fg-muted',
} as const;

export const TILE_TONE = TONE_SOFT;

export function fmtDate(d: Date | null | undefined, lang: string): string {
  if (!d) return '—';
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtShortDate(d: Date | null | undefined, lang: string): string {
  if (!d) return '—';
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
}

export function fmtMoney(v: number | null | undefined, lang: string): string {
  return (v ?? 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
}

export function fmtNum(v: number | null | undefined, lang: string): string {
  return v == null ? '—' : v.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 3 });
}

/** <input type="date"> değeri ↔ Date (yerel gün) */
export function toInputDate(d: Date | null | undefined): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromInputDate(v: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Sayfa başlığı: geri + başlık (büyük, sade, Manrope). */
@Component({
  selector: 'app-farmer-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex items-center gap-2.5">
      @if (back()) {
        <a [routerLink]="back()" class="grid h-12 w-12 shrink-0 place-items-center rounded-token-lg border border-line-strong bg-surface text-fg no-underline hover:bg-surface-muted"
           [attr.aria-label]="t().farmer.common.back"><i class="pi pi-arrow-left text-18" aria-hidden="true"></i></a>
      }
      <h1 class="m-0 min-w-0 flex-1 truncate font-display text-24 font-extrabold leading-tight text-fg">{{ title() }}</h1>
      <ng-content />
    </div>
  `,
})
export class FarmerHeaderComponent {
  readonly title = input.required<string>();
  readonly back = input<string | null>(null);
  readonly t = inject(LangService).t;
  readonly location = inject(Location);
}

/**
 * "Yenile" düğmesi (başlığın sağına, `<app-farmer-header>` içine konur): bayinin yeni yazdıklarını (satış, borç,
 * öneri) sayfayı kapatıp açmadan getirir (rapor #4). 48px dokunma alanı, dönen ikon.
 */
@Component({
  selector: 'app-farmer-refresh',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="store.refresh()" [disabled]="store.refreshing()" [attr.aria-busy]="store.refreshing()"
      [attr.aria-label]="compact() ? t().farmer.common.refresh : null" [title]="t().farmer.common.refresh"
      class="flex min-h-[48px] min-w-[48px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-token-lg border border-line-strong bg-surface px-3 text-16 font-bold text-fg hover:bg-surface-muted disabled:cursor-wait">
      <i class="pi pi-refresh text-18" [class.pi-spin]="store.refreshing()" aria-hidden="true"></i>
      @if (!compact()) { <span>{{ store.refreshing() ? t().farmer.common.refreshing : t().farmer.common.refresh }}</span> }
    </button>
  `,
})
export class FarmerRefreshButtonComponent {
  /** Yalnız ikon (dar başlıklarda) */
  readonly compact = input(false);
  readonly store = inject(FarmerStore);
  readonly t = inject(LangService).t;
}
