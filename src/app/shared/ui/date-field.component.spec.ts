import { TestBed } from '@angular/core/testing';
import { DateFieldComponent, normalizeDay, parseDateFieldValue, toIsoDay } from './date-field.component';

describe('date-field yardımcıları', () => {
  it('parseDateFieldValue: iso metin → yerel gün, Date aynen, geçersiz → null', () => {
    expect(parseDateFieldValue('2026-10-27')).toEqual(new Date(2026, 9, 27));
    const d = new Date(2026, 0, 2, 13);
    expect(parseDateFieldValue(d)).toBe(d);
    expect(parseDateFieldValue('27.10.2026')).toBeNull();
    expect(parseDateFieldValue('')).toBeNull();
    expect(parseDateFieldValue(null)).toBeNull();
    expect(parseDateFieldValue(new Date('x'))).toBeNull();
  });

  it('toIsoDay / normalizeDay', () => {
    expect(toIsoDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(normalizeDay(new Date(2026, 0, 5, 15, 30))).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0));
    expect(normalizeDay(new Date(2026, 0, 5, 15, 30), true)).toEqual(new Date(2026, 0, 5, 23, 59, 59, 999));
  });
});

describe('DateFieldComponent', () => {
  function create() {
    TestBed.configureTestingModule({ imports: [DateFieldComponent] });
    const fixture = TestBed.createComponent(DateFieldComponent);
    fixture.componentRef.setInput('inputId', 'df-test');
    fixture.componentRef.setInput('label', 'Tarih');
    fixture.detectChanges();
    return fixture;
  }

  it('label input\'a bağlı', () => {
    const fixture = create();
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('df-test');
    expect(fixture.nativeElement.querySelector('input#df-test')).toBeTruthy();
  });

  it('seçim gün başına normalize edilir ve CVA onChange çağrılır', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const changes: unknown[] = [];
    c.registerOnChange(v => changes.push(v));
    c.onPick(new Date(2026, 9, 27, 14, 5));
    expect(c.value()).toEqual(new Date(2026, 9, 27));
    expect(changes).toEqual([new Date(2026, 9, 27)]);
  });

  it('endOfDay: gün sonu', () => {
    const fixture = create();
    fixture.componentRef.setInput('endOfDay', true);
    fixture.componentInstance.onPick(new Date(2026, 9, 27));
    expect(fixture.componentInstance.value()).toEqual(new Date(2026, 9, 27, 23, 59, 59, 999));
  });

  it('valueType=iso: "yyyy-mm-dd" ve temizlenince boş metin', () => {
    const fixture = create();
    fixture.componentRef.setInput('valueType', 'iso');
    const c = fixture.componentInstance;
    c.onPick(new Date(2026, 1, 3));
    expect(c.value()).toBe('2026-02-03');
    c.onPick(null);
    expect(c.value()).toBe('');
  });

  it('writeValue ve setDisabledState', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.writeValue('2026-10-01');
    expect(c.picked()).toEqual(new Date(2026, 9, 1));
    c.setDisabledState(true);
    expect(c.isDisabled()).toBe(true);
  });

  it('min/max gün sınırına çekilir; hata metni gösterilir', () => {
    const fixture = create();
    fixture.componentRef.setInput('min', '2026-10-01');
    fixture.componentRef.setInput('max', new Date(2026, 9, 31, 8));
    fixture.componentRef.setInput('error', 'Geçersiz');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.minDate()).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(c.maxDate()).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Geçersiz');
  });
});
