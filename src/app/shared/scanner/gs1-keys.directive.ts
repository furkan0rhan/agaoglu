import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { GS } from './gs1';

/**
 * USB (klavye taklitli) okuyucular karekoddaki FNC1/GS ayırıcısını Ctrl+] tuşu olarak gönderir; tarayıcı bunu
 * input'a yazmaz ve değişken alanlar (parti no + seri no) birbirine yapışır. Bu yönerge o tuşu yakalayıp
 * imlecin olduğu yere GS (0x1D) yazar ve `input` olayı yayar (ngModel / formControl güncellenir).
 * Kullanım: `<input appGs1Keys ...>` ya da `<textarea appGs1Keys ...>`.
 */
@Directive({ selector: 'input[appGs1Keys], textarea[appGs1Keys]', standalone: true })
export class Gs1KeysDirective {
  private readonly el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);

  @HostListener('keydown', ['$event'])
  onKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    if (!isGsKey(e)) return;
    e.preventDefault();
    const input = this.el.nativeElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(GS, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** Ctrl+] (Türkçe Q klavyede aynı fiziksel tuş: Ctrl+Ü) ya da doğrudan GS karakteri. */
export function isGsKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  if (e.key === GS || e.key === 'GroupSeparator') return true;
  return e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'BracketRight' || e.key === ']');
}
