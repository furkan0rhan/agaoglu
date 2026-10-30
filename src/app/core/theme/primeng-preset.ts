import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Tarım Market PrimeNG preset'i (Aura tabanlı) — tasarım v2 "Saha / Komuta".
 *
 * - Ana renk: zümrüt. Açık temada dolu buton `primary.700` (#047857, beyaz metinle 5.5:1),
 *   koyu temada `primary.400` + koyu metin.
 * - Yüzeyler / kenarlıklar / metin `src/styles/_tokens.scss` CSS değişkenlerine bağlı; açık (kâğıt)
 *   ve koyu (kömür) tema tek yerden yönetilir. Overlay'ler opak (cam yok).
 * - Ölçüler: input/select 44px, buton 42px (lg 52px), yarıçap 8px (form), kart 10px, dialog 12px.
 * - Başlık şeridi (dialog), tablo başlığı ve 44px alt sınırları token karşılığı olmadığı için
 *   `src/styles/_primeng.scss` içinde.
 */

const emerald = {
  50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981',
  600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22',
};

/** Kâğıt (açık tema) nötr ölçeği. */
const paper = {
  0: '#ffffff', 50: '#faf8f3', 100: '#f1eee6', 200: '#e8e4d9', 300: '#c9c2b2', 400: '#9c9789',
  500: '#62685c', 600: '#454a41', 700: '#33372f', 800: '#252822', 900: '#1b1e19', 950: '#10120f',
};

/** Kömür (koyu tema) nötr ölçeği. */
const charcoal = {
  0: '#ffffff', 50: '#ecebe4', 100: '#d9d8cf', 200: '#c3c4b9', 300: '#9fa296', 400: '#7b7f73',
  500: '#5a5f56', 600: '#454b44', 700: '#2f342f', 800: '#212521', 900: '#1a1d1a', 950: '#121412',
};

/** `primary` gibi davranan buton renk şeması (success severity'si de marka rengini kullansın). */
const brandButton = {
  background: '{primary.color}',
  hoverBackground: '{primary.hover.color}',
  activeBackground: '{primary.active.color}',
  borderColor: '{primary.color}',
  hoverBorderColor: '{primary.hover.color}',
  activeBorderColor: '{primary.active.color}',
  color: '{primary.contrast.color}',
  hoverColor: '{primary.contrast.color}',
  activeColor: '{primary.contrast.color}',
  focusRing: { color: '{primary.color}', shadow: 'none' },
};

/** `warn` severity'si = vurgu (yanık turuncu) — satış/sepet aksiyonları. */
const accentButton = {
  background: 'var(--accent)', hoverBackground: 'var(--accent-hover)', activeBackground: 'var(--accent-hover)',
  borderColor: 'var(--accent)', hoverBorderColor: 'var(--accent-hover)', activeBorderColor: 'var(--accent-hover)',
  color: 'var(--accent-contrast)', hoverColor: 'var(--accent-contrast)', activeColor: 'var(--accent-contrast)',
  focusRing: { color: 'var(--accent)', shadow: 'none' },
};

/** `secondary` = C'nin düz "btn"i: kâğıt zemin, belirgin kenarlık. */
const plainButton = {
  background: 'var(--surface)', hoverBackground: 'var(--surface-muted)', activeBackground: 'var(--surface-strong)',
  borderColor: 'var(--border-strong)', hoverBorderColor: 'var(--border-strong)', activeBorderColor: 'var(--border-strong)',
  color: 'var(--text-primary)', hoverColor: 'var(--text-primary)', activeColor: 'var(--text-primary)',
  focusRing: { color: 'var(--brand)', shadow: 'none' },
};

/** Toast: opak kart + tonlu metin (sol renk şeridi _primeng.scss'te). */
function toastTone(tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral') {
  return {
    background: 'var(--surface-raised)',
    borderColor: `var(--${tone}-line)`,
    color: `var(--${tone}-text)`,
    detailColor: 'var(--text-secondary)',
    shadow: 'var(--shadow-overlay)',
    closeButton: { hoverBackground: 'var(--surface-hover)', focusRing: { color: 'var(--brand)', shadow: 'none' } },
  };
}
const toastScheme = {
  info: toastTone('info'), success: toastTone('success'), warn: toastTone('warning'), error: toastTone('danger'),
  secondary: toastTone('neutral'), contrast: toastTone('neutral'),
};

/** İki temada ortak (değerler CSS değişkeni olduğu için tema bağımsız). */
const sharedScheme = {
  formField: {
    background: 'var(--field-bg)',
    disabledBackground: 'var(--surface-muted)',
    filledBackground: 'var(--surface-muted)',
    filledHoverBackground: 'var(--surface-muted)',
    filledFocusBackground: 'var(--surface-muted)',
    borderColor: 'var(--border-strong)',
    hoverBorderColor: 'var(--text-muted)',
    focusBorderColor: 'var(--brand)',
    color: 'var(--text-primary)',
    disabledColor: 'var(--text-muted)',
    placeholderColor: 'var(--text-muted)',
    iconColor: 'var(--text-muted)',
    floatLabelColor: 'var(--text-muted)',
    floatLabelFocusColor: 'var(--brand-text)',
    shadow: 'none',
  },
  text: { color: 'var(--text-primary)', hoverColor: 'var(--text-primary)', mutedColor: 'var(--text-muted)', hoverMutedColor: 'var(--text-secondary)' },
  content: { background: 'var(--surface)', hoverBackground: 'var(--surface-hover)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', hoverColor: 'var(--text-primary)' },
  overlay: {
    select: { background: 'var(--surface-raised)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' },
    popover: { background: 'var(--surface-raised)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' },
    modal: { background: 'var(--surface-raised)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' },
  },
  list: {
    option: {
      focusBackground: 'var(--surface-hover)', selectedBackground: 'var(--brand-soft)', selectedFocusBackground: 'var(--brand-soft-hover)',
      color: 'var(--text-primary)', focusColor: 'var(--text-primary)', selectedColor: 'var(--brand-text)', selectedFocusColor: 'var(--brand-text)',
      icon: { color: 'var(--text-muted)', focusColor: 'var(--text-secondary)' },
    },
    optionGroup: { background: 'transparent', color: 'var(--text-muted)' },
  },
  navigation: {
    item: {
      focusBackground: 'var(--surface-hover)', activeBackground: 'var(--brand-soft)',
      color: 'var(--text-primary)', focusColor: 'var(--text-primary)', activeColor: 'var(--brand-text)',
      icon: { color: 'var(--text-muted)', focusColor: 'var(--text-secondary)', activeColor: 'var(--brand-text)' },
    },
    submenuLabel: { background: 'transparent', color: 'var(--text-muted)' },
    submenuIcon: { color: 'var(--text-muted)', focusColor: 'var(--text-secondary)', activeColor: 'var(--brand-text)' },
  },
};

export const TarimPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  },
  semantic: {
    primary: emerald,
    focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '2px', shadow: 'none' },
    formField: {
      paddingX: '0.75rem',
      paddingY: '0.625rem',
      borderRadius: '{border.radius.md}',
      focusRing: {
        width: '0', style: 'none', color: 'transparent', offset: '0',
        shadow: 'var(--focus-ring)',
      },
    },
    content: { borderRadius: '{border.radius.lg}' },
    overlay: {
      select: { borderRadius: '{border.radius.lg}', shadow: 'var(--shadow-overlay)' },
      popover: { borderRadius: '{border.radius.lg}', padding: '0.875rem', shadow: 'var(--shadow-overlay)' },
      modal: { borderRadius: '{border.radius.xl}', padding: '1.25rem', shadow: 'var(--shadow-overlay)' },
      navigation: { shadow: 'var(--shadow-overlay)' },
    },
    list: { padding: '0.375rem', option: { borderRadius: '{border.radius.sm}', padding: '0.625rem 0.75rem' } },
    navigation: { item: { borderRadius: '{border.radius.sm}', padding: '0.625rem 0.75rem' } },
    colorScheme: {
      light: {
        surface: paper,
        primary: { color: '{primary.700}', contrastColor: '#ffffff', hoverColor: '{primary.800}', activeColor: '{primary.900}' },
        highlight: { background: 'var(--brand-soft)', focusBackground: 'var(--brand-soft-hover)', color: 'var(--brand-text)', focusColor: 'var(--brand-text)' },
        mask: { background: 'rgba(22, 33, 28, 0.45)', color: '{surface.200}' },
        ...sharedScheme,
      },
      dark: {
        surface: charcoal,
        primary: { color: '{primary.400}', contrastColor: '#04281d', hoverColor: '{primary.300}', activeColor: '{primary.200}' },
        highlight: { background: 'var(--brand-soft)', focusBackground: 'var(--brand-soft-hover)', color: 'var(--brand-text)', focusColor: 'var(--brand-text)' },
        mask: { background: 'rgba(0, 0, 0, 0.62)', color: '{surface.200}' },
        ...sharedScheme,
      },
    },
  },
  components: {
    button: {
      root: {
        label: { fontWeight: '600' }, iconOnlyWidth: '2.75rem', paddingY: '0.625rem', paddingX: '1rem', gap: '0.5rem',
        lg: { fontSize: '1rem', paddingX: '1.25rem', paddingY: '0.875rem' },
        sm: { fontSize: '0.875rem', paddingX: '0.75rem', paddingY: '0.375rem' },
      },
      colorScheme: {
        light: { root: { success: brandButton, warn: accentButton, secondary: plainButton } },
        dark: { root: { success: brandButton, warn: accentButton, secondary: plainButton } },
      },
    },
    card: {
      root: { background: 'var(--surface)', borderRadius: '{border.radius.lg}', shadow: 'none', color: 'var(--text-primary)' },
      title: { fontSize: '1rem', fontWeight: '700' },
      subtitle: { color: 'var(--text-muted)' },
    },
    tag: {
      root: { fontSize: '0.78rem', fontWeight: '600', padding: '0.1875rem 0.5625rem', borderRadius: '{border.radius.sm}', gap: '0.375rem' },
      colorScheme: {
        light: {
          primary: { background: 'var(--brand-soft)', color: 'var(--brand-text)' },
          secondary: { background: 'var(--surface-strong)', color: 'var(--text-secondary)' },
          success: { background: 'var(--success-soft)', color: 'var(--success-text)' },
          info: { background: 'var(--info-soft)', color: 'var(--info-text)' },
          warn: { background: 'var(--warning-soft)', color: 'var(--warning-text)' },
          danger: { background: 'var(--danger-soft)', color: 'var(--danger-text)' },
          contrast: { background: 'var(--text-primary)', color: 'var(--surface)' },
        },
        dark: {
          primary: { background: 'var(--brand-soft)', color: 'var(--brand-text)' },
          secondary: { background: 'var(--surface-strong)', color: 'var(--text-secondary)' },
          success: { background: 'var(--success-soft)', color: 'var(--success-text)' },
          info: { background: 'var(--info-soft)', color: 'var(--info-text)' },
          warn: { background: 'var(--warning-soft)', color: 'var(--warning-text)' },
          danger: { background: 'var(--danger-soft)', color: 'var(--danger-text)' },
          contrast: { background: 'var(--text-primary)', color: 'var(--surface)' },
        },
      },
    },
    chip: {
      root: { borderRadius: '{border.radius.md}', paddingY: '0.375rem' },
      colorScheme: {
        light: { root: { background: 'var(--surface-muted)', color: 'var(--text-primary)' } },
        dark: { root: { background: 'var(--surface-muted)', color: 'var(--text-primary)' } },
      },
    },
    datatable: {
      headerCell: {
        background: 'var(--table-head-bg)', hoverBackground: 'var(--surface-strong)', selectedBackground: 'var(--brand-soft)',
        color: 'var(--text-muted)', hoverColor: 'var(--text-secondary)', selectedColor: 'var(--brand-text)',
        borderColor: 'var(--border-subtle)', padding: '0.625rem 0.875rem',
      },
      header: { background: 'var(--surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', padding: '0.75rem 1rem' },
      row: {
        background: 'var(--surface)', hoverBackground: 'var(--surface-hover)', selectedBackground: 'var(--brand-soft)',
        color: 'var(--text-primary)', hoverColor: 'var(--text-primary)', selectedColor: 'var(--brand-text)',
      },
      bodyCell: { borderColor: 'var(--border-subtle)', padding: '0.5625rem 0.875rem' },
      footerCell: { background: 'var(--surface-muted)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
      footer: { background: 'var(--surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' },
      sortIcon: { color: 'var(--text-muted)', hoverColor: 'var(--text-secondary)' },
      colorScheme: {
        light: { root: { borderColor: 'var(--border-subtle)' }, row: { stripedBackground: 'var(--surface-muted)' } },
        dark: { root: { borderColor: 'var(--border-subtle)' }, row: { stripedBackground: 'var(--surface-muted)' } },
      },
    },
    paginator: {
      root: { background: 'var(--surface)', color: 'var(--text-secondary)' },
      navButton: {
        selectedBackground: 'var(--brand-soft)', selectedColor: 'var(--brand-text)',
        hoverBackground: 'var(--surface-hover)', color: 'var(--text-secondary)', hoverColor: 'var(--text-primary)',
        width: '2.5rem', height: '2.5rem', borderRadius: '{border.radius.md}',
      },
    },
    datepicker: {
      panel: { background: 'var(--surface-raised)', borderColor: 'var(--border-strong)', borderRadius: '{border.radius.lg}', shadow: 'var(--shadow-overlay)' },
      header: { background: 'transparent', borderColor: 'var(--border-subtle)' },
      selectMonth: { hoverBackground: 'var(--surface-hover)' },
      selectYear: { hoverBackground: 'var(--surface-hover)' },
      date: {
        hoverBackground: 'var(--surface-hover)', selectedBackground: '{primary.color}', selectedColor: '{primary.contrast.color}',
        rangeSelectedBackground: 'var(--brand-soft)', rangeSelectedColor: 'var(--brand-text)', borderRadius: '{border.radius.sm}',
      },
      today: { background: 'var(--surface-strong)', color: 'var(--text-primary)' },
      dropdown: { background: 'var(--surface-muted)', hoverBackground: 'var(--surface-strong)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' },
    },
    select: {
      root: { background: 'var(--field-bg)' },
      dropdown: { color: 'var(--text-muted)' },
    },
    dialog: {
      root: { borderRadius: '{border.radius.xl}' },
      header: { padding: '0.875rem 1.25rem', gap: '0.5rem' },
      title: { fontSize: '1.0625rem', fontWeight: '800' },
      content: { padding: '0 1.25rem 1.25rem' },
      footer: { padding: '0 1.25rem 1.25rem', gap: '0.5rem' },
    },
    toast: {
      root: { borderRadius: '{border.radius.lg}', blur: '0px' },
      summary: { fontWeight: '700' },
      colorScheme: { light: toastScheme, dark: toastScheme },
    },
    tooltip: {
      colorScheme: {
        light: { root: { background: 'var(--text-primary)', color: 'var(--surface)' } },
        dark: { root: { background: 'var(--text-primary)', color: 'var(--surface)' } },
      },
    },
    toggleswitch: {
      root: { width: '2.875rem', height: '1.625rem' },
      handle: { size: '1.25rem' },
      colorScheme: {
        light: { root: { background: 'var(--border-strong)', hoverBackground: 'var(--text-muted)' }, handle: { background: '#ffffff', hoverBackground: '#ffffff' } },
        dark: { root: { background: 'var(--border-strong)', hoverBackground: 'var(--text-muted)' }, handle: { background: '#ecebe4', hoverBackground: '#ffffff', checkedBackground: '#04281d', checkedHoverBackground: '#04281d' } },
      },
    },
  },
});
