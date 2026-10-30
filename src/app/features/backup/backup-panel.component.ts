import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { LangService } from '../../core/i18n/lang.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { GlassCardComponent, SettingsRowComponent, StatusBadgeComponent } from '../../shared/ui';
import { BackupService, RestoreNotAllowedError } from './services/backup.service';
import { BACKUP_COLLECTIONS, BackupCollection, BackupFile, BackupFormatError, backupOverdue, countRecords } from './services/backup.utils';

/**
 * Yedekleme paneli (Ayarlar → Yedekleme & dışa aktarma): tüm veriyi indir (JSON.zip / Excel), boş işletmeye
 * geri yükle, son yedek bilgisi. Toast ve onay penceresi ebeveyn sayfanın MessageService / ConfirmationService'ini kullanır.
 */
@Component({
  selector: 'app-backup-panel',
  standalone: true,
  imports: [DatePipe, ButtonModule, GlassCardComponent, SettingsRowComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="t().backup.title" [subtitle]="t().backup.subtitle" icon="pi-cloud-download" tone="info" padding="none">
      <!-- Son yedek + indir -->
      <ui-settings-row [title]="t().backup.lastBackup" [description]="lastText()">
        @if (lastLoaded()) {
          @if (overdue()) {
            <ui-status-badge tone="warning" icon="pi-exclamation-triangle" size="sm">{{ t().backup.overdueShort }}</ui-status-badge>
          } @else {
            <ui-status-badge tone="success" icon="pi-check" size="sm">{{ t().backup.upToDate }}</ui-status-badge>
          }
        }
      </ui-settings-row>
      @if (overdue()) {
        <p class="m-0 border-b border-line bg-warning-soft px-3 py-2.5 text-13 text-warning-text sm:px-4">{{ overdueText() }}</p>
      }

      <ui-settings-row [title]="t().backup.downloadTitle" [description]="t().backup.downloadDesc">
        <p-button [label]="t().backup.downloadZip" icon="pi pi-file" [loading]="busy() === 'zip'" [disabled]="!!busy()"
          (onClick)="download('zip')" />
        <p-button [label]="t().backup.downloadExcel" icon="pi pi-file-excel" severity="secondary"
          [loading]="busy() === 'excel'" [disabled]="!!busy()" (onClick)="download('excel')" />
      </ui-settings-row>
      @if (busy() === 'zip' || busy() === 'excel') {
        <p class="m-0 border-b border-line px-3 py-2 text-xs text-fg-muted sm:px-4" role="status">{{ t().backup.preparing }}</p>
      }
      @if (!isAdmin()) {
        <p class="m-0 border-b border-line px-3 py-2 text-xs text-fg-muted sm:px-4">{{ t().backup.adminOnlyNote }}</p>
      }

      <!-- Geri yükle -->
      <ui-settings-row [title]="t().backup.restoreTitle" [description]="t().backup.restoreDesc">
        <label for="bk-file" class="tap inline-flex cursor-pointer items-center gap-2 rounded-token-md border border-danger-line bg-surface px-4 text-sm font-semibold text-danger-text hover:bg-danger-soft">
          <i class="pi pi-history" aria-hidden="true"></i>{{ t().backup.chooseFile }}
        </label>
        <input id="bk-file" type="file" accept=".zip,.json,application/zip,application/json" class="sr-only" (change)="onFile($event)" />
      </ui-settings-row>

      @if (preview(); as pv) {
        <div class="border-t border-line p-3 sm:p-4">
          <div class="rounded-token-lg border border-line bg-surface-muted p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-fg">{{ t().backup.preview }}</span>
              <button type="button" class="tap cursor-pointer border-0 bg-transparent text-xs font-semibold text-brand-text" (click)="clear()">{{ t().backup.clear }}</button>
            </div>
            <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <dt class="text-fg-muted">{{ t().backup.exportedAt }}</dt><dd class="num m-0 text-right sm:text-left">{{ pv.exportedAt | date: 'dd.MM.yyyy HH:mm' }}</dd>
              @if (sourceName()) {
                <dt class="text-fg-muted">{{ t().backup.sourceBusiness }}</dt><dd class="m-0 truncate text-right sm:text-left">{{ sourceName() }}</dd>
              }
              @for (c of collections; track c) {
                <dt class="text-fg-secondary">{{ t().backup.collections[c] }}</dt><dd class="num m-0 text-right sm:text-left">{{ counts()!.perCollection[c] }}</dd>
              }
              <dt class="border-t border-line pt-1 font-bold text-fg">{{ t().backup.total }}</dt>
              <dd class="num m-0 border-t border-line pt-1 text-right font-bold sm:text-left">{{ counts()!.total }} {{ t().backup.records }}</dd>
            </dl>
            @if (progress(); as pr) {
              <div class="mt-3" role="status">
                <div class="h-2 overflow-hidden rounded-full bg-surface-strong">
                  <div class="h-full bg-brand transition-all" [style.width.%]="pr.total ? (pr.written / pr.total) * 100 : 0"></div>
                </div>
                <p class="mb-0 mt-1 text-xs text-fg-muted">{{ restoringText() }}</p>
              </div>
            }
            <p class="mb-0 mt-3 text-xs text-fg-muted">{{ t().backup.quotaNote }}</p>
            <p-button styleClass="mt-3 w-full" [label]="t().backup.restoreBtn" icon="pi pi-upload" severity="warn"
              [loading]="busy() === 'restore'" [disabled]="!!busy() || counts()!.total === 0" (onClick)="confirmRestore()" />
          </div>
        </div>
      }
    </ui-glass-card>
  `,
})
export class BackupPanelComponent implements OnInit {
  private readonly svc = inject(BackupService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly t = inject(LangService).t;

  readonly collections: readonly BackupCollection[] = BACKUP_COLLECTIONS;
  readonly lastBackupAt = signal<Date | null>(null);
  readonly lastLoaded = signal(false);
  readonly busy = signal<'zip' | 'excel' | 'restore' | null>(null);
  readonly preview = signal<BackupFile | null>(null);
  readonly progress = signal<{ written: number; total: number } | null>(null);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly overdue = computed(() => this.lastLoaded() && backupOverdue(this.lastBackupAt()));
  /** Y15: hiç yedek yoksa "7 günden fazla geçti" yerine "Henüz yedek almadınız" */
  readonly overdueText = computed(() => (this.lastBackupAt() ? this.t().backup.overdue : this.t().backup.neverTaken));
  readonly counts = computed(() => (this.preview() ? countRecords(this.preview()!) : null));
  readonly sourceName = computed(() => {
    const n = this.preview()?.tenant?.['name'];
    return typeof n === 'string' ? n : '';
  });
  readonly lastText = computed(() => {
    const d = this.lastBackupAt();
    if (!this.lastLoaded()) return this.t().common.loading;
    return d ? d.toLocaleString(this.t().reports.dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : this.t().backup.never;
  });
  /** Ayarlar kurulum kartı yenilensin. */
  readonly backedUp = output<void>();
  readonly restoringText = computed(() => {
    const p = this.progress();
    return p ? this.t().backup.restoring.replace('{written}', String(p.written)).replace('{total}', String(p.total)) : '';
  });

  async ngOnInit(): Promise<void> {
    try {
      this.lastBackupAt.set(await this.svc.getLastBackupAt());
    } catch { /* okunamadıysa "hiç" gösterilir */ }
    this.lastLoaded.set(true);
  }

  async download(kind: 'zip' | 'excel'): Promise<void> {
    this.busy.set(kind);
    try {
      const backup = await this.svc.exportAll();
      if (kind === 'zip') await this.svc.downloadZip(backup);
      else await this.svc.downloadExcel(backup);
      await this.svc.markBackupDone();
      this.lastBackupAt.set(new Date());
      this.backedUp.emit();
      this.toast.add({ severity: 'success', summary: '', detail: this.t().backup.downloaded, life: 2500 });
    } catch {
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().backup.downloadFailed });
    } finally {
      this.busy.set(null);
    }
  }

  async onFile(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.progress.set(null);
    try {
      this.preview.set(await this.svc.readFile(file));
    } catch (err) {
      this.preview.set(null);
      const detail = err instanceof BackupFormatError ? this.t().backup.invalidFile : this.t().backup.restoreFailed;
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail });
    }
  }

  clear(): void {
    this.preview.set(null);
    this.progress.set(null);
  }

  async confirmRestore(): Promise<void> {
    const backup = this.preview();
    if (!backup) return;
    this.busy.set('restore');
    let nonEmpty: BackupCollection[];
    try {
      nonEmpty = await this.svc.nonEmptyCollections();
    } catch {
      this.busy.set(null);
      this.toast.add({ severity: 'error', summary: this.t().common.error, detail: this.t().backup.restoreFailed });
      return;
    }
    this.busy.set(null);
    if (nonEmpty.length) {
      this.showNotEmpty(nonEmpty);
      return;
    }
    this.confirm.confirm({
      header: this.t().backup.restoreConfirmTitle,
      message: this.t().backup.restoreConfirm.replace('{n}', String(this.counts()?.total ?? 0)),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.t().backup.restoreBtn,
      rejectLabel: this.t().common.cancel,
      accept: () => void this.doRestore(backup),
    });
  }

  private async doRestore(backup: BackupFile): Promise<void> {
    this.busy.set('restore');
    try {
      const n = await this.svc.restore(backup, p => this.progress.set(p));
      this.toast.add({ severity: 'success', summary: '', detail: this.t().backup.restored.replace('{n}', String(n)), life: 5000 });
      this.preview.set(null);
      this.progress.set(null);
    } catch (err) {
      if (err instanceof RestoreNotAllowedError) {
        this.showNotEmpty(err.nonEmpty);
      } else {
        const p = this.progress();
        const detail = p && p.written > 0
          ? this.t().backup.restorePartial.replace('{written}', String(p.written)).replace('{total}', String(p.total))
          : this.t().backup.restoreFailed;
        this.toast.add({ severity: 'error', summary: this.t().common.error, detail, life: 8000 });
      }
    } finally {
      this.busy.set(null);
    }
  }

  private showNotEmpty(list: BackupCollection[]): void {
    const names = list.map(c => this.t().backup.collections[c]).join(', ');
    this.toast.add({ severity: 'warn', summary: '', detail: this.t().backup.notEmpty.replace('{list}', names), life: 8000 });
  }
}
