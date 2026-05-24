import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ExpenseService } from './services/expense.service';
import { Expense } from '../../shared/models/expense.model';
import { CurrencyTrPipe } from '../../shared/pipes/currency-tr.pipe';

type Period = 'month' | 'week' | 'all';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    FormsModule, DatePipe, CurrencyTrPipe,
    ButtonModule, DialogModule, InputTextModule, InputNumberModule,
    AutoCompleteModule, DatePickerModule, ToastModule, SkeletonModule, ConfirmDialogModule, ToggleSwitchModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast position="top-right" />
    <p-confirmDialog />

    <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; overflow:hidden;">

      <!-- Header -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:16px 24px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#f97316,#ea580c); display:flex; align-items:center; justify-content:center;">
          <i class="pi pi-wallet" style="color:white; font-size:16px;"></i>
        </div>
        <div style="flex:1;">
          <h1 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">Giderler</h1>
          <p style="font-size:12px; color:#64748b; margin:0;">Kira, elektrik, su ve diğer giderler</p>
        </div>
        <p-button label="Gider Ekle" icon="pi pi-plus" severity="warn" size="small" (onClick)="openDialog()" />
      </div>

      <!-- Period + özet -->
      <div style="background:#fff; border-bottom:1px solid #f1f5f9; padding:12px 24px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:12px;">
        <div style="display:flex; gap:8px;">
          @for (p of periods; track p.value) {
            <button
              (click)="period.set(p.value)"
              [style]="period() === p.value
                ? 'padding:6px 16px; border-radius:20px; border:none; background:#f97316; color:#fff; font-size:13px; font-weight:600; cursor:pointer;'
                : 'padding:6px 16px; border-radius:20px; border:1px solid #e2e8f0; background:#fff; color:#64748b; font-size:13px; font-weight:500; cursor:pointer;'"
            >{{ p.label }}</button>
          }
        </div>
        <div style="display:flex; align-items:center; gap:6px; background:#fff7ed; border-radius:10px; padding:8px 14px; flex-shrink:0;">
          <i class="pi pi-wallet" style="font-size:13px; color:#ea580c;"></i>
          <span style="font-size:13px; font-weight:700; color:#ea580c;">{{ totalFiltered() | currencyTr }}</span>
        </div>
      </div>

      <!-- Liste -->
      <div style="flex:1; overflow-y:auto; padding:16px 24px;">

        @if (loading()) {
          <div style="display:flex; flex-direction:column; gap:10px;">
            @for (i of [1,2,3,4]; track i) {
              <div style="background:#fff; border-radius:14px; border:1px solid #f1f5f9; padding:16px; display:flex; gap:12px; align-items:center;">
                <p-skeleton shape="circle" size="40px" />
                <div style="flex:1;"><p-skeleton height="14px" styleClass="mb-2" /><p-skeleton height="12px" width="50%" /></div>
                <p-skeleton height="18px" width="70px" />
              </div>
            }
          </div>
        } @else if (filtered().length === 0) {
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 0; gap:10px; color:#94a3b8;">
            <i class="pi pi-wallet" style="font-size:48px; opacity:0.2;"></i>
            <p style="font-size:15px; margin:0; font-weight:600; color:#64748b;">Henüz gider eklenmedi</p>
            <p style="font-size:13px; margin:0; color:#94a3b8;">Kira, elektrik gibi giderlerinizi buradan takip edin</p>
            <div style="margin-top:8px;">
              <p-button label="Gider Ekle" icon="pi pi-plus" severity="warn" [outlined]="true" size="small" (onClick)="openDialog()" />
            </div>
          </div>
        } @else {
          <div style="display:flex; flex-direction:column; gap:8px;">
            @for (e of filtered(); track e.id) {
              <div style="background:#fff; border-radius:14px; border:1px solid #f1f5f9; padding:14px 16px; display:flex; align-items:center; gap:12px;">
                <div [style]="catIconBg(e.category)" style="width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <i [class]="'pi ' + catIcon(e.category)" style="font-size:16px;"></i>
                </div>
                <div style="flex:1; min-width:0;">
                  <p style="font-size:14px; font-weight:600; color:#1e293b; margin:0 0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ e.title }}</p>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px; background:#fff7ed; color:#ea580c;">{{ e.category }}</span>
                    <span style="font-size:12px; color:#94a3b8;">{{ e.date.toDate() | date:'dd.MM.yyyy' }}</span>
                    @if (e.note) {
                      <span style="font-size:12px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">{{ e.note }}</span>
                    }
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                  <span style="font-size:15px; font-weight:700; color:#ea580c;">{{ e.amount | currencyTr }}</span>
                  <button
                    (click)="confirmDelete(e)"
                    style="width:30px; height:30px; border-radius:8px; border:none; background:#fef2f2; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#ef4444;"
                  ><i class="pi pi-trash" style="font-size:12px;"></i></button>
                </div>
              </div>
            }
          </div>
        }

      </div>
    </div>

    <!-- Gider Ekle Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      header="Yeni Gider"
      [modal]="true"
      [style]="{ width: '400px' }"
      [draggable]="false"
    >
      <div style="display:flex; flex-direction:column; gap:14px; padding:4px 0;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Başlık</label>
          <input pInputText [(ngModel)]="form.title" placeholder="Örn: Ekim ayı kirası" style="width:100%;" />
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Kategori</label>
          <p-autocomplete
            [(ngModel)]="form.category"
            [suggestions]="categorySuggestions"
            (completeMethod)="searchCategory($event)"
            [forceSelection]="false"
            [dropdown]="true"
            appendTo="body"
            placeholder="Kategori seçin veya yazın"
            styleClass="w-full"
          />
        </div>
        <div style="display:flex; gap:12px;">
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Tutar (₺)</label>
            <p-inputNumber [(ngModel)]="form.amount" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" locale="tr-TR" styleClass="w-full" />
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Tarih</label>
            <p-datepicker [(ngModel)]="form.date" dateFormat="dd.mm.yy" [showIcon]="true" appendTo="body" styleClass="w-full" />
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Not <span style="font-weight:400; text-transform:none;">(opsiyonel)</span></label>
          <input pInputText [(ngModel)]="form.note" placeholder="Ek bilgi..." style="width:100%;" />
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; border-radius:12px; padding:12px 14px;">
          <div>
            <p style="font-size:13px; font-weight:600; color:#1e293b; margin:0 0 2px;">Tekrarlayan Gider</p>
            <p style="font-size:12px; color:#94a3b8; margin:0;">Seçilen tarihten itibaren 12 ay boyunca ekler</p>
          </div>
          <p-toggleswitch [(ngModel)]="form.recurring" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="İptal" severity="secondary" [outlined]="true" (onClick)="dialogVisible = false" />
        <p-button
          label="Kaydet"
          icon="pi pi-check"
          severity="warn"
          [loading]="saving()"
          [disabled]="!form.title.trim() || !form.amount || !form.category"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ExpensesPage implements OnInit {
  private readonly svc = inject(ExpenseService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly expenses = signal<Expense[]>([]);
  readonly period = signal<Period>('month');

  dialogVisible = false;
  form = { title: '', category: '', amount: 0, date: new Date(), note: '', recurring: false };

  categorySuggestions: string[] = [];

  private get allCategories(): string[] {
    return [...new Set(this.expenses().map(e => e.category).filter(Boolean))].sort();
  }

  searchCategory(event: { query: string }): void {
    const q = event.query.trim().toLowerCase();
    const all = this.allCategories;
    if (!q) {
      this.categorySuggestions = all;
    } else {
      const filtered = all.filter(v => v.toLowerCase().includes(q));
      if (!filtered.some(v => v.toLowerCase() === q) && event.query.trim()) {
        filtered.push(event.query.trim());
      }
      this.categorySuggestions = filtered;
    }
  }
  readonly periods = [
    { value: 'month' as Period, label: 'Bu Ay' },
    { value: 'week' as Period, label: 'Bu Hafta' },
    { value: 'all' as Period, label: 'Tümü' },
  ];

  readonly filtered = computed(() => {
    const list = this.expenses();
    const p = this.period();
    if (p === 'all') return list;
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (p === 'month') {
      start.setDate(1); start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999);
    } else {
      const d = now.getDay();
      start.setDate(now.getDate() - (d === 0 ? 6 : d - 1)); start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    }
    return list.filter(e => { const t = e.date.toDate(); return t >= start && t <= end; });
  });

  readonly totalFiltered = computed(() => this.filtered().reduce((s, e) => s + e.amount, 0));

  ngOnInit(): void {
    this.svc.getAll$().subscribe({
      next: data => { this.expenses.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openDialog(): void {
    this.form = { title: '', category: '', amount: 0, date: new Date(), note: '', recurring: false };
    this.dialogVisible = true;
  }

  async save(): Promise<void> {
    if (!this.form.title.trim() || !this.form.amount || !this.form.category) return;
    this.saving.set(true);
    try {
      const base = {
        title: this.form.title.trim(),
        amount: this.form.amount,
        category: this.form.category,
        note: this.form.note.trim(),
      };

      if (this.form.recurring) {
        const promises = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(this.form.date);
          d.setMonth(d.getMonth() + i);
          return this.svc.create({ ...base, date: d });
        });
        await Promise.all(promises);
        this.toast.add({ severity: 'success', summary: '', detail: '12 aylık gider eklendi', life: 3000 });
      } else {
        await this.svc.create({ ...base, date: this.form.date });
        this.toast.add({ severity: 'success', summary: '', detail: 'Gider eklendi', life: 2500 });
      }

      this.dialogVisible = false;
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: 'Gider eklenemedi', life: 3000 });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(e: Expense): void {
    this.confirm.confirm({
      message: `"${e.title}" giderini silmek istediğinize emin misiniz?`,
      header: 'Gider Sil',
      icon: 'pi pi-trash',
      acceptLabel: 'Sil',
      rejectLabel: 'İptal',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.delete(e.id),
    });
  }

  private async delete(id: string): Promise<void> {
    try {
      await this.svc.delete(id);
      this.toast.add({ severity: 'success', summary: '', detail: 'Gider silindi', life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: '', detail: 'Silinemedi', life: 3000 });
    }
  }

  catIcon(cat: string): string {
    const m: Record<string, string> = {
      'Kira': 'pi-home', 'Elektrik': 'pi-bolt', 'Su': 'pi-droplet',
      'Doğalgaz': 'pi-fire', 'İnternet': 'pi-wifi', 'Personel': 'pi-users',
      'Nakliye': 'pi-truck', 'Bakım & Onarım': 'pi-wrench', 'Vergi': 'pi-file',
    };
    return m[cat] ?? 'pi-wallet';
  }

  catIconBg(cat: string): string {
    const m: Record<string, string> = {
      'Kira': 'background:#f0fdf4; color:#16a34a;',
      'Elektrik': 'background:#fefce8; color:#ca8a04;',
      'Su': 'background:#eff6ff; color:#3b82f6;',
      'Doğalgaz': 'background:#fff7ed; color:#f97316;',
      'İnternet': 'background:#f5f3ff; color:#8b5cf6;',
      'Personel': 'background:#fdf4ff; color:#a855f7;',
      'Nakliye': 'background:#f0fdf4; color:#059669;',
      'Bakım & Onarım': 'background:#fef2f2; color:#ef4444;',
      'Vergi': 'background:#f8fafc; color:#64748b;',
    };
    return m[cat] ?? 'background:#fff7ed; color:#ea580c;';
  }
}
