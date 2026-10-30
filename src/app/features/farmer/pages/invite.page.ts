import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerConsent, FarmerInvite } from '../../../shared/models/farmer.model';
import { FarmerAuthError, FarmerAuthService } from '../auth/farmer-auth.service';
import { FarmerSession } from '../auth/farmer-session.service';
import { fmt } from '../i18n/farmer.i18n';
import { LogoMarkComponent } from '../../../shared/ui/logo-mark.component';
import { F, TILE_TONE } from '../layout/farmer-ui';
import { defaultConsent } from '../utils/consent.util';
import { inviteState, InviteState, isInviteCodeFormat } from '../utils/identity.util';
import { FarmerConsentFormComponent } from './consent-form.component';
import { FarmerStore } from '../services/farmer-store.service';

/** /ciftci/davet/:code — davet kontrolü → izinler (açık rıza) → hesap aç / giriş yap / mevcut hesaba ekle. */
@Component({
  selector: 'app-farmer-invite',
  standalone: true,
  imports: [FormsModule, RouterLink, FarmerConsentFormComponent, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-page text-18 text-fg' },
  template: `
    <div class="field-dark px-4 pb-8 pt-[calc(28px+var(--safe-top))]">
      <div class="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <ui-logo-mark [size]="56" />
        <h1 class="m-0 font-display text-28 font-extrabold leading-tight">{{ t().farmer.invite.title }}</h1>
        @if (invite() && state() === 'valid') { <p class="m-0 text-16 text-side-soft">{{ invitedBy() }}</p> }
      </div>
    </div>
    <div class="mx-auto -mt-4 flex max-w-md flex-col gap-4 px-4 pb-10">
      @if (state() === null) {
        <p [class]="F.card + ' m-0 flex items-center gap-2 text-fg-muted'" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i>{{ t().farmer.invite.checking }}</p>
      } @else if (state() !== 'valid') {
        <div [class]="F.card + ' flex flex-col gap-3'">
          <p [class]="F.danger + ' m-0 flex items-start gap-2'" role="alert"><i class="pi pi-times-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ stateText() }}</span></p>
          <a routerLink="/ciftci/giris" [class]="F.btn2"><i class="pi pi-sign-in" aria-hidden="true"></i>{{ t().farmer.auth.login }}</a>
        </div>
      } @else if (invite(); as inv) {
        <div [class]="F.card">
          <p class="m-0 flex items-start gap-3 text-17">
            <span [class]="F.tile + ' ' + tone.brand"><i class="pi pi-mobile text-20" aria-hidden="true"></i></span>
            <span>{{ t().farmer.invite.what }}</span>
          </p>
          @if (inv.farmerId) { <p [class]="F.note + ' mb-0 mt-3'">{{ t().farmer.invite.resetNote }}</p> }
        </div>
        <p [class]="F.legal + ' m-0 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.legal.notAdvisor }}</span></p>

        <section [class]="F.card" aria-labelledby="inv-s1">
          <div [class]="F.head">
            <span class="num grid h-9 w-9 shrink-0 place-items-center rounded-token-lg bg-brand font-display text-17 font-extrabold text-brand-contrast" aria-hidden="true">1</span>
            <h2 id="inv-s1" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.invite.step1 }}</h2>
          </div>
          <p [class]="F.muted + ' mt-0'">{{ t().farmer.consent.intro }}</p>
          <app-farmer-consent-form [(consent)]="consent" idPrefix="inv-" />
          <details class="mt-3 rounded-token-lg border border-line bg-surface-muted px-3 py-2">
            <summary class="min-h-[44px] cursor-pointer content-center font-semibold">{{ t().farmer.consent.noticeTitle }}</summary>
            <p [class]="F.muted + ' text-15'">{{ t().farmer.consent.notice }}</p>
          </details>
          <label class="mt-3 flex min-h-[56px] cursor-pointer items-start gap-3 rounded-token-lg border border-brand-line bg-brand-soft p-3" for="inv-approve">
            <input id="inv-approve" type="checkbox" class="mt-0.5 h-7 w-7 shrink-0 accent-[var(--brand)]" [(ngModel)]="approved" name="approve" />
            <span class="font-semibold text-fg">{{ t().farmer.consent.approve }}</span>
          </label>
        </section>

        <section [class]="F.card" aria-labelledby="inv-s2">
          <div [class]="F.head">
            <span class="num grid h-9 w-9 shrink-0 place-items-center rounded-token-lg font-display text-17 font-extrabold" [class]="approved ? 'bg-brand text-brand-contrast' : 'bg-surface-strong text-fg-muted'" aria-hidden="true">2</span>
            <h2 id="inv-s2" class="m-0 font-display text-18 font-extrabold">{{ t().farmer.invite.step2 }}</h2>
          </div>
          @if (session.state() === 'ready') {
            <p class="mt-0">{{ signedInAs() }}</p>
            <button type="button" [class]="F.btn" [disabled]="!approved || busy()" (click)="acceptExisting()"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.invite.acceptWithAccount }}</button>
          } @else if (mode() === 'login') {
            <p [class]="F.note + ' mt-0'"><b>{{ t().farmer.invite.existingTitle }}</b><br />{{ t().farmer.invite.existingDesc }}</p>
            <form class="mt-3 flex flex-col gap-3" (ngSubmit)="loginAndAccept()">
              <div>
                <label for="inv-lphone" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-phone text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.phone }}</label>
                <input id="inv-lphone" name="lphone" type="tel" inputmode="tel" [class]="F.input + ' num'" [(ngModel)]="phone" />
              </div>
              <div>
                <label for="inv-lpin" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-lock text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.pin }}</label>
                <input id="inv-lpin" name="lpin" type="password" inputmode="numeric" maxlength="6" [class]="F.input + ' num text-center tracking-[0.5em]'" [(ngModel)]="pin" />
              </div>
              <button type="submit" [class]="F.btn" [disabled]="!approved || busy()"><i class="pi pi-sign-in" aria-hidden="true"></i>{{ t().farmer.invite.loginAndAccept }}</button>
            </form>
          } @else {
            <form class="flex flex-col gap-3" (ngSubmit)="register()">
              <div>
                <label for="inv-name" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-user text-brand-text" aria-hidden="true"></i>{{ t().farmer.invite.name }}</label>
                <input id="inv-name" name="name" autocomplete="name" [class]="F.input" [(ngModel)]="name" />
              </div>
              <div>
                <label for="inv-phone" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-phone text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.phone }}</label>
                <input id="inv-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" [class]="F.input + ' num'"
                       [placeholder]="t().farmer.auth.phonePh" [(ngModel)]="phone" />
                <small [class]="F.muted + ' text-14'">{{ t().farmer.invite.phoneHint }} (…<span class="num">{{ inv.phoneLast4 }}</span>)</small>
              </div>
              <div>
                <label for="inv-pin" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-lock text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.pin }}</label>
                <input id="inv-pin" name="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"
                       [class]="F.input + ' num text-center tracking-[0.5em]'" [(ngModel)]="pin" />
                <small [class]="F.muted + ' text-14'">{{ t().farmer.auth.pinRules }}</small>
              </div>
              <div>
                <label for="inv-pin2" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-lock text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.pinAgain }}</label>
                <input id="inv-pin2" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"
                       [class]="F.input + ' num text-center tracking-[0.5em]'" [(ngModel)]="pin2" />
              </div>
              <button type="submit" [class]="F.btn" [disabled]="!approved || busy()">
                <i class="pi" [class]="busy() ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>{{ busy() ? t().farmer.common.loading : t().farmer.invite.createAccount }}</button>
            </form>
          }
          @if (error()) { <p [class]="F.danger + ' mb-0 mt-3'" role="alert">{{ error() }}</p> }
        </section>
      }
    </div>
  `,
})
export class FarmerInvitePage implements OnInit {
  readonly t = inject(LangService).t;
  readonly F = F;
  readonly tone = TILE_TONE;
  readonly session = inject(FarmerSession);
  private readonly auth = inject(FarmerAuthService);
  private readonly store = inject(FarmerStore);
  private readonly router = inject(Router);
  private readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';

  readonly invite = signal<FarmerInvite | null>(null);
  readonly state = signal<InviteState | null>(null);
  readonly mode = signal<'register' | 'login'>('register');
  readonly busy = signal(false);
  readonly error = signal('');
  consent: FarmerConsent = defaultConsent();
  approved = false;
  name = '';
  phone = '';
  pin = '';
  pin2 = '';

  readonly invitedBy = computed(() => fmt(this.t().farmer.invite.invitedBy, { dealer: this.invite()?.tenantName || '—' }));
  readonly signedInAs = computed(() => fmt(this.t().farmer.invite.signedInAs, { name: this.session.farmer()?.displayName ?? '' }));
  readonly stateText = computed(() => {
    const i = this.t().farmer.invite;
    switch (this.state()) {
      case 'used': return i.used;
      case 'expired': return i.expired;
      case 'revoked': return i.revoked;
      default: return i.missing;
    }
  });

  async ngOnInit(): Promise<void> {
    void this.session.ensureLoaded();
    if (!isInviteCodeFormat(this.code)) { this.state.set('missing'); return; }
    try {
      const inv = await this.auth.getInvite(this.code);
      this.invite.set(inv);
      this.name = inv?.customerName ?? '';
      this.state.set(inviteState(inv));
    } catch {
      this.state.set('missing');
    }
  }

  async register(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    if (this.pin !== this.pin2) { this.error.set(this.t().farmer.auth.pinMismatch); return; }
    await this.run(() => this.auth.registerWithInvite(inv, this.phone, this.pin, this.name, this.stamp()));
  }

  async loginAndAccept(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    await this.run(async () => {
      await this.auth.signIn(this.phone, this.pin);
      await this.auth.acceptWithCurrentAccount(inv, this.stamp());
    });
  }

  async acceptExisting(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    await this.run(() => this.auth.acceptWithCurrentAccount(inv, this.stamp()));
  }

  private stamp(): FarmerConsent {
    const now = new Date();
    return { ...this.consent, grantedAt: now, updatedAt: now };
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await fn();
      this.store.clear();
      await this.router.navigate(['/ciftci']);
    } catch (err) {
      const code = err instanceof FarmerAuthError ? err.code : 'unknown';
      if (code === 'phone-exists') this.mode.set('login');
      this.error.set(code === 'phone-exists' ? '' : this.t().farmer.errors[code]);
    } finally {
      this.busy.set(false);
    }
  }
}
