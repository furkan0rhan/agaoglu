import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/services/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { PageHeaderComponent, ProgressRingComponent } from '../../shared/ui';
import { SupportAccessLogComponent } from '../admin/components/support-access-log.component';
import { BackupPanelComponent } from '../backup/backup-panel.component';
import { BusinessInfoCardComponent } from './business/business-info-card.component';
import { AboutSectionComponent } from './sections/about-section.component';
import { ProfileSectionComponent, SecuritySectionComponent } from './sections/account-sections.component';
import { AppearanceSectionComponent } from './sections/appearance-section.component';
import { CreditSectionComponent } from './sections/credit-section.component';
import { LanguageSectionComponent } from './sections/language-section.component';
import { LicenseSectionComponent } from './sections/license-section.component';
import { ReceiptSectionComponent } from './sections/receipt-section.component';
import { SalesSectionComponent } from './sections/sales-section.component';
import { SETTINGS_SECTIONS, SettingsGroup, SettingsSectionDef, SettingsSectionKey, sectionsForRole } from './settings-sections';
import { injectSettingsTexts } from './settings.i18n';
import { SetupItem, SetupProgressService } from './setup-progress.service';
import { TeamPanelComponent } from './users/team-panel.component';

/**
 * Ayarlar merkezi (C "Ayarlar"): solda gruplu ayar menüsü (telefonda üstte yatay sekmeler), üstte kurulum
 * ilerleme kartı (yalnız admin), sağda seçili bölüm.
 * - `/settings/:section` (admin): tüm bölümler.
 * - `/account?s=<bölüm>` (tüm roller): kişisel bölümler (Görünüm, Dil, Profil, Güvenlik, Hakkında).
 */
