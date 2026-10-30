/** @type {import('tailwindcss').Config} */
/*
 * Tasarım v2 "Saha / Komuta" (docs/design/c-saha-komuta). Renkler src/styles/_tokens.scss içindeki CSS değişkenlerine bağlıdır; açık/koyu tema
 * otomatik. Ölçekli paletler (brand-50..950, accent-50..950) sabittir ve opaklık
 * değiştiricisini (`bg-brand-500/10`) destekler; token renkleri (`bg-surface`) desteklemez.
 * Kılavuz: src/app/shared/ui/README.md
 */
const v = (name) => `var(--${name})`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Eski (dönüştürülmemiş sayfalar kullanıyor)
        primary: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
          500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
        },
        brand: {
          DEFAULT: v('brand'), hover: v('brand-hover'), contrast: v('brand-contrast'),
          soft: v('brand-soft'), 'soft-hover': v('brand-soft-hover'), line: v('brand-line'), text: v('brand-text'),
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981',
          600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        accent: {
          DEFAULT: v('accent'), hover: v('accent-hover'), contrast: v('accent-contrast'),
          soft: v('accent-soft'), line: v('accent-line'), text: v('accent-text'),
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316',
          600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407',
        },
        success: { DEFAULT: v('success'), soft: v('success-soft'), line: v('success-line'), text: v('success-text') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft'), line: v('warning-line'), text: v('warning-text') },
        danger:  { DEFAULT: v('danger'),  soft: v('danger-soft'),  line: v('danger-line'),  text: v('danger-text') },
        info:    { DEFAULT: v('info'),    soft: v('info-soft'),    line: v('info-line'),    text: v('info-text') },
        neutral: { DEFAULT: v('neutral'), soft: v('neutral-soft'), line: v('neutral-line'), text: v('neutral-text') },
        // Kalıcı koyu sidebar / mobil çubuklar (her iki temada koyu)
        side: {
          DEFAULT: v('side-bg'), 2: v('side-2'), line: v('side-line'), text: v('side-text'),
          muted: v('side-muted'), hi: v('side-hi'), active: v('side-active'), 'active-text': v('side-active-text'),
          avatar: v('side-avatar'), 'avatar-text': v('side-avatar-text'),
          count: v('side-count'), 'count-alt': v('side-count-alt'), em: v('side-em'), soft: v('side-soft'),
          danger: v('side-danger'), 'danger-soft': v('side-danger-soft'),
        },
        sale: { DEFAULT: v('sale'), text: v('sale-text') },

        page: v('bg-page'),
        surface: {
          DEFAULT: v('surface'), raised: v('surface-raised'), muted: v('surface-muted'),
          hover: v('surface-hover'), overlay: v('surface-overlay'), strong: v('surface-strong'),
        },
        glass: { DEFAULT: v('surface-glass'), strong: v('surface-glass-strong') },
        fg: {
          DEFAULT: v('text-primary'), secondary: v('text-secondary'), muted: v('text-muted'),
          inverse: v('text-inverse'),
        },
        line: { DEFAULT: v('border-subtle'), strong: v('border-strong'), glass: v('border-glass') },
      },
      // Yazı boyutu: px adımlarının rem karşılığı (16px taban) → Ayarlar > Görünüm > Yazı boyutu (--font-scale)
      // bunları da büyütür. `text-13` = 13px (0.8125rem); yalnız font-size, line-height vermez.
      // `text-[Npx]` YAZMAYIN; dönüştürücü: scripts/codemods/px-to-rem-text.mjs (NAMED_STEPS ile aynı liste).
      fontSize: Object.fromEntries(
        [10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 19, 20, 22, 24, 26, 28].map((px) => [String(px), `${px / 16}rem`]),
      ),
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Manrope Variable', 'Manrope', 'Inter Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'token-sm': v('radius-sm'),
        'token-md': v('radius-md'),
        'token-lg': v('radius-lg'),
        'token-xl': v('radius-xl'),
        'token-2xl': v('radius-2xl'),
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0,0,0,0.06)',
        card: '0 4px 24px rgba(0,0,0,0.08)',
        xs: v('shadow-xs'),
        glass: v('shadow-glass'),
        'glass-lg': v('shadow-glass-lg'),
        overlay: v('shadow-overlay'),
        brand: v('shadow-brand'),
        accent: v('shadow-accent'),
        focus: v('focus-ring'),
      },
      backgroundImage: {
        furrow: v('furrow-pattern'),
        'side-pattern': v('side-pattern'),
      },
      backdropBlur: {
        'glass-sm': v('blur-sm'),
        glass: v('blur-md'),
        'glass-lg': v('blur-lg'),
      },
      spacing: {
        'safe-t': v('safe-top'),
        'safe-b': v('safe-bottom'),
        topbar: v('topbar-h'),
        mtop: v('mtop-h'),
        'bottom-nav': v('bottom-nav-h'),
        tap: v('tap-min'),
      },
      minHeight: { tap: v('tap-min') },
      minWidth: { tap: v('tap-min') },
      zIndex: {
        sticky: v('z-sticky'),
        topbar: v('z-topbar'),
        sidebar: v('z-sidebar'),
        nav: v('z-nav'),
        'sheet-backdrop': v('z-sheet-backdrop'),
        sheet: v('z-sheet'),
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'sheet-up': 'sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
