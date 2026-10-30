import { ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerConsent, FarmerInvite } from '../../../shared/models/farmer.model';
import { FarmerAuthError, FarmerAuthService } from '../auth/farmer-auth.service';
import { FarmerSession } from '../auth/farmer-session.service';
import { fmt } from '../i18n/farmer.i18n';
import { LogoMarkComponent } from '../../../shared/ui/logo-mark.component';
import { F } from '../layout/farmer-ui';
import { defaultConsent } from '../utils/consent.util';
import { inviteState, InviteState, isInviteCodeFormat, isValidPin, normalizeTrPhone } from '../utils/identity.util';
import { FarmerConsentFormComponent } from './consent-form.component';
import { FarmerStore } from '../services/farmer-store.service';

/** Hata hangi alanı gösterir (odak + kaydırma). */
type ErrorTarget = 'inv-approve' | 'inv-name' | 'inv-phone' | 'inv-pin' | 'inv-pin2' | 'inv-lphone' | 'inv-lpin' | 'inv-error';

/**
 * /ciftci/davet/:code — davet kontrolü → hesap aç / giriş yap / mevcut hesaba ekle (+ açık rıza).
 * Mobilde tek ekrana yakın (rapor #10): izinler katlanır (isteğe bağlılar varsayılan kapalı), rıza kutusu düğmenin
 * hemen üstünde, düğme pasif değil — basınca eksik adımı söyleyip o alana kaydırır / odaklar.
 * Bu tarayıcıda bayi oturumu açıksa sessizce çiftçi hesabına geçilmez (rapor Y17): önce çıkış istenir.
 */