@Component({
  selector: 'app-settings-center',
  standalone: true,
  imports: [
    FormsModule, RouterLink, ButtonModule, ToastModule, ConfirmDialogModule,
    PageHeaderComponent, ProgressRingComponent,
    BusinessInfoCardComponent, ReceiptSectionComponent, SalesSectionComponent, CreditSectionComponent, TeamPanelComponent,
    AppearanceSectionComponent, LanguageSectionComponent, BackupPanelComponent, LicenseSectionComponent,
    SupportAccessLogComponent, ProfileSectionComponent, SecuritySectionComponent, AboutSectionComponent,
  ],
  providers: [MessageService, ConfirmationService, SetupProgressService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p-toast position="top-right" />
    <p-confirmdialog />

    <ui-page-header [title]="pageTitle()" [subtitle]="current().title" />

    <div class="page-body">
      <div class="grid grid-cols-1 items-start gap-3 lg:grid-cols-[15.625rem_minmax(0,1fr)] lg:gap-5">

        <!-- Ayar menüsü: masaüstünde gruplu dikey liste, telefonda yatay sekmeler -->
        <nav [attr.aria-label]="pageTitle()"
          class="sticky top-0 z-sticky -mx-3 -mt-3 border-b border-line bg-surface lg:top-4 lg:mx-0 lg:mt-0 lg:overflow-hidden lg:rounded-token-lg lg:border">
          <div class="hidden p-2.5 lg:block">
            <label class="relative block">
              <span class="sr-only">{{ s().searchPlaceholder }}</span>
              <i class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted" aria-hidden="true"></i>
              <input type="search" [(ngModel)]="query" [placeholder]="s().searchPlaceholder"
                class="h-10 w-full rounded-token-md border border-line bg-page pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
            </label>
          </div>
          <div class="flex overflow-x-auto [scrollbar-width:none] lg:block lg:pb-2">
            @for (g of groups(); track g.key) {
              <p class="eyebrow m-0 hidden px-4 pb-1 pt-3 text-fg-muted lg:block">{{ g.label }}</p>
              @for (sec of g.items; track sec.key) {
                @let on = sec.key === section();
                <a [routerLink]="linkFor(sec.key)" [queryParams]="queryFor(sec.key)" [attr.aria-current]="on ? 'page' : null"
                  class="flex min-h-[48px] shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap border-0 border-b-[3px] border-solid px-3.5 text-14 no-underline transition-colors hover:bg-surface-hover lg:min-h-[42px] lg:border-b-0 lg:border-l-[3px]"
                  [class]="on ? 'border-brand bg-brand-soft font-semibold text-brand-text' : 'border-transparent font-medium text-fg-secondary'">
                  <i class="pi text-15" [class]="sec.icon + (on ? ' text-brand-text' : ' text-fg-muted')" aria-hidden="true"></i>
                  {{ s().sections[sec.key].title }}
                  @if (warnFor(sec.key)) {
                    <span class="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" [attr.aria-label]="s().setupMissing(1)"></span>
                  }
                </a>
              }
            }
            @if (!groups().length) {
              <p class="m-0 px-4 py-3 text-sm text-fg-muted">{{ s().noMatch }}</p>
            }
          </div>
        </nav>

        <div class="flex min-w-0 flex-col gap-3 lg:gap-4">
          <!-- Kurulum ilerlemesi (admin, eksik varsa) -->
          @if (adminMode() && setup.loaded() && setup.percent() < 100) {
            <section class="ui-card flex flex-wrap items-center gap-4 p-4" aria-live="polite">
              <ui-progress-ring [value]="setup.percent()" [ariaLabel]="s().setupTitle(setup.percent())" />
              <div class="min-w-0 flex-1 basis-[260px]">
                <h2 class="m-0 font-display text-17 font-extrabold text-fg">{{ s().setupTitle(setup.percent()) }}</h2>
                <p class="m-0 mt-0.5 text-13.5 text-fg-secondary">{{ s().setupMissing(setup.missing().length) }} {{ s().setupHint }}</p>
                <ul class="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                  @for (it of setup.items(); track it.key) {
                    <li>
                      <a [routerLink]="itemLink(it)" [queryParams]="it.section ? queryFor(it.section) : null"
                        class="inline-flex min-h-[32px] items-center gap-1.5 rounded-token-sm border px-2.5 text-13 font-semibold no-underline"
                        [class]="it.done ? 'border-transparent bg-brand-soft text-brand-text' : 'border-line-strong bg-surface text-fg hover:bg-surface-hover'">
                        <i class="pi text-11" [class]="it.done ? 'pi-check' : 'pi-circle'" aria-hidden="true"></i>
                        {{ s().setupItems[it.key] }}
                      </a>
                    </li>
                  }
                </ul>
              </div>
              @if (setup.missing()[0]; as next) {
                <p-button [label]="s().setupNext" icon="pi pi-arrow-right" iconPos="right" (onClick)="goItem(next)" />
              }
            </section>
          }

          @if (!ready()) {
            <div class="ui-card flex flex-col gap-3 p-4" aria-hidden="true">
              @for (i of [1, 2, 3]; track i) { <div class="h-11 animate-pulse rounded-token-md bg-surface-muted"></div> }
            </div>
          } @else {
          @switch (section()) {
            @case ('business') { <app-business-info-card (saved)="setup.refresh()" /> }
            @case ('receipt') { <app-receipt-section (saved)="setup.refresh()" /> }
            @case ('sales') { <app-sales-section /> }
            @case ('credit') { <app-credit-section /> }
            @case ('team') { <app-team-panel /> }
            @case ('appearance') { <app-appearance-section /> }
            @case ('language') { <app-language-section /> }
            @case ('backup') { <app-backup-panel (backedUp)="setup.refresh()" /> }
            @case ('license') { <app-license-section /> }
            @case ('support') { <app-support-access-log /> }
            @case ('profile') { <app-profile-section /> }
            @case ('security') { <app-security-section /> }
            @case ('about') { <app-about-section /> }
          }
          }
        </div>
      </div>
    </div>
  `,
})
export class SettingsCenterPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly setup = inject(SetupProgressService);
  readonly t = inject(LangService).t;
  readonly s = injectSettingsTexts();

  /** /account → kişisel bölümler; /settings → rolün tüm bölümleri. */
  readonly adminMode = signal(!this.router.url.startsWith('/account'));
  private readonly param = toSignal(this.route.paramMap.pipe(map(p => p.get('section'))), { initialValue: null });
  private readonly qparam = toSignal(this.route.queryParamMap.pipe(map(p => p.get('s'))), { initialValue: null });

  private readonly _query = signal('');
  get query(): string { return this._query(); }
  set query(v: string) { this._query.set(v); }

  private readonly visible = computed<SettingsSectionDef[]>(() => this.adminMode()
    ? sectionsForRole(this.auth.currentUser()?.role)
    : SETTINGS_SECTIONS.filter(sec => sec.roles.length === 0));

  readonly section = computed<SettingsSectionKey>(() => {
    const key = this.adminMode() ? this.param() : this.qparam();
    const list = this.visible();
    const fallback: SettingsSectionKey = this.adminMode() ? 'business' : 'profile';
    return list.find(sec => sec.key === key)?.key ?? list.find(sec => sec.key === fallback)?.key ?? list[0]?.key ?? 'profile';
  });

  readonly current = computed(() => this.s().sections[this.section()]);
  readonly pageTitle = computed(() => (this.adminMode() ? this.t().nav.settings : this.t().nav.account));

  readonly groups = computed(() => {
    const q = this._query().trim().toLocaleLowerCase('tr');
    const texts = this.s();
    const match = (sec: SettingsSectionDef) => {
      if (!q) return true;
      const x = texts.sections[sec.key];
      return `${x.title} ${x.desc} ${x.keys}`.toLocaleLowerCase('tr').includes(q);
    };
    return (['business', 'app', 'account'] as SettingsGroup[])
      .map(key => ({ key, label: texts.groups[key], items: this.visible().filter(sec => sec.group === key && match(sec)) }))
      .filter(g => g.items.length > 0);
  });

  /** Sayfa doğrudan açıldığında profil (işletme) yüklenene kadar bölümler beklesin. */
  readonly ready = computed(() => !!this.auth.currentTenantId());

  constructor() {
    effect(() => {
      if (this.ready() && this.adminMode() && this.auth.hasRole('admin')) untracked(() => this.setup.start());
    });
  }

  linkFor(key: SettingsSectionKey): string[] {
    return this.adminMode() ? ['/settings', key] : ['/account'];
  }

  queryFor(key: SettingsSectionKey): Record<string, string> | null {
    return this.adminMode() ? null : { s: key };
  }

  /** Menüde turuncu nokta: kurulumu eksik bölüm. */
  warnFor(key: SettingsSectionKey): boolean {
    return this.adminMode() && this.setup.loaded() && this.setup.missing().some(i => i.section === key);
  }

  itemLink(it: SetupItem): string[] {
    return it.section ? this.linkFor(it.section) : [it.route ?? '/settings'];
  }

  goItem(it: SetupItem): void {
    void this.router.navigate(this.itemLink(it));
  }
}
