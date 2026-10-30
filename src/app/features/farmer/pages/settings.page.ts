import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { FarmerConsent, FarmerLink } from '../../../shared/models/farmer.model';
import { FarmerAuthService } from '../auth/farmer-auth.service';
import { FarmerSession } from '../auth/farmer-session.service';
import { FARMER_ACCOUNT_REPOSITORY, FARMER_LINK_REPOSITORY } from '../data/repositories';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, TILE_TONE } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { computeShareTargets } from '../utils/consent.util';
import { formatTrPhone } from '../utils/identity.util';
import { FarmerConsentFormComponent } from './consent-form.component';
import { TourService } from '../../../core/onboarding/tour.service';
import { injectOnboardingTexts } from '../../../core/onboarding/onboarding.i18n';

/** Ayarlar: profil, bayilerim + izinler (KVKK: ayrı ayrı aç/kapa, bağlantıyı kopar), yasal metinler, silme talebi, çıkış. */
@Component({
  selector: 'app-farmer-settings',
  standalone: true,
  imports: [FormsModule, FarmerHeaderComponent, FarmerConsentFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.nav.account" />
    <div class="flex flex-col gap-4">
      @if (message()) { <p [class]="F.legal + ' m-0 flex items-center gap-2 font-semibold text-fg'" role="status"><i class="pi pi-info-circle" aria-hidden="true"></i>{{ message() }}</p> }

      <section [class]="F.card" aria-labelledby="st-p">
        <div [class]="F.head">
          <span [class]="F.tile + ' h-9 w-9 ' + tone.brand"><i class="pi pi-user text-17" aria-hidden="true"></i></span>
          <h2 id="st-p" class="m-0 min-w-0 flex-1 font-display text-18 font-extrabold">{{ t().farmer.settings.profile }}</h2>
          <span class="num shrink-0 text-15 text-fg-muted"><i class="pi pi-phone mr-1 text-13" aria-hidden="true"></i>{{ phone() }}</span>
        </div>
        <form class="flex flex-col gap-3" (ngSubmit)="saveProfile()">
          <div><label for="st-name" [class]="F.label">{{ t().farmer.settings.name }}</label><input id="st-name" name="name" [class]="F.input" [(ngModel)]="name" /></div>
          <div class="grid grid-cols-2 gap-2">
            <div><label for="st-city" [class]="F.label">{{ t().farmer.fields.city }}</label><input id="st-city" name="city" [class]="F.input" [(ngModel)]="city" /></div>
            <div><label for="st-dist" [class]="F.label">{{ t().farmer.fields.district }}</label><input id="st-dist" name="district" [class]="F.input" [(ngModel)]="district" /></div>
          </div>
          <div><label for="st-vil" [class]="F.label">{{ t().farmer.fields.village }}</label><input id="st-vil" name="village" [class]="F.input" [(ngModel)]="village" /></div>
          <div><label for="st-cks" [class]="F.label">{{ t().farmer.settings.cks }} ({{ t().farmer.common.optional }})</label><input id="st-cks" name="cks" inputmode="numeric" [class]="F.input + ' num'" [(ngModel)]="cks" /></div>
          <button type="submit" [class]="F.btn2" [disabled]="busy()"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.common.save }}</button>
        </form>
      </section>

      <section [class]="F.card" aria-labelledby="st-d">
        <div [class]="F.head">
          <span [class]="F.tile + ' h-9 w-9 ' + tone.accent"><i class="pi pi-shop text-17" aria-hidden="true"></i></span>
          <h2 id="st-d" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.settings.dealers }}</h2>
        </div>
        <p [class]="F.muted + ' mt-0'">{{ t().farmer.consent.intro }}</p>
        @for (l of session.links(); track l.id) {
          <div class="mt-3 rounded-token-lg border border-line p-3">
            <p class="m-0 mb-2 font-display text-19 font-extrabold">{{ l.tenantName }}</p>
            @if (l.status === 'active') {
              <app-farmer-consent-form [consent]="drafts[l.id]" (consentChange)="drafts[l.id] = $event" [idPrefix]="'st-' + l.id + '-'" />
              <p class="m-0 mt-2 text-13 text-fg-muted">{{ version(l) }}</p>
              <div class="mt-3 grid grid-cols-2 gap-2">
                <button type="button" [class]="F.btn" [disabled]="busy()" (click)="saveConsent(l)"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.common.save }}</button>
                <button type="button" [class]="F.btnDanger" [disabled]="busy()" (click)="revoke(l)"><i class="pi pi-times" aria-hidden="true"></i>{{ t().farmer.settings.revoke }}</button>
              </div>
            } @else {
              <p class="m-0 inline-flex h-7 items-center rounded-token-sm bg-surface-strong px-2 text-14 font-semibold text-fg-secondary">{{ t().farmer.settings.linkRevoked }}</p>
              <p [class]="F.muted + ' mb-0 mt-2 text-15'">{{ t().farmer.settings.reconnectHint }}</p>
            }
          </div>
        }
      </section>

      <section [class]="F.card" aria-labelledby="st-l">
        <div [class]="F.head">
          <span [class]="F.tile + ' h-9 w-9 ' + tone.neutral"><i class="pi pi-info-circle text-17" aria-hidden="true"></i></span>
          <h2 id="st-l" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.settings.legalTitle }}</h2>
        </div>
        <p class="mt-0 text-16 text-fg-secondary">{{ t().farmer.legal.notAdvisor }}</p>
        <p class="text-16 text-fg-secondary">{{ t().farmer.legal.personalLog }}</p>
        <details class="rounded-token-lg border border-line bg-surface-muted px-3 py-2">
          <summary class="min-h-[44px] cursor-pointer content-center font-semibold">{{ t().farmer.consent.noticeTitle }}</summary>
          <p [class]="F.muted + ' text-15'">{{ t().farmer.consent.notice }}</p>
        </details>
      </section>

      <section [class]="F.card" aria-labelledby="st-a">
        <div [class]="F.head">
          <span [class]="F.tile + ' h-9 w-9 ' + tone.neutral"><i class="pi pi-cog text-17" aria-hidden="true"></i></span>
          <h2 id="st-a" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.nav.settings }}</h2>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" [class]="F.btn2 + ' text-17'" (click)="lang.toggle()"><i class="pi pi-globe" aria-hidden="true"></i>{{ lang.lang() === 'tr' ? 'English' : 'Türkçe' }}</button>
          <button type="button" [class]="F.btn2 + ' text-17'" (click)="theme.toggle()" [attr.aria-pressed]="theme.isDark()">
            <i class="pi" [class]="theme.isDark() ? 'pi-sun' : 'pi-moon'" aria-hidden="true"></i>{{ theme.isDark() ? t().farmer.settings.light : t().farmer.settings.dark }}</button>
        </div>
        <button type="button" [class]="F.btn2 + ' mt-2 text-17'" (click)="tour.restartWelcome()"><i class="pi pi-compass" aria-hidden="true"></i>{{ ob().replayBtn }}</button>
        <p [class]="F.muted + ' flex items-start gap-2 text-15'"><i class="pi pi-mobile mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.settings.addToHome }}</span></p>
        @if (session.farmer()?.deletionRequestedAt; as d) {
          <p [class]="F.note">{{ deletionText(d) }}</p>
        } @else {
          <button type="button" [class]="F.btnDanger + ' text-16'" [disabled]="busy()" (click)="requestDeletion()"><i class="pi pi-trash" aria-hidden="true"></i>{{ t().farmer.settings.deleteRequest }}</button>
        }
        <button type="button" [class]="F.btn2 + ' mt-3'" (click)="logout()"><i class="pi pi-sign-out" aria-hidden="true"></i>{{ t().farmer.auth.logout }}</button>
      </section>
    </div>
  `,
})
export class FarmerSettingsPage implements OnInit {
  readonly lang = inject(LangService);
  readonly t = this.lang.t;
  readonly theme = inject(ThemeService);
  readonly tour = inject(TourService);
  readonly ob = injectOnboardingTexts();
  readonly F = F;
  readonly tone = TILE_TONE;
  readonly session = inject(FarmerSession);
  private readonly store = inject(FarmerStore);
  private readonly auth = inject(FarmerAuthService);
  private readonly accounts = inject(FARMER_ACCOUNT_REPOSITORY);
  private readonly links = inject(FARMER_LINK_REPOSITORY);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly message = signal('');
  drafts: Record<string, FarmerConsent> = {};
  name = '';
  city = '';
  district = '';
  village = '';
  cks = '';

  ngOnInit(): void {
    const f = this.session.farmer();
    this.name = f?.displayName ?? ''; this.city = f?.city ?? ''; this.district = f?.district ?? '';
    this.village = f?.village ?? ''; this.cks = f?.cksNo ?? '';
    this.resetDrafts();
  }

  phone(): string { return formatTrPhone(this.session.farmer()?.phone); }
  version(l: FarmerLink): string { return fmt(this.t().farmer.consent.version, { v: l.consent.textVersion, d: fmtDate(l.consent.updatedAt ?? l.consent.grantedAt, this.lang.lang()) }); }
  deletionText(d: Date): string { return fmt(this.t().farmer.settings.deleteRequested, { date: fmtDate(d, this.lang.lang()) }); }

  private resetDrafts(): void {
    this.drafts = Object.fromEntries(this.session.links().map(l => [l.id, { ...l.consent }]));
  }

  async saveProfile(): Promise<void> {
    const fid = this.session.farmerId();
    if (!fid) return;
    await this.run(async () => {
      const opt = (s: string) => s.trim() || null;
      await this.accounts.updateFarmer(fid, { displayName: this.name.trim() || (this.session.farmer()?.displayName ?? ''), city: opt(this.city), district: opt(this.district), village: opt(this.village), cksNo: opt(this.cks) });
      await this.session.refreshFarmer();
    }, this.t().farmer.settings.saved);
  }

  async saveConsent(l: FarmerLink): Promise<void> {
    await this.run(async () => {
      await this.links.updateConsent(l.id, { ...this.drafts[l.id], updatedAt: new Date() });
      await this.resync();
    }, this.t().farmer.consent.saved);
  }

  async revoke(l: FarmerLink): Promise<void> {
    if (!confirm(fmt(this.t().farmer.settings.revokeConfirm, { dealer: l.tenantName }))) return;
    await this.run(async () => {
      await this.links.revoke(l.id);
      await this.resync();
    }, this.t().farmer.settings.revoked);
  }

  /** İzin değişince paylaşım listeleri (sharedTenantIds) toplu güncellenir → kurallar bayinin erişimini anında keser. */
  private async resync(): Promise<void> {
    await this.session.refreshLinks();
    const fid = this.session.farmerId();
    if (fid) await this.links.applySharing(fid, computeShareTargets(this.session.links()));
    this.resetDrafts();
    await this.store.load(true);
  }

  async requestDeletion(): Promise<void> {
    const fid = this.session.farmerId();
    if (!fid || !confirm(this.t().farmer.settings.deleteConfirm)) return;
    await this.run(async () => {
      await this.accounts.requestDeletion(fid);
      await this.session.refreshFarmer();
    }, '');
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.store.clear();
    await this.router.navigate(['/ciftci/giris']);
  }

  private async run(fn: () => Promise<void>, ok: string): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try {
      await fn();
      this.message.set(ok);
    } catch {
      this.message.set(this.t().farmer.common.saveFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
