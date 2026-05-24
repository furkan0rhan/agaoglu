import { Directive, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';

@Directive({
  selector: '[appBarcodeInput]',
  standalone: true,
})
export class BarcodeInputDirective implements OnDestroy {
  @Input() barcodeMinLength = 4;
  @Output() barcodeDetected = new EventEmitter<string>();

  private buffer = '';
  private lastKeyTime = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const activeTag = (document.activeElement as HTMLElement)?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    const now = Date.now();
    if (now - this.lastKeyTime > 300) this.buffer = '';
    this.lastKeyTime = now;

    if (event.key === 'Enter') {
      if (this.buffer.length >= this.barcodeMinLength) {
        this.barcodeDetected.emit(this.buffer);
      }
      this.buffer = '';
      return;
    }

    if (event.key.length === 1) this.buffer += event.key;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.buffer = ''), 500);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
