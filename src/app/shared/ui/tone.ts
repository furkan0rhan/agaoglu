/**
 * Ortak renk tonları. Sınıf adları burada TAM yazılır ki Tailwind tarayıcısı bulsun
 * (dinamik `'bg-' + tone` birleştirmesi YAPMAYIN).
 *
 * v2: yumuşak zemin üstündeki metin `-text` tokenlarıyla (AA kontrast, iki temada).
 */
export type UiTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/** Yumuşak zemin + tonlu metin (ikon karesi, rozet, pill). */
export const TONE_SOFT: Record<UiTone, string> = {
  neutral: 'bg-neutral-soft text-neutral-text',
  brand: 'bg-brand-soft text-brand-text',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-info-soft text-info-text',
};

/** Tonlu kenarlık. */
export const TONE_BORDER: Record<UiTone, string> = {
  neutral: 'border-neutral-line',
  brand: 'border-brand-line',
  accent: 'border-accent-line',
  success: 'border-success-line',
  warning: 'border-warning-line',
  danger: 'border-danger-line',
  info: 'border-info-line',
};

/** Sadece metin rengi (yüzey üstünde). */
export const TONE_TEXT: Record<UiTone, string> = {
  neutral: 'text-fg',
  brand: 'text-brand-text',
  accent: 'text-accent-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  info: 'text-info-text',
};

/** Dolu zemin + kontrast metin (rozet sayacı, birincil ikon buton). */
export const TONE_SOLID: Record<UiTone, string> = {
  neutral: 'bg-fg text-fg-inverse',
  brand: 'bg-brand text-brand-contrast',
  accent: 'bg-accent text-accent-contrast',
  success: 'bg-success text-fg-inverse',
  warning: 'bg-warning text-fg-inverse',
  danger: 'bg-danger text-fg-inverse',
  info: 'bg-info text-fg-inverse',
};

/** Tonlu blok (durum kartı): yumuşak zemin + tonlu kenarlık. `ui-tinted`: içteki soft pill'lere halka (_components.scss). */
export const TONE_TINT: Record<UiTone, string> = {
  neutral: 'bg-surface-muted border-line ui-tinted',
  brand: 'bg-brand-soft border-brand-line ui-tinted',
  accent: 'bg-accent-soft border-accent-line ui-tinted',
  success: 'bg-success-soft border-success-line ui-tinted',
  warning: 'bg-warning-soft border-warning-line ui-tinted',
  danger: 'bg-danger-soft border-danger-line ui-tinted',
  info: 'bg-info-soft border-info-line ui-tinted',
};