@Component({
  selector: 'app-farmer-invite',
  standalone: true,
  imports: [FormsModule, RouterLink, FarmerConsentFormComponent, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-page text-18 text-fg' },
  template: `
    <div class="field-dark px-4 pb-7 pt-[calc(16px+var(--safe-top))]">
      <div class="mx-auto flex max-w-md items-center gap-3">
        <ui-logo-mark [size]="40" />
        <div class="min-w-0 flex-1">
          <h1 class="m-0 font-display text-22 font-extrabold leading-tight">{{ t().farmer.invite.title }}</h1>
          @if (invite() && state() === 'valid') { <p class="m-0 text-15 leading-snug text-side-soft">{{ invitedBy() }}</p> }
        </div>
      </div>
    </div>
    <div class="mx-auto -mt-4 flex max-w-md flex-col gap-3 px-4 pb-8">
      @if (state() === null) {
        <p [class]="F.card + ' m-0 flex items-center gap-2 text-fg-muted'" role="status"><i class="pi pi-spin pi-spinner" aria-hidden="true"></i>{{ t().farmer.invite.checking }}</p>
      } @else if (state() !== 'valid') {
        <div [class]="F.card + ' flex flex-col gap-3'">
          <p [class]="F.danger + ' m-0 flex items-start gap-2'" role="alert"><i class="pi pi-times-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ stateText() }}</span></p>
          <a routerLink="/ciftci/giris" [class]="F.btn2"><i class="pi pi-sign-in" aria-hidden="true"></i>{{ t().farmer.auth.login }}</a>
        </div>
      } @else if (session.state() === 'dealer') {
        <!-- Y17: bayinin kendi tarayıcısı — oturumu sessizce çiftçiye çevirme -->
        <div [class]="F.card + ' flex flex-col gap-3'">
          <p [class]="F.note + ' m-0 flex items-start gap-2'" role="alert"><i class="pi pi-exclamation-triangle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ dealerSession() }}</span></p>
          <button type="button" [class]="F.btn2" [disabled]="busy()" (click)="signOutOther()"><i class="pi pi-sign-out" aria-hidden="true"></i>{{ t().farmer.invite.signOutContinue }}</button>
        </div>
      } @else if (invite(); as inv) {
        <div [class]="F.card + ' py-3'">
          <p class="m-0 text-16 leading-snug">{{ t().farmer.invite.what }}</p>
          @if (inv.farmerId) { <p [class]="F.note + ' mb-0 mt-2'">{{ t().farmer.invite.resetNote }}</p> }
        </div>

        <section [class]="F.card + ' py-3'" aria-labelledby="inv-s2">
          <h2 id="inv-s2" class="m-0 mb-2 font-display text-18 font-extrabold">{{ t().farmer.invite.step2 }}</h2>
          @if (session.state() === 'ready') {
            <p class="mt-0">{{ signedInAs() }}</p>
          } @else if (mode() === 'login') {
            <p [class]="F.note + ' mt-0'"><b>{{ t().farmer.invite.existingTitle }}</b><br />{{ t().farmer.invite.existingDesc }}</p>
            <div class="mt-3 flex flex-col gap-3">
              <div>
                <label for="inv-lphone" [class]="F.label">{{ t().farmer.auth.phone }}</label>
                <input id="inv-lphone" name="lphone" type="tel" inputmode="tel" [class]="F.input + ' num'" [(ngModel)]="phone" />
              </div>
              <div>
                <label for="inv-lpin" [class]="F.label">{{ t().farmer.auth.pin }}</label>
                <input id="inv-lpin" name="lpin" type="password" inputmode="numeric" maxlength="6" [class]="F.input + ' num text-center tracking-[0.5em]'" [(ngModel)]="pin" />
              </div>
            </div>
          } @else {
            <div class="flex flex-col gap-3">
              <div>
                <label for="inv-name" [class]="F.label">{{ t().farmer.invite.name }}</label>
                <input id="inv-name" name="name" autocomplete="name" [class]="F.input" [(ngModel)]="name" [attr.aria-invalid]="target() === 'inv-name' || null" />
              </div>
              <div>
                <label for="inv-phone" [class]="F.label">{{ t().farmer.auth.phone }} <small class="font-normal text-fg-muted">(…<span class="num">{{ inv.phoneLast4 }}</span>)</small></label>
                <input id="inv-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" [class]="F.input + ' num'"
                       [placeholder]="t().farmer.auth.phonePh" [(ngModel)]="phone" [attr.aria-invalid]="target() === 'inv-phone' || null" />
                <small [class]="F.muted + ' text-14'">{{ t().farmer.invite.phoneHint }}</small>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label for="inv-pin" [class]="F.label">{{ t().farmer.auth.pin }}</label>
                  <input id="inv-pin" name="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"
                         [class]="F.input + ' num px-2 text-center tracking-[0.3em]'" [(ngModel)]="pin" [attr.aria-invalid]="target() === 'inv-pin' || null" />
                </div>
                <div>
                  <label for="inv-pin2" [class]="F.label">{{ t().farmer.auth.pinAgain }}</label>
                  <input id="inv-pin2" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6"
                         [class]="F.input + ' num px-2 text-center tracking-[0.3em]'" [(ngModel)]="pin2" [attr.aria-invalid]="target() === 'inv-pin2' || null" />
                </div>
              </div>
              <small [class]="F.muted + ' -mt-1 text-14'">{{ t().farmer.auth.pinRules }}</small>
            </div>
          }

          <!-- İzinler: isteğe bağlılar varsayılan kapalı; açıp seçmek tek dokunuş -->
          <details class="mt-3 rounded-token-lg border border-line bg-surface-muted px-3 py-1">
            <summary class="flex min-h-[48px] cursor-pointer items-center gap-2 font-semibold">
              <i class="pi pi-shield text-brand-text" aria-hidden="true"></i><span class="min-w-0 flex-1">{{ t().farmer.invite.permissionsSummary }}</span>
            </summary>
            <p [class]="F.muted + ' mb-2 mt-0 text-15'">{{ t().farmer.consent.intro }}</p>
            <app-farmer-consent-form [(consent)]="consent" idPrefix="inv-" />
            <details class="my-2">
              <summary class="min-h-[44px] cursor-pointer content-center text-15 font-semibold">{{ t().farmer.consent.noticeTitle }}</summary>
              <p [class]="F.muted + ' text-15'">{{ t().farmer.consent.notice }}</p>
            </details>
          </details>

          <label class="mt-3 flex min-h-[56px] cursor-pointer items-start gap-3 rounded-token-lg border p-3" for="inv-approve"
                 [class]="target() === 'inv-approve' ? 'border-danger bg-danger-soft' : 'border-brand-line bg-brand-soft'">
            <input id="inv-approve" type="checkbox" class="mt-0.5 h-7 w-7 shrink-0 accent-[var(--brand)]" [(ngModel)]="approved" name="approve"
                   (ngModelChange)="target() === 'inv-approve' && clearError()" [attr.aria-invalid]="target() === 'inv-approve' || null"
                   aria-describedby="inv-approve-plain" />
            <span class="min-w-0">
              <span class="block font-semibold text-fg">{{ t().farmer.consent.approve }}</span>
              <small id="inv-approve-plain" class="block text-14 text-fg-secondary">{{ t().farmer.consent.approvePlain }}</small>
            </span>
          </label>

          @if (error()) {
            <p id="inv-error" tabindex="-1" [class]="F.danger + ' mb-0 mt-3 flex items-start gap-2'" role="alert">
              <i class="pi pi-exclamation-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ error() }}</span></p>
          } @else if (!approved) {
            <p class="m-0 mt-2 flex items-start gap-2 text-15 text-fg-secondary"><i class="pi pi-arrow-up mt-0.5 shrink-0 text-13" aria-hidden="true"></i>{{ t().farmer.invite.approveFirst }}</p>
          }

          @if (session.state() === 'ready') {
            <button type="button" [class]="F.btn + ' mt-3'" [disabled]="busy()" (click)="acceptExisting()"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.invite.acceptWithAccount }}</button>
          } @else if (mode() === 'login') {
            <button type="button" [class]="F.btn + ' mt-3'" [disabled]="busy()" (click)="loginAndAccept()"><i class="pi pi-sign-in" aria-hidden="true"></i>{{ t().farmer.invite.loginAndAccept }}</button>
          } @else {
            <button type="button" [class]="F.btn + ' mt-3'" [disabled]="busy()" (click)="register()">
              <i class="pi" [class]="busy() ? 'pi-spin pi-spinner' : 'pi-check'" aria-hidden="true"></i>{{ busy() ? t().farmer.common.loading : t().farmer.invite.createAccount }}</button>
          }
        </section>
        <p class="m-0 flex items-start gap-2 px-1 text-14 leading-snug text-fg-muted"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.legal.notAdvisor }}</span></p>
      }
    </div>
  `,
})
export class FarmerInvitePage implements OnInit {
  readonly t = inject(LangService).t;
  readonly F = F;
  readonly session = inject(FarmerSession);
  private readonly auth = inject(FarmerAuthService);
  private readonly store = inject(FarmerStore);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';

  readonly invite = signal<FarmerInvite | null>(null);
  readonly state = signal<InviteState | null>(null);
  readonly mode = signal<'register' | 'login'>('register');
  readonly busy = signal(false);
  readonly error = signal('');
  /** Hatanın ilgili olduğu alan (kırmızı çerçeve + odak) */
  readonly target = signal<ErrorTarget | null>(null);
  consent: FarmerConsent = defaultConsent();
  approved = false;
  name = '';
  phone = '';
  pin = '';
  pin2 = '';

  readonly invitedBy = computed(() => fmt(this.t().farmer.invite.invitedBy, { dealer: this.invite()?.tenantName || '—' }));
  readonly signedInAs = computed(() => fmt(this.t().farmer.invite.signedInAs, { name: this.session.farmer()?.displayName ?? '' }));
  readonly dealerSession = computed(() => {
    this.session.state();
    return fmt(this.t().farmer.invite.dealerSession, { email: this.auth.currentEmail() ?? '' });
  });
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

  clearError(): void {
    this.error.set('');
    this.target.set(null);
  }

  /** Bayi oturumunu kapat; sayfa aynı davetle çiftçi kaydına devam eder. */
  async signOutOther(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.signOut();
      await this.session.ensureLoaded(true);
    } finally {
      this.busy.set(false);
    }
  }

  async register(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    const v = this.t().farmer;
    if (!this.approved) return this.fail(v.invite.approveMissing, 'inv-approve');
    if (!this.name.trim()) return this.fail(v.invite.nameRequired, 'inv-name');
    if (!normalizeTrPhone(this.phone)) return this.fail(v.errors['invalid-phone'], 'inv-phone');
    if (!isValidPin(this.pin)) return this.fail(v.errors['invalid-pin'], 'inv-pin');
    if (this.pin !== this.pin2) return this.fail(v.auth.pinMismatch, 'inv-pin2');
    await this.run(() => this.auth.registerWithInvite(inv, this.phone, this.pin, this.name, this.stamp()));
  }

  async loginAndAccept(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    if (!this.approved) return this.fail(this.t().farmer.invite.approveMissing, 'inv-approve');
    await this.run(async () => {
      await this.auth.signIn(this.phone, this.pin);
      await this.auth.acceptWithCurrentAccount(inv, this.stamp());
    });
  }

  async acceptExisting(): Promise<void> {
    const inv = this.invite();
    if (!inv) return;
    if (!this.approved) return this.fail(this.t().farmer.invite.approveMissing, 'inv-approve');
    await this.run(() => this.auth.acceptWithCurrentAccount(inv, this.stamp()));
  }

  private stamp(): FarmerConsent {
    const now = new Date();
    return { ...this.consent, grantedAt: now, updatedAt: now };
  }

  /** Hatayı düğmenin hemen üstünde gösterir; ilgili alana kaydırıp odaklar (ekran dışında kalmasın). */
  private fail(message: string, target: ErrorTarget): void {
    this.error.set(message);
    this.target.set(target);
    setTimeout(() => {
      const el = this.doc.getElementById(target) ?? this.doc.getElementById('inv-error');
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      el?.focus?.({ preventScroll: true });
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.clearError();
    this.busy.set(true);
    try {
      await fn();
      this.store.clear();
      await this.router.navigate(['/ciftci']);
    } catch (err) {
      const code = err instanceof FarmerAuthError ? err.code : 'unknown';
      if (code === 'phone-exists') { this.mode.set('login'); this.pin = ''; this.pin2 = ''; return; }
      const login = this.mode() === 'login';
      const target: ErrorTarget = code === 'phone-mismatch' || code === 'invalid-phone' ? (login ? 'inv-lphone' : 'inv-phone')
        : code === 'invalid-pin' || code === 'invalid-login' ? (login ? 'inv-lpin' : 'inv-pin') : 'inv-error';
      this.fail(this.t().farmer.errors[code], target);
    } finally {
      this.busy.set(false);
    }
  }
}
