import { ChangeDetectionStrategy, Component, computed, forwardRef, input, model, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePicker, DatePickerModule } from 'primeng/datepicker';

/** `ui-date-field` değeri: Date (varsayılan) ya da `valueType="iso"` iken "yyyy-mm-dd" metni. */
export type DateFieldValue = Date | string | null;

let nextId = 0;

/** "2026-10-27" → yerel gün (00:00). Date gelirse aynen. Geçersizse null. */
export function parseDateFieldValue(v: DateFieldValue | undefined): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Date → "yyyy-mm-dd" (yerel gün). */
export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Yerel gün başı (00:00:00.000) ya da `endOfDay` ise gün sonu (23:59:59.999). */
export function normalizeDay(d: Date, endOfDay = false): Date {
  return endOfDay
    ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
    : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function coarsePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Uygulamanın TEK tarih girişi: PrimeNG DatePicker sarmalayıcı.
 * - Türkçe takvim (primeng-locale.ts), `dd.mm.yyyy`, panel `appendTo="body"`.
 * - Dokunmatik cihazda (pointer: coarse) `touchUI` (tam ekran takvim, klavye açılmaz).
 * - Değer yerel güne normalize edilir: 00:00, `endOfDay` ise 23:59:59.999 (filtre "bitiş" alanları).
 * - `valueType="iso"`: değer "yyyy-mm-dd" metni (eski `<input type="date">` modelleri için).
 * - Hem `ControlValueAccessor` (formControlName / ngModel) hem signal `[(value)]` ile çalışır.
 *
 * ```html
 * <ui-date-field inputId="pf-date" [label]="t().purchases.documentDate" [(value)]="documentDate" />
 * <ui-date-field inputId="pf-exp" formControlName="expiry" [min]="today" [error]="expiryError()" />
 * <ui-date-field inputId="to" [(value)]="to" endOfDay [clearable]="false" />
 * ```
 */
@Component({
  selector: 'ui-date-field',
  standalone: true,
  imports: [FormsModule, DatePickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateFieldComponent), multi: true }],
  host: { class: 'flex min-w-0 flex-col gap-1.5', '(keydown.escape)': 'onEscape($event)' },
  template: `
    @if (label()) {
      <label [for]="id()" [class]="labelClass() || 'text-sm font-semibold text-fg-secondary'">{{ label() }}</label>
    }
    <p-datepicker [inputId]="id()" [ngModel]="picked()" (ngModelChange)="onPick($event)" (onBlur)="touched()" (onClose)="touched()"
      dateFormat="dd.mm.yy" [showIcon]="true" [showButtonBar]="clearable()" [showClear]="clearable() && !!picked() && !isDisabled()"
      [touchUI]="touch" [readonlyInput]="touch" appendTo="body"
      [minDate]="minDate()" [maxDate]="maxDate()" [disabled]="isDisabled()" [invalid]="!!error() || invalid()"
      [placeholder]="placeholder() || 'gg.aa.yyyy'" [ariaLabel]="label() ? undefined : ariaLabel()"
      [fluid]="true" styleClass="w-full" inputStyleClass="w-full min-w-0" />
    @if (error()) {
      <p class="m-0 text-xs text-danger-text" role="alert" [id]="id() + '-err'">{{ error() }}</p>
    }
  `,
})
export class DateFieldComponent implements ControlValueAccessor {
  /** Signal iki yönlü bağlama: `[(value)]="sig"`. */
  readonly value = model<DateFieldValue>(null);
  readonly label = input<string>('');
  /** Etiket sınıfı (verilmezse standart form etiketi). `sr-only` ile gizlenebilir. */
  readonly labelClass = input<string>('');
  /** `<input>` id'si (label `for`). Verilmezse otomatik. */
  readonly inputId = input<string>('');
  readonly placeholder = input<string>('');
  /** Etiketsiz kullanımda erişilebilir ad. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly min = input<DateFieldValue | undefined>(undefined);
  readonly max = input<DateFieldValue | undefined>(undefined);
  /** Temizle (×) ve "Bugün / Temizle" çubuğu. */
  readonly clearable = input(true);
  /** Çıkan Date'i gün sonuna (23:59:59.999) çek — "bitiş" filtreleri için. */
  readonly endOfDay = input(false, { transform: (v: boolean | string) => v === '' || v === true || v === 'true' });
  /** 'date' (varsayılan) → Date | null; 'iso' → "yyyy-mm-dd" | ''. */
  readonly valueType = input<'date' | 'iso'>('date');
  /** Hata metni (alanı kırmızı yapar ve altında gösterilir). */
  readonly error = input<string | null | undefined>(null);
  readonly invalid = input(false);
  readonly disabled = input(false);

  readonly touch = coarsePointer();
  private readonly picker = viewChild(DatePicker);
  private readonly autoId = `ui-date-${++nextId}`;
  private readonly cvaDisabled = signal(false);
  private onChange: (v: DateFieldValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly id = computed(() => this.inputId() || this.autoId);
  readonly picked = computed(() => parseDateFieldValue(this.value()));
  readonly minDate = computed(() => { const d = parseDateFieldValue(this.min() ?? null); return d ? normalizeDay(d) : null; });
  readonly maxDate = computed(() => { const d = parseDateFieldValue(this.max() ?? null); return d ? normalizeDay(d, true) : null; });
  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  onPick(d: Date | string | null): void {
    const date = d instanceof Date && !Number.isNaN(d.getTime()) ? normalizeDay(d, this.endOfDay()) : null;
    const out: DateFieldValue = this.valueType() === 'iso' ? (date ? toIsoDay(date) : '') : date;
    this.value.set(out);
    this.onChange(out);
  }

  touched(): void {
    this.onTouched();
  }

  /**
   * Y19: takvim açıkken Esc yalnız takvimi kapatsın. DatePicker Esc'te paneli kapatıp `preventDefault` yapar;
   * olay yukarı (document) çıkarsa çevreleyen p-dialog da kapanıyordu (formdaki her şey gidiyordu).
   */
  onEscape(event: Event): void {
    if (event.defaultPrevented) event.stopPropagation();
  }

  /** Açık takvim panelini kapatır (panel body'ye eklendiği için dialog kapanınca asılı kalmasın). */
  close(): void {
    this.picker()?.hideOverlay();
  }

  // ---- ControlValueAccessor ----
  writeValue(v: DateFieldValue): void {
    this.value.set(v ?? null);
  }

  registerOnChange(fn: (v: DateFieldValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
  }
}
