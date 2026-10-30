import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, getCountFromServer, query, where } from '@angular/fire/firestore';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { SUPPORT_CONTACT } from '../../../core/license/license.config';
import { LICENSE_TEXTS } from '../../../core/license/license.i18n';
import { LicenseService } from '../../../core/license/license.service';
import { GlassCardComponent, SettingsRowComponent, StatusBadgeComponent, UiTone } from '../../../shared/ui';
import { injectSettingsTexts } from '../settings.i18n';

/** Abonelik & lisans (salt okunur; lisansı yalnız platform yöneticisi değiştirir) + destek iletişimi. */
@Component({
  selector: 'app-license-section',
  standalone: true,
  imports: [DatePipe, RouterLink, GlassCardComponent, SettingsRowComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ui-glass-card [title]="s().sections.license.title" [subtitle]="s().sections.license.desc" icon="pi-crown" tone="accent" padding="none" clip>
      <a card-actions routerLink="/license" class="text-13.5 font-semibold text-brand-text no-underline hover:underline">{{ s().licenseDetails }} ›</a>
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
            @if (license.info().daysLeft !== null) {
              · <b class="num text-side-text">{{ license.info().daysLeft }}</b> {{ s().days }}
            }
          </p>
        </div>
        <div class="flex flex-col justify-center gap-2 p-5">
          <div class="flex items-baseline justify-between gap-3 text-sm">
            <span class="text-fg-secondary">{{ s().planUsers }}</span>
            <b class="num text-fg">{{ activeUsers() ?? '–' }} / {{ maxLabel() }}</b>
          </div>
          <div class="h-2.5 overflow-hidden rounded-full bg-surface-strong" role="meter" [attr.aria-valuenow]="activeUsers() ?? 0"
            [attr.aria-valuemax]="maxNum() ?? null" [attr.aria-label]="s().planUsers">
            <div class="h-full rounded-full transition-[width] duration-500" [class]="usagePct() >= 100 ? 'bg-accent' : 'bg-brand'"
              [style.width.%]="usagePct()"></div>
          </div>
        </div>
      </div>
      <ui-settings-row [title]="s().supportLine" [description]="s().supportLineDesc">
        <a class="tap num inline-flex items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg no-underline hover:bg-surface-hover"
          [href]="'tel:' + contact.phone"><i class="pi pi-phone" aria-hidden="true"></i>{{ contact.phone }}</a>
        <a class="tap inline-flex items-center gap-2 rounded-token-md border border-line-strong bg-surface px-3 text-sm font-semibold text-fg no-underline hover:bg-surface-hover"
          [href]="'mailto:' + contact.email"><i class="pi pi-envelope" aria-hidden="true"></i>{{ contact.email }}</a>
      </ui-settings-row>
    </ui-glass-card>
  `,
})
export class LicenseSectionComponent implements OnInit {
  readonly license = inject(LicenseService);
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);
  private readonly lang = inject(LangService);
  readonly s = injectSettingsTexts();
  readonly x = computed(() => LICENSE_TEXTS[this.lang.lang()]);
  readonly contact = SUPPORT_CONTACT;

  readonly activeUsers = signal<number | null>(null);

  readonly planName = computed(() => {
    const p = this.license.info().plan;
    return p ? this.x().planNames[p] ?? p : this.s().legacyPlan;
  });
  readonly tone = computed<UiTone>(() => {
    const st = this.license.state();
    return st === 'expired' || st === 'suspended' ? 'danger' : st === 'warning' ? 'warning' : 'success';
  });
  readonly stateLabel = computed(() => {
    const st = this.license.state(), x = this.x();
    if (st === 'expired') return x.expiredTitle;
    if (st === 'suspended') return x.suspendedTitle;
    if (st === 'warning') return x.stateWarning;
    return x.stateActive;
  });
  readonly maxNum = computed(() => {
    this.license.tenant(); // lisans değişince yeniden hesapla
    const m = this.license.maxUsers();
    return Number.isFinite(m) ? m : null;
  });
  readonly maxLabel = computed(() => this.maxNum() ?? this.s().unlimitedUsers);
  readonly usagePct = computed(() => {
    const max = this.maxNum(), n = this.activeUsers() ?? 0;
    return max ? Math.min(100, Math.round((n / max) * 100)) : n ? 15 : 0;
  });

  async ngOnInit(): Promise<void> {
    try {
      const snap = await getCountFromServer(query(collection(this.firestore, 'users'),
        where('tenantId', '==', this.auth.currentTenantId()), where('isActive', '==', true)));
      this.activeUsers.set(snap.data().count);
    } catch { /* çevrimdışı: sayı gösterilmez */ }
  }
}
