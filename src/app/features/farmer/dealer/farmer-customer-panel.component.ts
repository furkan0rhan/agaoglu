import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { Customer } from '../../../shared/models/customer.model';
import {
  ApplicationLog, FarmerInvite, FarmerLink, FarmField, PrescriberInfo, Recommendation, Season,
} from '../../../shared/models/farmer.model';
import { GlassCardComponent, StatusBadgeComponent } from '../../../shared/ui';
import { environment } from '../../../../environments/environment';
import { DEALER_FARMER_REPOSITORY } from '../data/repositories';
import { fmt } from '../i18n/farmer.i18n';
import { fmtDate, fmtNum, TYPE_ICON, typeTile } from '../layout/farmer-ui';
import { cropDef } from '../utils/crops';
import { buildInviteUrl, phoneLast4, whatsappUrl } from '../utils/identity.util';
import { PrescribersDialogComponent } from './prescribers-dialog.component';
import { QrCodeComponent } from './qr-code.component';
import { RecommendationDialogComponent } from './recommendation-dialog.component';

/**
 * Bayi tarafı: müşteri detayında "Çiftçi uygulaması" kartı (docs/CIFTCI-MODULU.md §6.3, TASKS 8.3 + 8.10).
 * Davet (QR + WhatsApp), bağlantı/izin özeti, izin verilen tarlalar ve defter, öneri/reçete kayıtları.
 * Okumalar tek seferlik (dinleyici yok). Açılışta müşterinin satışları çiftçi ambarına, bakiye bağlantıya senkronlanır.
 */
