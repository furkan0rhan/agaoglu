import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LangService } from '../i18n/lang.service';
import { GlassCardComponent, PageHeaderComponent, StatusBadgeComponent, UiTone } from '../../shared/ui';
import { LicenseService } from './license.service';
import { SUPPORT_CONTACT } from './license.config';
import { LICENSE_TEXTS } from './license.i18n';

/** /license — lisans durumu ve (salt okunur moddaysa) destek iletişimi. Tasarım v2 (C "plan" kartı). */
@Component({
  selector: 'app-license-expired',
  standalone: true,
  imports: [DatePipe, RouterLink, ButtonModule, GlassCardComponent, PageHeaderComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-page-header [title]="title()" [subtitle]="x().pageTitle">
      <p-button routerLink="/dashboard" [label]="x().backHome" icon="pi pi-home" severity="secondary" />
    </ui-page-header>

    <div class="page-body">
      <div class="mx-auto flex w-full max-w-[760px] flex-col gap-4">
        @if (readOnly()) {
          <div role="alert" class="flex items-start gap-3 rounded-token-lg border border-danger-line bg-danger-soft p-4 text-danger-text">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-token-md bg-danger text-fg-inverse">
              <i class="pi pi-lock" aria-hidden="true"></i>
            </span>
            <div class="min-w-0">
              <p class="m-0 font-display font-bold">{{ title() }}</p>
              <p class="m-0 mt-1 text-sm leading-relaxed text-fg-secondary">{{ x().readOnlyDesc }}</p>
            </div>
          </div>
        }

        <ui-glass-card [title]="x().pageTitle" icon="pi-verified" [tone]="tone()" padding="none" clip>
          <div class="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div class="field-dark flex flex-col gap-3 p-5">
              <p class="m-0 flex items-center gap-2.5 font-display text-2xl font-extrabold">
                <i class="pi pi-crown text-xl text-side-em" aria-hidden="true"></i>{{ planName() }}
              </p>
              <ui-status-badge [tone]="tone()" class="self-start">{{ stateLabel() }}</ui-status-badge>
              <p class="m-0 text-13.5 text-side-soft">
                {{ x().expires }}:
                <b class="num text-side-text">
                  @if (license.info().expiresAt; as d) { {{ d | date: 'dd.MM.yyyy' }} } @else { {{ x().unlimited }} }
                </b>
              </p>
            </div>
            <dl class="m-0 grid grid-cols-2 content-start gap-x-4 gap-y-3 p-5 text-sm">
              <dt class="text-fg-muted">{{ x().plan }}</dt>
              <dd class="m-0 font-semibold text-fg">{{ planName() }}</dd>
              <dt class="text-fg-muted">{{ x().expires }}</dt>
              <dd class="num m-0 font-semibold text-fg">
                @if (license.info().expiresAt; as d) { {{ d | date: 'dd.MM.yyyy' }} } @else { {{ x().unlimited }} }
              </dd>
              @if (license.info().daysLeft !== null) {
                <dt class="text-fg-muted">{{ daysLabel() }}</dt>
                <dd class="num m-0 font-display text-lg font-extrabold" [class]="(license.info().daysLeft ?? 0) <= 7 ? 'text-danger-text' : 'text-fg'">
                  {{ license.info().daysLeft }}
                </dd>
              }
            </dl>
          </div>
        </ui-glass-card>

        <ui-glass-card [title]="x().contact" icon="pi-headphones" tone="info">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a class="num inline-flex min-h-[44px] items-center gap-2 font-semibold text-info-text no-underline hover:underline" [href]="'tel:' + contact.phone">
              <i class="pi pi-phone" aria-hidden="true"></i>{{ contact.phone }}
            </a>
            <a class="inline-flex min-h-[44px] items-center gap-2 font-semibold text-info-text no-underline hover:underline" [href]="'mailto:' + contact.email">
              <i class="pi pi-envelope" aria-hidden="true"></i>{{ contact.email }}
            </a>
          </div>
        </ui-glass-card>
      </div>
    </div>
  `,
})
export class LicenseExpiredPage {
  readonly license = inject(LicenseService);
  private readonly lang = inject(LangService);
  readonly x = computed(() => LICENSE_TEXTS[this.lang.lang()]);
  readonly contact = SUPPORT_CONTACT;
  readonly readOnly = computed(() => this.license.readOnly());
  readonly title = computed(() => {
    const s = this.license.state();
    if (s === 'suspended') return this.x().suspendedTitle;
    if (s === 'expired') return this.x().expiredTitle;
    return this.x().pageTitle;
  });
  readonly planName = computed(() => {
    const p = this.license.info().plan;
    return p ? this.x().planNames[p] ?? p : '-';
  });
  readonly tone = computed<UiTone>(() => {
    const s = this.license.state();
    return s === 'expired' || s === 'suspended' ? 'danger' : s === 'warning' ? 'warning' : 'brand';
  });
  readonly stateLabel = computed(() => {
    const s = this.license.state();
    if (s === 'suspended') return this.x().suspendedTitle;
    if (s === 'expired') return this.x().expiredTitle;
    return s === 'warning' ? this.x().stateWarning : this.x().stateActive;
  });
  readonly daysLabel = computed(() => this.x().daysLeft);
}
