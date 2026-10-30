import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal,
} from '@angular/core';
import { DayPoint, niceMax } from './home-calc';

interface Bar { i: number; x: number; w: number; y: number; h: number; path: string; cls: string; label: string | null; labelBold: boolean }

/**
 * C "Satış Trendi": tek seri sütun grafiği, bugün turuncu, pazar soluk, kesikli ortalama çizgisi,
 * üzerine gelince ipucu. Gerçek piksel genişliğinde çizilir (ResizeObserver) — metin bozulmaz.
 */
@Component({
  selector: 'app-sales-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block px-3 pb-1.5 pt-2' },
  styles: [`
    .bar { fill: var(--brand); opacity: .88; transition: opacity .12s; }
    .bar.sun { opacity: .45; }
    .bar.today { fill: var(--accent); opacity: 1; }
    .bar.hov { opacity: 1; }
    .gl { stroke: var(--chart-grid); stroke-width: 1; }
    .ax { fill: var(--text-muted); font: 500 11.5px var(--font-sans); }
    .avg { stroke: var(--text-secondary); stroke-width: 1.5; stroke-dasharray: 4 4; }
    .dl { fill: var(--text-primary); font: 700 12px var(--font-display); }
  `],
  template: `
    @if (width() > 0) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        role="img" [attr.aria-label]="ariaLabel()" class="block">
        @for (g of grid(); track g.v) {
          <line class="gl" [attr.x1]="L" [attr.x2]="width() - R" [attr.y1]="g.y" [attr.y2]="g.y" />
          <text class="ax" [attr.x]="L - 8" [attr.y]="g.y + 4" text-anchor="end">{{ g.label }}</text>
        }
        @if (avgY() !== null) {
          <line class="avg" [attr.x1]="L" [attr.x2]="width() - R" [attr.y1]="avgY()" [attr.y2]="avgY()" />
        }
        @for (b of bars(); track b.i) {
          <path class="bar" [class]="b.cls" [class.hov]="hover() === b.i" [attr.d]="b.path" />
          @if (b.label) {
            <text class="ax" [attr.x]="b.x + b.w / 2" [attr.y]="height() - 8" text-anchor="middle"
              [style.font-weight]="b.labelBold ? 700 : null" [style.fill]="b.labelBold ? 'var(--accent-text)' : null">{{ b.label }}</text>
          }
        }
        @for (d of dataLabels(); track d.i) {
          <text class="dl" [attr.x]="d.x" [attr.y]="d.y" text-anchor="middle">{{ d.text }}</text>
        }
        @for (b of bars(); track b.i) {
          <rect [attr.x]="b.x - gap() / 2" [attr.y]="T" [attr.width]="b.w + gap()" [attr.height]="ih()" fill="transparent"
            (mouseenter)="hover.set(b.i)" (mouseleave)="hover.set(null)" />
        }
      </svg>
      @if (tip(); as tp) {
        <div class="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-[110%] whitespace-nowrap rounded-token-md bg-fg px-2.5 py-2 text-12.5 leading-snug text-surface"
          [style.left.px]="tp.left" [style.top.px]="tp.top">
          {{ tp.title }}<b class="num block text-sm font-extrabold">{{ tp.value }}</b>
        </div>
      }
    }
  `,
})
export class SalesTrendChartComponent {
  readonly points = input.required<DayPoint[]>();
  readonly locale = input('tr-TR');
  readonly todayLabel = input('Bugün');
  readonly soFarLabel = input('');
  readonly ariaLabel = input('');

  readonly L = 40;
  readonly R = 4;
  readonly T = 22;
  private readonly B = 26;

  readonly width = signal(0);
  readonly hover = signal<number | null>(null);

  readonly narrow = computed(() => this.width() < 520);
  readonly height = computed(() => (this.narrow() ? 190 : 240));
  readonly ih = computed(() => this.height() - this.T - this.B);
  private readonly max = computed(() => niceMax(Math.max(...this.points().map(p => p.value), 0)));
  private readonly bw = computed(() => (this.width() - this.L - this.R) / Math.max(1, this.points().length));
  readonly gap = computed(() => Math.max(3, this.bw() * 0.3));

  private y(v: number): number {
    return this.T + this.ih() - (v / this.max()) * this.ih();
  }

  private short(v: number): string {
    if (v >= 1000) return (v / 1000).toLocaleString(this.locale(), { maximumFractionDigits: 1 }) + 'b';
    return Math.round(v).toLocaleString(this.locale());
  }

  readonly grid = computed(() => {
    const max = this.max();
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, k) => {
      const v = (max / steps) * k;
      return { v, y: this.y(v), label: v ? this.short(v) : '0' };
    });
  });

  readonly avgY = computed(() => {
    const p = this.points();
    if (!p.length) return null;
    const avg = p.reduce((a, b) => a + b.value, 0) / p.length;
    return avg > 0 ? this.y(avg) : null;
  });

  readonly bars = computed<Bar[]>(() => {
    const pts = this.points();
    const n = pts.length;
    const bw = this.bw();
    const g = this.gap();
    const base = this.T + this.ih();
    const every = n <= 7 ? 1 : this.narrow() ? Math.ceil(n / 5) : n <= 14 ? 2 : 4;
    return pts.map((p, i) => {
      const x = this.L + i * bw + g / 2;
      const w = Math.max(2, bw - g);
      const yy = this.y(p.value);
      const h = base - yy;
      const r = Math.min(4, w / 2, h);
      const path = h <= 0
        ? `M${x},${base} h${w}`
        : `M${x},${base} V${yy + r} q0,-${r} ${r},-${r} h${w - 2 * r} q${r},0 ${r},${r} V${base}z`;
      const show = p.isToday || (n - 1 - i) % every === 0;
      const tooClose = !p.isToday && n - 1 - i < every && n - 1 - i > 0;
      const label = !show || tooClose ? null
        : p.isToday ? this.todayLabel()
        : p.date.toLocaleDateString(this.locale(), this.narrow() || n > 14 ? { day: 'numeric' } : { day: 'numeric', weekday: 'short' });
      return { i, x, w, y: yy, h, path, cls: p.isToday ? 'today' : p.isSunday ? 'sun' : '', label, labelBold: p.isToday };
    });
  });

  /** Bugün ve en iyi günün üstüne değer etiketi. */
  readonly dataLabels = computed(() => {
    const pts = this.points();
    const bars = this.bars();
    if (!pts.length) return [];
    let best = 0;
    pts.forEach((p, i) => { if (p.value > pts[best].value) best = i; });
    const idx = [...new Set([pts.length - 1, best])].filter(i => pts[i].value > 0);
    return idx.map(i => ({ i, x: bars[i].x + bars[i].w / 2, y: bars[i].y - 7, text: this.short(pts[i].value) }));
  });

  readonly tip = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    const p = this.points()[i];
    const b = this.bars()[i];
    if (!p || !b) return null;
    const title = p.date.toLocaleDateString(this.locale(), { weekday: 'short', day: 'numeric', month: 'long' })
      + (p.isToday && this.soFarLabel() ? ' ' + this.soFarLabel() : '');
    const left = Math.min(Math.max(b.x + b.w / 2 + 12, 80), this.width() - 80);
    return {
      left, top: b.y + 4, title,
      value: p.value.toLocaleString(this.locale(), { maximumFractionDigits: 2 }) + ' ₺',
    };
  });

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => this.width.set(Math.max(260, Math.floor(host.clientWidth - 24)));
      measure();
      const ro = new ResizeObserver(() => measure());
      ro.observe(host);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }
}
