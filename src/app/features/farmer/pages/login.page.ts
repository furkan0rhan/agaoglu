import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { FarmerAuthError, FarmerAuthService } from '../auth/farmer-auth.service';
import { LogoMarkComponent } from '../../../shared/ui/logo-mark.component';
import { F } from '../layout/farmer-ui';

@Component({
  selector: 'app-farmer-login',
  standalone: true,
  imports: [FormsModule, RouterLink, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-dvh bg-page text-18 text-fg' },
  template: `
    <div class="field-dark px-4 pb-8 pt-[calc(28px+var(--safe-top))]">
      <div class="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <ui-logo-mark [size]="56" />
        <h1 class="m-0 font-display text-28 font-extrabold leading-tight">{{ t().farmer.auth.loginTitle }}</h1>
        <p class="m-0 text-16 text-side-soft">{{ t().farmer.auth.loginSubtitle }}</p>
      </div>
    </div>
    <div class="mx-auto -mt-4 flex max-w-md flex-col gap-4 px-4 pb-10">
      <div [class]="F.card + ' flex flex-col gap-4 p-5'">
        @if (reason === 'not-owner') { <p [class]="F.note + ' m-0'" role="alert">{{ t().farmer.auth.notOwner }}</p> }
        <form class="flex flex-col gap-4" (ngSubmit)="submit()">
          <div>
            <label for="fl-phone" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-phone text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.phone }}</label>
            <input id="fl-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" [class]="F.input + ' num text-20'"
                   [placeholder]="t().farmer.auth.phonePh" [(ngModel)]="phone" required />
          </div>
          <div>
            <label for="fl-pin" [class]="F.label + ' flex items-center gap-2'"><i class="pi pi-lock text-brand-text" aria-hidden="true"></i>{{ t().farmer.auth.pin }}</label>
            <input id="fl-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6"
                   [class]="F.input + ' num text-center text-24 tracking-[0.5em]'" [(ngModel)]="pin" required />
          </div>
          @if (error()) { <p [class]="F.danger + ' m-0'" role="alert">{{ error() }}</p> }
          <button type="submit" [class]="F.btn + ' min-h-[60px] text-20'" [disabled]="busy()">
            <i class="pi" [class]="busy() ? 'pi-spin pi-spinner' : 'pi-sign-in'" aria-hidden="true"></i>{{ busy() ? t().farmer.common.loading : t().farmer.auth.login }}
          </button>
        </form>
      </div>
      <div [class]="F.legal + ' flex flex-col gap-2'">
        <p class="m-0 flex items-start gap-2"><i class="pi pi-key mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.auth.forgotPin }}</span></p>
        <p class="m-0 flex items-start gap-2"><i class="pi pi-envelope mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.auth.noAccount }}</span></p>
      </div>
      <a routerLink="/auth/login" class="inline-flex min-h-[48px] items-center justify-center gap-2 text-center text-16 font-semibold text-brand-text underline">
        <i class="pi pi-shop" aria-hidden="true"></i>{{ t().farmer.auth.dealerLogin }}</a>
    </div>
  `,
})
export class FarmerLoginPage {
  readonly t = inject(LangService).t;
  readonly F = F;
  private readonly auth = inject(FarmerAuthService);
  private readonly router = inject(Router);
  readonly reason = inject(ActivatedRoute).snapshot.queryParamMap.get('r');
  phone = '';
  pin = '';
  readonly busy = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.signIn(this.phone, this.pin);
      await this.router.navigate(['/ciftci']);
    } catch (err) {
      const code = err instanceof FarmerAuthError ? err.code : 'unknown';
      this.error.set(this.t().farmer.errors[code]);
    } finally {
      this.busy.set(false);
    }
  }
}
