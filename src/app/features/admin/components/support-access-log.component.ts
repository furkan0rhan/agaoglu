import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { AuditLogService } from '../../../core/auth/services/audit-log.service';
import { LangService } from '../../../core/i18n/lang.service';
import { AuditLog } from '../../../shared/models/user.model';
import { EmptyStateComponent, GlassCardComponent, TONE_SOFT, UiTone } from '../../../shared/ui';
import { TenantInfoService } from '../../settings/business/tenant-info.service';
import { ADMIN_TEXTS } from '../admin.i18n';

/**
 * İşletme admini için "Destek erişim geçmişi" kartı (KVKK şeffaflığı):
 *  - destek erişimi aç/kapat (tenants/{id}.supportAccess) — `showToggle` ile gizlenebilir,
 *  - auditLogs: destek oturumları + lisans/kullanıcı işlemleri (son 50), C zaman çizelgesi.
 * Kullanım (ayarlar sayfası): <app-support-access-log />
 * Toast'lar ebeveyn sayfanın MessageService'ine gider (yoksa sessiz).
 */
@Component({
  selector: 'app-support-access-log',
  standalone: true,
  imports: [DatePipe, FormsModule, ToggleSwitchModule, GlassCardComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="x().accessLogTitle" [subtitle]="x().accessLogDesc" icon="pi-shield" tone="info" padding="none">
      @if (showToggle()) {
        <div class="flex items-start gap-3 border-b border-line px-4 py-3.5">
          <div class="min-w-0 flex-1">
            <label for="support-access" class="text-sm font-semibold text-fg">{{ x().accessToggle }}</label>
            <p class="m-0 mt-1 text-13 leading-relaxed text-fg-muted">{{ x().accessToggleHint }}</p>
          </div>
          <p-toggleswitch inputId="support-access" [ngModel]="access()" (ngModelChange)="setAccess($event)"
            [disabled]="accessLoading() || !canEdit()" />
        </div>
      }

      @if (error()) {
        <p class="m-0 px-4 py-3 text-sm text-danger-text" role="alert">{{ error() }}</p>
      } @else if (logs().length === 0) {
        <ui-empty-state [title]="x().noAudit" icon="pi-history" compact />
      } @else {
        <ol class="m-0 max-h-[520px] list-none overflow-y-auto px-4 py-3">
          @for (log of logs(); track log.id) {
            <li class="relative flex gap-3 pb-3.5 last:pb-0">
              @if (!$last) { <span class="absolute bottom-0 left-[13px] top-8 w-px bg-line" aria-hidden="true"></span> }
              <span class="relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-token-md" [class]="toneClass(log)">
                <i class="pi text-12" [class]="icon(log)" aria-hidden="true"></i>
              </span>
              <div class="min-w-0 flex-1">
                <p class="m-0 text-sm font-semibold text-fg">{{ x().actions[log.action] || log.action }}</p>
                @if (log.detail) { <p class="m-0 mt-0.5 break-words text-13 text-fg-secondary">{{ log.detail }}</p> }
                <p class="m-0 mt-0.5 text-xs text-fg-muted">
                  <span class="num">{{ log.createdAt ? (log.createdAt | date: 'dd.MM.yyyy HH:mm') : '…' }}</span> · {{ log.actorEmail }}
                </p>
              </div>
            </li>
          }
        </ol>
      }
    </ui-glass-card>
  `,
})
export class SupportAccessLogComponent implements OnInit {
  /** false: yalnız geçmiş listesi (anahtar başka yerde gösteriliyorsa). */
  readonly showToggle = input(true);
  /** Boşsa geçerli işletme. */
  readonly tenantId = input<string>('');

  private readonly auditSvc = inject(AuditLogService);
  private readonly auth = inject(AuthService);
  private readonly tenantInfo = inject(TenantInfoService);
  private readonly toast = inject(MessageService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = inject(LangService);
  readonly x = computed(() => ADMIN_TEXTS[this.lang.lang()]);

  readonly logs = signal<AuditLog[]>([]);
  readonly error = signal('');
  readonly access = signal(true);
  readonly accessLoading = signal(true);

  canEdit(): boolean {
    // Destek modundaki superadmin bu anahtarı değiştirmemeli: karar işletmenindir.
    return this.auth.hasRole('admin') && !this.auth.inSupportMode();
  }

  ngOnInit(): void {
    const tenantId = this.tenantId() || this.auth.currentTenantId();
    if (!tenantId) return;
    this.auditSvc.watchForTenant(tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => { this.logs.set(rows); this.error.set(''); },
        error: () => this.error.set(this.x().loadFailed),
      });
    if (this.showToggle()) {
      this.tenantInfo.getSupportAccess()
        .then(v => this.access.set(v))
        .catch(() => undefined)
        .finally(() => this.accessLoading.set(false));
    }
  }

  async setAccess(enabled: boolean): Promise<void> {
    const prev = this.access();
    this.access.set(enabled);
    this.accessLoading.set(true);
    try {
      await this.tenantInfo.setSupportAccess(enabled);
      this.toast?.add({ severity: 'success', summary: '', detail: this.x().accessSaved, life: 3000 });
    } catch {
      this.access.set(prev);
      this.toast?.add({ severity: 'error', summary: '', detail: this.x().actionFailed, life: 4000 });
    } finally {
      this.accessLoading.set(false);
    }
  }

  tone(log: AuditLog): UiTone {
    switch (log.action) {
      case 'support_start': return 'warning';
      case 'support_end': return 'neutral';
      case 'license_change': return 'info';
      default: return 'brand';
    }
  }

  toneClass(log: AuditLog): string {
    return TONE_SOFT[this.tone(log)];
  }

  icon(log: AuditLog): string {
    switch (log.action) {
      case 'support_start': return 'pi-sign-in';
      case 'support_end': return 'pi-sign-out';
      case 'license_change': return 'pi-key';
      default: return 'pi-user-edit';
    }
  }
}
