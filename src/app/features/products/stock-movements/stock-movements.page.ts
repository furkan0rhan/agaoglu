import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ProductService } from '../services/product.service';
import { ProductStore } from '../store/product.store';
import { StockMovement } from '../../../shared/models/product.model';

type Filter = 'all' | 'in' | 'out';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonModule, SkeletonModule],
  template: `
    <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <a [routerLink]="['/products', productId]"
           style="width:36px; height:36px; border-radius:10px; background:#f8fafc; border:1px solid #f1f5f9; display:flex; align-items:center; justify-content:center; color:#64748b; text-decoration:none; flex-shrink:0;">
          <i class="pi pi-arrow-left" style="font-size:13px;"></i>
        </a>
        <div style="flex:1; min-width:0;">
          <h1 style="font-size:17px; font-weight:700; color:#1e293b; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            Stok Hareketleri
          </h1>
          <p style="font-size:12px; color:#64748b; margin:0;">{{ productName() }}</p>
        </div>
      </div>

      <!-- Özet kartları -->
      <div style="padding:16px 24px 0; display:flex; gap:12px; flex-shrink:0;">
        <div style="flex:1; background:#fff; border-radius:14px; border:1px solid #f1f5f9; padding:14px 16px;">
          <p style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 4px;">Toplam</p>
          <p style="font-size:22px; font-weight:700; color:#1e293b; margin:0;">{{ movements().length }}</p>
        </div>
        <div style="flex:1; background:#f0fdf4; border-radius:14px; border:1px solid #bbf7d0; padding:14px 16px;">
          <p style="font-size:11px; font-weight:600; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 4px;">Giriş</p>
          <p style="font-size:22px; font-weight:700; color:#15803d; margin:0;">+{{ totalIn() }}</p>
        </div>
        <div style="flex:1; background:#fff7ed; border-radius:14px; border:1px solid #fed7aa; padding:14px 16px;">
          <p style="font-size:11px; font-weight:600; color:#ea580c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 4px;">Çıkış</p>
          <p style="font-size:22px; font-weight:700; color:#c2410c; margin:0;">-{{ totalOut() }}</p>
        </div>
      </div>

      <!-- Filtreler -->
      <div style="padding:12px 24px; display:flex; gap:8px; flex-shrink:0;">
        @for (f of filters; track f.key) {
          <button
            (click)="activeFilter.set(f.key)"
            [style]="filterBtnStyle(f.key)"
          >{{ f.label }}</button>
        }
      </div>

      <!-- Liste -->
      <div style="flex:1; overflow-y:auto; padding:0 24px 24px;">

        @if (loading()) {
          <div style="display:flex; flex-direction:column; gap:10px;">
            @for (i of [1,2,3,4,5]; track i) {
              <div style="background:#fff; border-radius:14px; border:1px solid #f1f5f9; padding:16px; display:flex; gap:12px; align-items:center;">
                <p-skeleton shape="circle" size="40px" />
                <div style="flex:1;">
                  <p-skeleton height="14px" styleClass="mb-2" />
                  <p-skeleton height="12px" width="60%" />
                </div>
                <p-skeleton height="20px" width="50px" />
              </div>
            }
          </div>
        } @else if (filtered().length === 0) {
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 0; gap:12px; color:#94a3b8;">
            <i class="pi pi-history" style="font-size:40px; opacity:0.3;"></i>
            <p style="font-size:14px; margin:0;">Hareket bulunamadı</p>
          </div>
        } @else {
          <div style="display:flex; flex-direction:column; gap:8px;">
            @for (m of filtered(); track m.id) {
              <div style="background:#fff; border-radius:14px; border:1px solid #f1f5f9; padding:14px 16px; display:flex; align-items:center; gap:12px;">

                <!-- İkon -->
                <div [style]="iconBgStyle(m.type)" style="width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i [class]="'pi ' + iconClass(m.type)" style="font-size:15px;"></i>
                </div>

                <!-- Bilgi -->
                <div style="flex:1; min-width:0;">
                  <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ m.reason }}</p>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:12px; color:#94a3b8;">{{ m.createdAt.toDate() | date:'dd.MM.yyyy HH:mm' }}</span>
                    <span style="font-size:11px; color:#cbd5e1;">•</span>
                    <span style="font-size:12px; color:#64748b;">{{ m.previousStock }} → {{ m.newStock }} adet</span>
                  </div>
                </div>

                <!-- Miktar -->
                <div [style]="qtyStyle(m.type)" style="font-size:15px; font-weight:700; flex-shrink:0;">
                  {{ m.type === 'in' || m.type === 'return' ? '+' : '-' }}{{ m.quantity }}
                </div>

              </div>
            }
          </div>
        }

      </div>
    </div>
  `,
})
export class StockMovementsPage implements OnInit {
  private readonly svc = inject(ProductService);
  private readonly store = inject(ProductStore);
  private readonly route = inject(ActivatedRoute);

  readonly movements = signal<StockMovement[]>([]);
  readonly loading = signal(true);
  readonly activeFilter = signal<Filter>('all');

  productId = '';

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'in',  label: 'Girişler' },
    { key: 'out', label: 'Çıkışlar' },
  ];

  readonly filtered = computed(() => {
    const f = this.activeFilter();
    const list = this.movements();
    if (f === 'all') return list;
    if (f === 'in')  return list.filter(m => m.type === 'in' || m.type === 'return');
    return list.filter(m => m.type === 'out' || m.type === 'adjustment');
  });

  readonly totalIn = computed(() =>
    this.movements().filter(m => m.type === 'in' || m.type === 'return').reduce((s, m) => s + m.quantity, 0)
  );

  readonly totalOut = computed(() =>
    this.movements().filter(m => m.type === 'out' || m.type === 'adjustment').reduce((s, m) => s + m.quantity, 0)
  );

  productName(): string {
    return this.store.products().find(p => p.id === this.productId)?.name ?? '';
  }

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getMovements$(this.productId).subscribe(m => {
      this.movements.set(m);
      this.loading.set(false);
    });
  }

  iconClass(type: string): string {
    if (type === 'in')     return 'pi-arrow-down text-green-600';
    if (type === 'return') return 'pi-undo';
    return 'pi-arrow-up';
  }

  iconBgStyle(type: string): string {
    if (type === 'in')     return 'background:#f0fdf4; color:#16a34a;';
    if (type === 'return') return 'background:#eff6ff; color:#3b82f6;';
    return 'background:#fff7ed; color:#ea580c;';
  }

  qtyStyle(type: string): string {
    if (type === 'in' || type === 'return') return 'color:#16a34a;';
    return 'color:#ea580c;';
  }

  filterBtnStyle(key: Filter): string {
    const active = this.activeFilter() === key;
    return `padding:6px 16px; border-radius:20px; border:1px solid ${active ? '#16a34a' : '#e2e8f0'}; background:${active ? '#f0fdf4' : '#fff'}; color:${active ? '#15803d' : '#64748b'}; font-size:13px; font-weight:${active ? '600' : '500'}; cursor:pointer; transition:all 0.15s;`;
  }
}