@Component({
  selector: 'app-farmer-customer-panel',
  standalone: true,
  imports: [ButtonModule, GlassCardComponent, StatusBadgeComponent, QrCodeComponent, RecommendationDialogComponent, PrescribersDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-glass-card [title]="d().cardTitle" icon="pi-mobile" tone="success" padding="none">
      @if (link(); as l) {
        <ui-status-badge card-actions [tone]="l.status === 'active' ? 'success' : 'neutral'" [icon]="l.status === 'active' ? '' : 'pi-times'">
          {{ l.status === 'active' ? d().inApp : d().revoked }}</ui-status-badge>
      }
      @if (loading()) {
        <p class="m-0 flex items-center gap-2 p-4 text-sm text-fg-muted"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i>{{ t().common.loading }}</p>
      } @else if (loadFailed()) {
        <p class="m-0 p-4 text-sm text-danger-text" role="alert">{{ d().loadFailed }}</p>
      } @else {
        @if (link(); as l) {
          <!-- izin özeti -->
          <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <span class="eyebrow mr-1 text-fg-muted">{{ d().consents }}</span>
            <ui-status-badge size="sm" [tone]="l.consent.fields ? 'success' : 'neutral'" [icon]="l.consent.fields ? 'pi-check' : 'pi-times'">{{ d().cFields }}</ui-status-badge>
            <ui-status-badge size="sm" [tone]="l.consent.logs ? 'success' : 'neutral'" [icon]="l.consent.logs ? 'pi-check' : 'pi-times'">{{ d().cLogs }}</ui-status-badge>
            <ui-status-badge size="sm" [tone]="l.consent.notifications ? 'success' : 'neutral'" [icon]="l.consent.notifications ? 'pi-check' : 'pi-times'">{{ d().cNotify }}</ui-status-badge>
          </div>
          @if (l.status === 'active') {
            <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <p-button size="small" severity="secondary" icon="pi pi-sync" [label]="d().sync" [loading]="syncing()" (onClick)="sync()" />
              @if (l.balanceUpdatedAt) { <small class="text-fg-muted">{{ lastSync(l.balanceUpdatedAt) }}</small> }
            </div>

            <section class="border-b border-line px-4 py-3">
              <h3 class="eyebrow m-0 mb-1.5 flex items-center gap-1.5 text-fg-muted"><i class="pi pi-map text-11" aria-hidden="true"></i>{{ d().fields }}</h3>
              @if (!l.consent.fields) { <p class="m-0 text-sm text-fg-muted">{{ d().notShared }}</p> }
              @else {
                @for (f of fields(); track f.id) {
                  <div class="flex items-center gap-2 border-t border-line py-2 text-sm first:border-t-0">
                    <span class="min-w-0 flex-1 truncate font-semibold text-fg">{{ f.name }}</span>
                    @if (seasonOf(f.id); as s) { <span class="truncate text-fg-secondary">{{ crop(s.crop).icon }} {{ crop(s.crop)[lang()] }} <span class="num text-fg-muted">({{ date(s.sowingDate) }})</span></span> }
                    <span class="num shrink-0 font-semibold text-fg">{{ num(f.areaDecare) }} da</span>
                  </div>
                } @empty { <p class="m-0 text-sm text-fg-muted">{{ d().noFields }}</p> }
              }
            </section>

            <section class="border-b border-line px-4 py-3">
              <h3 class="eyebrow m-0 mb-1.5 flex items-center gap-1.5 text-fg-muted"><i class="pi pi-book text-11" aria-hidden="true"></i>{{ d().logs }}</h3>
              @if (!l.consent.logs) { <p class="m-0 text-sm text-fg-muted">{{ d().notShared }}</p> }
              @else {
                @for (g of logs(); track g.id) {
                  <div class="flex items-center gap-2.5 border-t border-line py-2 text-sm first:border-t-0">
                    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-token-md text-14" [class]="tile(g)" aria-hidden="true">{{ icon(g) }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-semibold text-fg">{{ g.productName ?? t().farmer.types[g.type] }}@if (g.quantity !== null) { <span class="num font-normal text-fg-secondary"> · {{ num(g.quantity) }} {{ g.unit }}</span> }</span>
                      <span class="block truncate text-xs text-fg-muted"><span class="num">{{ date(g.date) }}</span> · {{ fieldName(g.fieldId) }}</span>
                    </span>
                  </div>
                } @empty { <p class="m-0 text-sm text-fg-muted">{{ d().noLogs }}</p> }
              }
            </section>

            <section class="border-b border-line px-4 py-3">
              <h3 class="eyebrow m-0 mb-1.5 flex items-center gap-1.5 text-fg-muted"><i class="pi pi-file-edit text-11" aria-hidden="true"></i>{{ d().recs }}</h3>
              @for (r of recs(); track r.id) {
                <div class="border-t border-line py-2.5 text-sm first:border-t-0" [class.opacity-60]="r.status === 'withdrawn'">
                  <div class="flex flex-wrap items-center gap-2">
                    <b class="min-w-0 flex-1 text-fg">{{ r.target }}</b>
                    <span class="num text-xs text-fg-muted">{{ date(r.createdAt) }}</span>
                    @if (r.status === 'withdrawn') { <ui-status-badge size="sm" tone="neutral">{{ d().withdrawn }}</ui-status-badge> }
                  </div>
                  <ul class="m-0 mt-1 list-none p-0 text-fg-secondary">
                    @for (it of r.items; track $index) {
                      <li>{{ it.productName }}: {{ it.dose }}@if (it.phiDays !== null) { <span class="num text-fg-muted"> (PHI {{ it.phiDays }})</span> }</li>
                    }
                  </ul>
                  @if (r.prescriptionNo) { <p class="num m-0 mt-0.5 text-xs text-fg-secondary"><i class="pi pi-verified mr-1 text-11" aria-hidden="true"></i>e-reçete: {{ r.prescriptionNo }}</p> }
                  <div class="mt-1 flex items-center gap-2">
                    <small class="min-w-0 flex-1 text-fg-muted">{{ author(r) }}</small>
                    @if (r.status === 'active' && prescriber()?.canPrescribe) {
                      <p-button size="small" [text]="true" severity="danger" icon="pi pi-undo" [label]="d().withdraw" (onClick)="withdraw(r)" />
                    }
                  </div>
                </div>
              } @empty { <p class="m-0 text-sm text-fg-muted">{{ d().noRecs }}</p> }
              <div class="mt-3 flex flex-wrap items-center gap-2">
                @if (canWriteRec()) {
                  <p-button icon="pi pi-file-edit" [label]="d().writeRec" (onClick)="recOpen.set(true)" />
                } @else {
                  <small class="flex items-center gap-1.5 text-fg-muted"><i class="pi pi-lock text-11" aria-hidden="true"></i>{{ d().onlyPrescriber }}</small>
                }
              </div>
            </section>
          }
        } @else {
          <div class="flex gap-3 border-b border-line px-4 py-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-success-soft text-success-text"><i class="pi pi-qrcode" aria-hidden="true"></i></span>
            <div class="min-w-0">
              <p class="m-0 text-sm text-fg-secondary">{{ d().intro }}</p>
              <p class="mb-0 mt-1.5 text-xs text-fg-muted">{{ t().farmer.legal.notAdvisor }}</p>
            </div>
          </div>
        }

        <!-- davet -->
        <div class="flex flex-wrap items-center gap-2 px-4 py-3">
          @if (!phoneOk()) {
            <p class="m-0 flex items-center gap-2 rounded-token-md bg-warning-soft px-3 py-2 text-sm text-warning-text"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i>{{ d().noPhone }}</p>
          } @else if (!link() || link()!.status !== 'active') {
            <p-button icon="pi pi-qrcode" [label]="d().invite" [loading]="inviting()" (onClick)="createInvite(false)" />
          } @else {
            <p-button size="small" severity="secondary" icon="pi pi-refresh" [label]="d().inviteReset" [loading]="inviting()" (onClick)="createInvite(true)" />
          }
          @if (isAdmin) {
            <p-button size="small" severity="secondary" [text]="true" icon="pi pi-id-card" [label]="d().prescribers" (onClick)="prescribersOpen.set(true)" />
          }
        </div>
        @if (invite(); as inv) {
          <div class="mx-4 mb-4 flex flex-col items-center gap-3 rounded-token-lg border border-line bg-surface-muted p-3 sm:flex-row sm:items-start">
            <div class="shrink-0 rounded-token-md border border-line bg-surface p-2">
              <app-qr-code [value]="inviteUrl()" [size]="168" [label]="d().qrHint" />
            </div>
            <div class="flex w-full min-w-0 flex-1 flex-col gap-2">
              <p class="m-0 text-sm font-semibold text-fg">{{ d().qrHint }}</p>
              <code class="block break-all rounded-token-sm border border-line bg-surface px-2 py-1.5 font-mono text-xs text-fg-secondary">{{ inviteUrl() }}</code>
              <small class="flex items-center gap-1.5 text-fg-muted"><i class="pi pi-clock text-11" aria-hidden="true"></i>{{ expires(inv) }}</small>
              <div class="flex flex-wrap gap-2">
                <a [href]="waUrl()" target="_blank" rel="noopener" class="p-button p-button-success p-button-sm no-underline">
                  <i class="pi pi-whatsapp mr-2" aria-hidden="true"></i>{{ d().whatsapp }}</a>
                <p-button size="small" severity="secondary" icon="pi pi-copy" [label]="d().copy" (onClick)="copy()" />
              </div>
            </div>
          </div>
        }
      }
    </ui-glass-card>

    @if (link(); as l) {
      <app-recommendation-dialog [(visible)]="recOpen" [link]="l" [fields]="fields()" [prescriber]="prescriber()" [tenantName]="tenantName()" (saved)="reloadRecs(true)" />
    }
    @if (isAdmin) {
      <app-prescribers-dialog [(visible)]="prescribersOpen" [tenantId]="tenantId" (changed)="loadPrescriber()" />
    }
  `,
})
export class FarmerCustomerPanelComponent {
  readonly t = inject(LangService).t;
  readonly lang = inject(LangService).lang;
  readonly d = computed(() => this.t().farmer.dealer);
  private readonly repo = inject(DEALER_FARMER_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService, { optional: true });
  readonly customer = input.required<Customer>();

  readonly tenantId = this.auth.currentTenantId();
  readonly isAdmin = this.auth.hasRole('admin');
  readonly link = signal<FarmerLink | null>(null);
  readonly invite = signal<FarmerInvite | null>(null);
  readonly fields = signal<FarmField[]>([]);
  readonly seasons = signal<Season[]>([]);
  readonly logs = signal<ApplicationLog[]>([]);
  readonly recs = signal<Recommendation[]>([]);
  readonly prescriber = signal<PrescriberInfo | null>(null);
  readonly tenantName = signal('');
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly inviting = signal(false);
  readonly syncing = signal(false);
  readonly recOpen = signal(false);
  readonly prescribersOpen = signal(false);


  readonly phoneOk = computed(() => phoneLast4(this.customer().phone).length === 4);
  readonly canWriteRec = computed(() => !!this.prescriber()?.canPrescribe && !!this.prescriber()?.prescriberLicenseNo);
  readonly inviteUrl = computed(() => { const i = this.invite(); return i ? buildInviteUrl(publicBaseUrl(), i.code) : ''; });
  readonly waUrl = computed(() => whatsappUrl(this.customer().phone, fmt(this.d().waText, { dealer: this.tenantName() || '', link: this.inviteUrl() })));

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const c = this.customer();
      if (c.id !== this.loadedFor) { this.loadedFor = c.id; untracked(() => void this.load(c)); }
    });
  }

  private async load(c: Customer): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [link, name] = await Promise.all([this.repo.findLinkForCustomer(this.tenantId, c.id), this.repo.getTenantName(this.tenantId)]);
      this.tenantName.set(name);
      this.link.set(link);
      void this.loadPrescriber();
      if (!link) {
        const open = await this.repo.listOpenInvites(this.tenantId, c.id).catch(() => [] as FarmerInvite[]);
        this.invite.set(open.filter(i => i.expiresAt.getTime() > Date.now()).sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0] ?? null);
      } else if (link.status === 'active') {
        await Promise.all([
          link.consent.fields ? this.repo.listSharedFields(this.tenantId, link.farmerId).then(f => this.fields.set(f)) : Promise.resolve(),
          link.consent.fields ? this.repo.listSharedSeasons(this.tenantId, link.farmerId).then(s => this.seasons.set(s)) : Promise.resolve(),
          link.consent.logs ? this.repo.listSharedLogs(this.tenantId, link.farmerId, 10).then(l => this.logs.set(l)) : Promise.resolve(),
          this.reloadRecs(),
        ]);
        void this.sync(true);
      }
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadPrescriber(): Promise<void> {
    this.prescriber.set(await this.repo.getPrescriber(this.auth.currentUserId()).catch(() => null));
  }

  async reloadRecs(notify = false): Promise<void> {
    const l = this.link();
    if (!l) return;
    this.recs.set(await this.repo.listRecommendations(this.tenantId, l.farmerId).catch(() => []));
    if (notify) this.toast?.add({ severity: 'success', summary: '', detail: this.d().recSaved, life: 2500 });
  }

  async createInvite(reset: boolean): Promise<void> {
    const c = this.customer();
    this.inviting.set(true);
    try {
      const inv = await this.repo.createInvite({
        tenantId: this.tenantId, tenantName: this.tenantName(), customerId: c.id, customerName: `${c.firstName} ${c.lastName}`.trim(),
        phoneLast4: phoneLast4(c.phone), farmerId: reset ? this.link()?.farmerId ?? null : null, createdBy: this.auth.currentUserId(),
      });
      this.invite.set(inv);
      this.toast?.add({ severity: 'success', summary: '', detail: this.d().inviteCreated, life: 2500 });
    } catch {
      this.toast?.add({ severity: 'error', summary: this.t().common.error, detail: this.d().inviteFailed });
    } finally {
      this.inviting.set(false);
    }
  }

  /** Satışlar → çiftçi ambarı (maliyet fiyatı hariç), bakiye → bağlantı. */
  async sync(silent = false): Promise<void> {
    const l = this.link();
    if (!l || l.status !== 'active') return;
    this.syncing.set(true);
    try {
      const n = await this.repo.syncCustomerToFarmer(l, this.tenantName());
      this.link.set({ ...l, balance: this.customer().balance ?? l.balance, balanceUpdatedAt: new Date() });
      if (!silent) this.toast?.add({ severity: 'success', summary: '', detail: fmt(this.d().synced, { n }), life: 2500 });
    } catch {
      if (!silent) this.toast?.add({ severity: 'error', summary: this.t().common.error, detail: this.d().syncFailed });
    } finally {
      this.syncing.set(false);
    }
  }

  async withdraw(r: Recommendation): Promise<void> {
    if (!confirm(this.d().withdrawConfirm)) return;
    try {
      await this.repo.withdrawRecommendation(r.id, this.auth.currentUserId());
      await this.reloadRecs();
    } catch {
      this.toast?.add({ severity: 'error', summary: this.t().common.error, detail: this.d().recFailed });
    }
  }

  async copy(): Promise<void> {
    try { await navigator.clipboard.writeText(this.inviteUrl()); this.toast?.add({ severity: 'success', summary: '', detail: this.d().copied, life: 2000 }); }
    catch { /* pano yok */ }
  }

  crop = cropDef;
  seasonOf(fieldId: string): Season | undefined { return this.seasons().find(s => s.fieldId === fieldId && s.status !== 'harvested'); }
  fieldName(id: string): string { return this.fields().find(f => f.id === id)?.name ?? ''; }
  icon(l: ApplicationLog): string { return TYPE_ICON[l.type]; }
  tile(l: ApplicationLog): string { return typeTile(l.type); }
  num(v: number): string { return fmtNum(v, this.lang()); }
  date(v: Date | null): string { return fmtDate(v, this.lang()); }
  lastSync(v: Date): string { return fmt(this.d().lastSync, { date: fmtDate(v, this.lang()) }); }
  expires(i: FarmerInvite): string { return fmt(this.d().expires, { date: fmtDate(i.expiresAt, this.lang()) }); }
  author(r: Recommendation): string { return fmt(this.d().author, { name: r.authorName, no: r.authorLicenseNo }); }
}

/** WhatsApp'tan açılabilen genel adres. Tauri/yerel kökende Firebase Hosting adresi kullanılır. */
function publicBaseUrl(): string {
  const loc = typeof location !== 'undefined' ? location : null;
  if (loc && /^https?:$/.test(loc.protocol) && loc.hostname !== 'tauri.localhost') return loc.origin;
  return `https://${environment.firebase.projectId}.web.app`;
}
