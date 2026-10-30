import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/services/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { Customer } from '../../shared/models/customer.model';
import {
  ApplicationLog, FarmerInvite, FarmerLink, FarmField, PrescriberInfo, Recommendation,
} from '../../shared/models/farmer.model';
import { EmptyStateComponent, GlassCardComponent, PageHeaderComponent, StatCardComponent, StatusBadgeComponent } from '../../shared/ui';
import { CustomerService } from '../customers/services/customer.service';
import { DEALER_FARMER_REPOSITORY } from '../farmer/data/repositories';
import { PrescribersDialogComponent } from '../farmer/dealer/prescribers-dialog.component';
import { fmt } from '../farmer/i18n/farmer.i18n';
import { fmtDate, fmtNum } from '../farmer/layout/farmer-ui';
import { formatTrPhone, phoneLast4 } from '../farmer/utils/identity.util';
import { buildFarmerRows, CustomerBrief, FarmerRow, inviteDaysLeft } from './farmers-calc';
import { InviteShareComponent } from './invite-share.component';

interface CustomerOption { value: string; label: string; note: string; disabled: boolean }

/**
 * Bayi "Çiftçiler" sayfası (TASKS 14.9): bağlı çiftçiler, bekleyen davetler, müşteri davet etme, öneri geçmişi.
 * Yalnız admin + kasiyer (rota + kural). Veri: DealerFarmerRepository (tek seferlik okumalar, dinleyici yok);
 * tarla/defter bilgisi yalnız çiftçinin bu işletmeyle paylaştığı kadardır. Öneri yazımı müşteri kartından (yetkili kişi).
 */
@Component({
  selector: 'app-farmers-page',
  standalone: true,
  imports: [
    FormsModule, RouterLink, ButtonModule, SelectModule, PageHeaderComponent, GlassCardComponent, StatCardComponent,
    StatusBadgeComponent, EmptyStateComponent, InviteShareComponent, PrescribersDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="x().title" [subtitle]="x().subtitle">
      @if (isAdmin) {
        <p-button severity="secondary" icon="pi pi-id-card" [label]="d().prescribers" (onClick)="prescribersOpen.set(true)" />
      }
    </ui-page-header>

    <div class="page-body">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <ui-stat-card icon="pi-users" tone="success" [label]="x().statLinked" [value]="activeCount()" [loading]="loading()" />
        <ui-stat-card icon="pi-send" tone="info" [label]="x().statPending" [value]="validInvites()" [loading]="loading()" />
        <ui-stat-card icon="pi-map" tone="brand" [label]="x().statArea" [value]="num(sharedArea()) + ' da'" [loading]="loading()" />
        <ui-stat-card icon="pi-file-edit" tone="accent" [label]="x().statRecs" [value]="activeRecs()" [loading]="loading()" />
      </div>

      <p class="m-0 flex items-start gap-2 rounded-token-lg border border-line bg-surface-muted px-3.5 py-2.5 text-13 text-fg-secondary">
        <i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ x().legal }}</span>
      </p>

      @if (loadFailed()) {
        <p class="m-0 rounded-token-md bg-danger-soft px-3 py-2 text-sm text-danger-text" role="alert">{{ d().loadFailed }}</p>
      }

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-4">
        <!-- Bağlı çiftçiler -->
        <ui-glass-card [title]="x().linked" icon="pi-users" tone="success" padding="none" clip>
          @if (loading()) {
            <div class="flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1, 2, 3]; track i) { <div class="h-12 animate-pulse rounded-token-md bg-surface-muted"></div> }
            </div>
          } @else {
            <ul class="m-0 list-none p-0" data-testid="farmer-list">
              @for (r of rows(); track r.link.id) {
                <li class="border-b border-line last:border-b-0" [class.opacity-60]="r.link.status !== 'active'">
                  <a [routerLink]="['/customers', r.link.customerId]" class="list-row flex flex-col gap-1.5 px-4 py-3 no-underline sm:flex-row sm:items-center sm:gap-3">
                    <span class="min-w-0 flex-1">
                      <span class="flex flex-wrap items-center gap-2">
                        <b class="truncate text-14.5 text-fg">{{ r.name }}</b>
                        @if (r.link.status !== 'active') { <ui-status-badge size="sm" tone="neutral" icon="pi-times">{{ d().revoked }}</ui-status-badge> }
                      </span>
                      <span class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-12.5 text-fg-muted">
                        @if (r.phone) { <span class="num"><i class="pi pi-phone mr-1 text-10" aria-hidden="true"></i>{{ phone(r.phone) }}</span> }
                        @if (r.village) { <span><i class="pi pi-map-marker mr-1 text-10" aria-hidden="true"></i>{{ r.village }}</span> }
                        <span><i class="pi pi-map mr-1 text-10" aria-hidden="true"></i>{{ fieldsText(r) }}</span>
                        @if (r.lastActivity) { <span class="num"><i class="pi pi-history mr-1 text-10" aria-hidden="true"></i>{{ date(r.lastActivity) }}</span> }
                      </span>
                    </span>
                    <span class="flex shrink-0 flex-wrap items-center gap-1.5" [attr.aria-label]="d().consents">
                      <ui-status-badge size="sm" [tone]="r.link.consent.fields ? 'success' : 'neutral'" [icon]="r.link.consent.fields ? 'pi-check' : 'pi-times'">{{ d().cFields }}</ui-status-badge>
                      <ui-status-badge size="sm" [tone]="r.link.consent.logs ? 'success' : 'neutral'" [icon]="r.link.consent.logs ? 'pi-check' : 'pi-times'">{{ d().cLogs }}</ui-status-badge>
                      <i class="pi pi-chevron-right hidden text-11 text-fg-muted sm:inline" aria-hidden="true"></i>
                    </span>
                  </a>
                </li>
              } @empty {
                <ui-empty-state compact icon="pi-mobile" tone="success" [title]="x().noLinked" [description]="x().noLinkedDesc" />
              }
            </ul>
          }
        </ui-glass-card>

        <div class="flex flex-col gap-3 lg:gap-4">
          <!-- Müşteriyi davet et -->
          <ui-glass-card [title]="x().inviteCustomer" icon="pi-qrcode" tone="accent">
            <p class="m-0 mb-3 text-13 text-fg-secondary">{{ x().inviteHint }}</p>
            <div class="flex flex-col gap-2 sm:flex-row">
              <p-select inputId="farmers-customer" [options]="customerOptions()" optionLabel="label" optionValue="value" optionDisabled="disabled"
                [filter]="true" filterBy="label" [placeholder]="x().searchCustomer" [ariaLabel]="x().pickCustomer"
                [ngModel]="selectedCustomer()" (ngModelChange)="selectedCustomer.set($event)" styleClass="w-full min-w-0" class="min-w-0 flex-1" appendTo="body">
                <ng-template #item let-o>
                  <span class="flex w-full min-w-0 items-center gap-2">
                    <span class="min-w-0 flex-1 truncate">{{ o.label }}</span>
                    @if (o.note) { <small class="shrink-0 text-fg-muted">{{ o.note }}</small> }
                  </span>
                </ng-template>
              </p-select>
              <p-button icon="pi pi-qrcode" [label]="x().createInvite" [disabled]="!selectedCustomer()" [loading]="inviting()" (onClick)="inviteSelected()" />
            </div>
            @if (shared(); as s) {
              <div class="mt-3"><app-invite-share [invite]="s.invite" [phone]="s.phone" /></div>
            }
          </ui-glass-card>

          <!-- Bekleyen davetler -->
          <ui-glass-card [title]="x().pending" icon="pi-send" tone="info" padding="none" clip>
            <ul class="m-0 list-none p-0">
              @for (inv of invites(); track inv.code) {
                <li class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span class="min-w-0 flex-1">
                    <b class="block truncate text-14 text-fg">{{ inv.customerName }}</b>
                    <span class="num text-12 text-fg-muted">{{ inv.code }}</span>
                  </span>
                  <ui-status-badge size="sm" [tone]="daysTone(inv)">{{ daysText(inv) }}</ui-status-badge>
                  <span class="flex w-full justify-end gap-1 sm:w-auto">
                    @if (left(inv) >= 0) {
                      <p-button size="small" [text]="true" icon="pi pi-share-alt" [label]="x().share" (onClick)="showShare(inv)" />
                    } @else {
                      <p-button size="small" [text]="true" icon="pi pi-refresh" [label]="x().resend" [loading]="inviting()" (onClick)="resend(inv)" />
                    }
                    <p-button size="small" [text]="true" severity="danger" icon="pi pi-times" [label]="x().cancel" (onClick)="cancel(inv)" />
                  </span>
                </li>
              } @empty {
                <li class="px-4 py-3 text-sm text-fg-muted">{{ x().noPending }}</li>
              }
            </ul>
          </ui-glass-card>
        </div>
      </div>

      <!-- Öneri geçmişi -->
      <ui-glass-card [title]="x().recs" icon="pi-file-edit" padding="none" clip>
        <span card-actions class="flex items-center gap-1.5 text-12.5 font-semibold"
          [class]="canPrescribe() ? 'text-success-text' : 'text-fg-muted'">
          <i class="pi text-11" [class]="canPrescribe() ? 'pi-verified' : 'pi-lock'" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ canPrescribe() ? x().prescriberYes : x().prescriberNo }}</span>
        </span>
        <p class="m-0 border-b border-line px-4 py-2 text-12.5 text-fg-muted">{{ x().recHowTo }}</p>
        <ul class="m-0 list-none p-0">
          @for (r of recs(); track r.id) {
            <li class="border-b border-line last:border-b-0" [class.opacity-60]="r.status === 'withdrawn'">
              <a [routerLink]="customerLink(r)" class="list-row flex flex-col gap-1 px-4 py-2.5 no-underline">
                <span class="flex flex-wrap items-center gap-2">
                  <b class="min-w-0 flex-1 truncate text-14 text-fg">{{ r.target }}</b>
                  <ui-status-badge size="sm" [tone]="r.status === 'active' ? 'success' : 'neutral'">{{ r.status === 'active' ? x().active : d().withdrawn }}</ui-status-badge>
                  <span class="num text-12 text-fg-muted">{{ date(r.createdAt) }}</span>
                </span>
                <span class="truncate text-13 text-fg-secondary">{{ farmerName(r.farmerId) }} · {{ itemsText(r) }}</span>
                <small class="truncate text-fg-muted">{{ author(r) }}@if (r.prescriptionNo) { · e-reçete {{ r.prescriptionNo }} }</small>
              </a>
            </li>
          } @empty {
            <li class="px-4 py-3 text-sm text-fg-muted">{{ x().noRecs }}</li>
          }
        </ul>
      </ui-glass-card>
    </div>

    @if (isAdmin) {
      <app-prescribers-dialog [(visible)]="prescribersOpen" [tenantId]="tenantId" (changed)="loadPrescriber()" />
    }
  `,
})
export class FarmersPage implements OnInit {
  private readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly x = computed(() => this.t().farmer.farmers);
  readonly d = computed(() => this.t().farmer.dealer);
  private readonly repo = inject(DEALER_FARMER_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly tenantId = this.auth.currentTenantId();
  readonly isAdmin = this.auth.hasRole('admin');

  readonly customers = toSignal(inject(CustomerService).getAll$().pipe(catchError(() => of([] as Customer[]))), { initialValue: [] as Customer[] });
  readonly links = signal<FarmerLink[]>([]);
  readonly invites = signal<FarmerInvite[]>([]);
  readonly fields = signal<FarmField[]>([]);
  readonly logs = signal<ApplicationLog[]>([]);
  readonly recs = signal<Recommendation[]>([]);
  readonly prescriber = signal<PrescriberInfo | null>(null);
  readonly tenantName = signal('');
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly inviting = signal(false);
  readonly prescribersOpen = signal(false);
  readonly selectedCustomer = signal<string | null>(null);
  readonly shared = signal<{ invite: FarmerInvite; phone: string | null } | null>(null);

  private readonly customerMap = computed(() => new Map<string, CustomerBrief>(this.customers().map(c => [c.id, {
    id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone, village: c.village ?? null,
  }])));
  readonly rows = computed<FarmerRow[]>(() => buildFarmerRows(this.links(), this.fields(), this.logs(), this.customerMap()));
  readonly activeCount = computed(() => this.links().filter(l => l.status === 'active').length);
  readonly validInvites = computed(() => this.invites().filter(i => this.left(i) >= 0).length);
  readonly sharedArea = computed(() => this.rows().reduce((a, r) => a + (r.areaDecare ?? 0), 0));
  readonly activeRecs = computed(() => this.recs().filter(r => r.status === 'active').length);
  readonly canPrescribe = computed(() => !!this.prescriber()?.canPrescribe && !!this.prescriber()?.prescriberLicenseNo);

  readonly customerOptions = computed<CustomerOption[]>(() => {
    const linked = new Set(this.links().filter(l => l.status === 'active').map(l => l.customerId));
    const pending = new Set(this.invites().filter(i => this.left(i) >= 0).map(i => i.customerId));
    const x = this.x();
    return this.customers().map(c => {
      const hasPhone = phoneLast4(c.phone).length === 4;
      const isLinked = linked.has(c.id);
      const note = isLinked ? x.inApp : !hasPhone ? x.noPhone : pending.has(c.id) ? x.hasInvite : '';
      const name = `${c.firstName} ${c.lastName}`.trim();
      return { value: c.id, label: hasPhone ? `${name} · ${formatTrPhone(c.phone)}` : name, note, disabled: isLinked || !hasPhone };
    });
  });

  ngOnInit(): void {
    void this.load();
    void this.loadPrescriber();
    this.watchLinks();
  }

  /**
   * Y33: bağlantılar canlı — çiftçi daveti kabul edince "Bekleyen davet" ve bağlı çiftçi listesi yenilemeden güncellenir.
   * İlk anlık görüntü `load()` ile aynı veri; sonrakilerde davetler de yeniden okunur (kabul edilen davet kapanır).
   */
  private watchLinks(): void {
    let first = true;
    try {
      const unsub = this.repo.watchTenantLinks(this.tenantId, links => {
        this.links.set(links);
        if (first) { first = false; return; }
        this.repo.listTenantOpenInvites(this.tenantId).then(inv => this.setInvites(inv)).catch(() => undefined);
      }, err => console.warn('[Farmers] bağlantı dinleyicisi durdu', err));
      this.destroyRef.onDestroy(unsub);
    } catch (e) {
      console.warn('[Farmers] bağlantı dinleyicisi başlatılamadı', e);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [links, invites, recs, name] = await Promise.all([
        this.repo.listTenantLinks(this.tenantId),
        this.repo.listTenantOpenInvites(this.tenantId),
        this.repo.listTenantRecommendations(this.tenantId, 50),
        this.repo.getTenantName(this.tenantId),
      ]);
      this.links.set(links);
      this.setInvites(invites);
      this.recs.set(recs);
      this.tenantName.set(name);
      // Paylaşılan veri: izin yoksa boş döner; okunamazsa sayfa yine çalışır
      const [fields, logs] = await Promise.all([
        this.repo.listTenantSharedFields(this.tenantId).catch(() => [] as FarmField[]),
        this.repo.listTenantRecentLogs(this.tenantId, 300).catch(() => [] as ApplicationLog[]),
      ]);
      this.fields.set(fields);
      this.logs.set(logs);
    } catch (e) {
      console.warn('[Farmers] yüklenemedi', e);
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadPrescriber(): Promise<void> {
    this.prescriber.set(await this.repo.getPrescriber(this.auth.currentUserId()).catch(() => null));
  }

  private setInvites(list: FarmerInvite[]): void {
    this.invites.set([...list].sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime()));
  }

  async inviteSelected(): Promise<void> {
    const c = this.customers().find(x => x.id === this.selectedCustomer());
    if (c) await this.createInvite(c.id, `${c.firstName} ${c.lastName}`.trim(), c.phone);
  }

  async resend(inv: FarmerInvite): Promise<void> {
    const c = this.customers().find(x => x.id === inv.customerId);
    await this.createInvite(inv.customerId, inv.customerName, c?.phone ?? null, inv.farmerId, inv.phoneLast4);
  }

  private async createInvite(customerId: string, customerName: string, phone: string | null, farmerId: string | null = null, last4?: string): Promise<void> {
    const p4 = last4 ?? phoneLast4(phone);
    if (p4.length !== 4) { this.toast?.add({ severity: 'warn', summary: '', detail: this.d().noPhone }); return; }
    this.inviting.set(true);
    try {
      const inv = await this.repo.createInvite({
        tenantId: this.tenantId, tenantName: this.tenantName(), customerId, customerName, phoneLast4: p4, farmerId,
        createdBy: this.auth.currentUserId(),
      });
      // Aynı müşterinin eski davetleri repository'de iptal edildi
      this.setInvites([inv, ...this.invites().filter(i => i.customerId !== customerId)]);
      this.shared.set({ invite: inv, phone });
      this.selectedCustomer.set(null);
      this.toast?.add({ severity: 'success', summary: '', detail: this.d().inviteCreated, life: 2500 });
    } catch {
      this.toast?.add({ severity: 'error', summary: this.t().common.error, detail: this.d().inviteFailed });
    } finally {
      this.inviting.set(false);
    }
  }

  showShare(inv: FarmerInvite): void {
    const c = this.customers().find(x => x.id === inv.customerId);
    this.shared.set({ invite: inv, phone: c?.phone ?? null });
  }

  async cancel(inv: FarmerInvite): Promise<void> {
    if (!confirm(this.x().cancelConfirm)) return;
    try {
      await this.repo.revokeInvite(inv.code);
      this.invites.set(this.invites().filter(i => i.code !== inv.code));
      if (this.shared()?.invite.code === inv.code) this.shared.set(null);
      this.toast?.add({ severity: 'success', summary: '', detail: this.x().cancelled, life: 2000 });
    } catch {
      this.toast?.add({ severity: 'error', summary: this.t().common.error, detail: this.d().inviteFailed });
    }
  }

  left(inv: FarmerInvite): number { return inviteDaysLeft(inv); }
  daysText(inv: FarmerInvite): string {
    const n = this.left(inv);
    return n < 0 ? this.x().expired : n === 0 ? this.x().expiresToday : fmt(this.x().expiresIn, { n });
  }
  daysTone(inv: FarmerInvite): 'danger' | 'warning' | 'info' {
    const n = this.left(inv);
    return n < 0 ? 'danger' : n <= 1 ? 'warning' : 'info';
  }
  fieldsText(r: FarmerRow): string {
    return r.fieldCount === null ? `${this.d().cFields}: ${this.x().notShared}` : fmt(this.x().fieldsSummary, { n: r.fieldCount, area: this.num(r.areaDecare ?? 0) });
  }
  farmerName(farmerId: string): string {
    return this.rows().find(r => r.link.farmerId === farmerId)?.name ?? '';
  }
  customerLink(r: Recommendation): unknown[] | null {
    const l = this.links().find(x => x.farmerId === r.farmerId);
    return l ? ['/customers', l.customerId] : null;
  }
  itemsText(r: Recommendation): string { return r.items.map(i => i.productName).join(', '); }
  author(r: Recommendation): string { return fmt(this.d().author, { name: r.authorName, no: r.authorLicenseNo }); }
  phone(p: string): string { return formatTrPhone(p); }
  num(v: number): string { return fmtNum(v, this.lang.lang()); }
  date(v: Date | null): string { return fmtDate(v, this.lang.lang()); }
}
