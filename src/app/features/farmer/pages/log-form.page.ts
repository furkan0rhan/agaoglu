import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LangService } from '../../../core/i18n/lang.service';
import { APPLICATION_TYPES, ApplicationType, PhiSource, Recommendation } from '../../../shared/models/farmer.model';
import { fmt } from '../i18n/farmer.i18n';
import { F, FarmerHeaderComponent, fmtDate, fmtNum, fromInputDate, toInputDate, TYPE_ICON, TYPE_TONE, typeTile } from '../layout/farmer-ui';
import { FarmerStore } from '../services/farmer-store.service';
import { cropDef } from '../utils/crops';
import { DoseDisplay, doseDisplay, dosePerDecare, remainingAfterUse } from '../utils/dose.util';
import { earliestHarvestDate, isHarvestBeforePhi, isValidPhiDays, resolvePhi } from '../utils/phi.util';
import { FARM_UNITS, FarmUnit, toFarmUnit, unitLabel } from '../utils/units';
import { recItemApplication } from '../utils/rec-item.util';

interface BarnOption {
  key: string; purchaseId: string; index: number; name: string; unit: FarmUnit; remaining: number;
  productType: string | null; phiDays: number | null;
}

const TYPE_FOR_PRODUCT: Partial<Record<ApplicationType, readonly string[]>> = {
  pesticide: ['bitki_koruma'], fertilizer: ['gubre'], sowing: ['tohum', 'fide'],
};

/**
 * Uygulama kaydı (3 adım). Uygulama hiçbir ürün/doz ÖNERMEZ: ürün çiftçinin ambarından, bayideki yetkilinin
 * önerisinden veya serbest metinden gelir; doz yalnızca miktar/alan aritmetiğidir. PHI yalnızca bayinin girdiği
 * etiket bilgisi / yetkili önerisi / çiftçinin etiketten girdiği değerle hesaplanır; yoksa "etiketi kontrol edin".
 */
import { DateFieldComponent } from '../../../shared/ui/date-field.component';
@Component({
  selector: 'app-farmer-log-form',
  standalone: true,
  imports: [FormsModule, RouterLink, FarmerHeaderComponent, DateFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-farmer-header [title]="t().farmer.log.title" [back]="step() > 1 ? null : '/ciftci'">
      <span class="num shrink-0 rounded-token-md bg-surface-strong px-2.5 py-1 text-16 font-bold text-fg-secondary">{{ step() }}/3</span>
    </app-farmer-header>
    <div class="mb-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
      @for (n of [1, 2, 3]; track n) {
        <span class="h-1.5 rounded-full" [class]="step() >= n ? 'bg-brand' : 'bg-surface-strong'"></span>
      }
    </div>
    @if (rec(); as r) {
      <p [class]="F.legal + ' mb-3 flex items-start gap-2'"><i class="pi pi-file-edit mt-0.5 shrink-0 text-brand-text" aria-hidden="true"></i><span>{{ fromRec(r) }}</span></p>
    }

    @if (store.loaded() && !store.fields().length) {
      <p [class]="F.note">{{ t().farmer.log.noFields }}</p>
      <a routerLink="/ciftci/tarlalar/yeni" [class]="F.btn + ' mt-3'"><i class="pi pi-plus" aria-hidden="true"></i>{{ t().farmer.fields.add }}</a>
    } @else if (step() === 1) {
      <h2 [class]="F.h2 + ' mb-3'">{{ t().farmer.log.step1 }}</h2>
      @if (rec() && recTypeUnknown()) {
        <p [class]="F.note + ' mb-3'" role="status">{{ t().farmer.log.recTypeUnknown }}</p>
      }
      <div class="grid grid-cols-2 gap-3">
        @for (ty of types; track ty) {
          <button type="button" class="flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-token-2xl border-2 font-display text-19 font-extrabold transition-[filter] hover:brightness-95 active:brightness-90"
                  [class]="TYPE_TONE[ty]" (click)="pickType(ty)">
            <span class="text-[2.375rem] leading-none" aria-hidden="true">{{ TYPE_ICON[ty] }}</span>{{ t().farmer.types[ty] }}
          </button>
        }
      </div>
    } @else if (step() === 2) {
      <h2 [class]="F.h2 + ' mb-3 flex items-center gap-2'"><span [class]="F.tile + ' h-10 w-10 text-20 ' + tile()" aria-hidden="true">{{ TYPE_ICON[type()] }}</span>{{ t().farmer.log.step2 }}</h2>
      <div class="flex flex-col gap-4">
        <fieldset class="m-0 border-0 p-0">
          <legend [class]="F.label">{{ t().farmer.log.field }}</legend>
          <div class="flex flex-col gap-2">
            @for (f of store.fields(); track f.id) {
              <button type="button" class="flex min-h-[56px] cursor-pointer items-center gap-2 rounded-token-lg border px-3 text-left text-18 font-bold transition-colors"
                      [class]="fieldId() === f.id ? F.on : F.off"
                      [attr.aria-pressed]="fieldId() === f.id" (click)="pickField(f.id)">
                <i class="pi shrink-0" [class]="fieldId() === f.id ? 'pi-check-circle' : 'pi-circle'" aria-hidden="true"></i>
                <span class="min-w-0 flex-1 truncate">{{ f.name }}</span>
                <small class="num shrink-0 font-normal">{{ num(f.areaDecare) }} {{ t().farmer.common.decare }}</small>
              </button>
            }
          </div>
        </fieldset>
        @if (fieldSeasons().length) {
          <div>
            <label for="lf-season" [class]="F.label">{{ t().farmer.log.season }}</label>
            <select id="lf-season" name="season" [class]="F.input" [ngModel]="seasonId()" (ngModelChange)="seasonId.set($event)">
              <option [ngValue]="null">{{ t().farmer.log.noSeasonOption }}</option>
              @for (s of fieldSeasons(); track s.id) { <option [ngValue]="s.id">{{ cropLabel(s.crop) }} — {{ t().farmer.season[s.status] }}</option> }
            </select>
          </div>
        }
        <fieldset class="m-0 border-0 p-0">
          <legend [class]="F.label">{{ t().farmer.log.date }}</legend>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" [class]="F.choice + ' ' + (dateStr() === todayStr ? F.on : F.off)" [attr.aria-pressed]="dateStr() === todayStr" (click)="dateStr.set(todayStr)">{{ t().farmer.common.today }}</button>
            <button type="button" [class]="F.choice + ' ' + (dateStr() === yesterdayStr ? F.on : F.off)" [attr.aria-pressed]="dateStr() === yesterdayStr" (click)="dateStr.set(yesterdayStr)">{{ t().farmer.common.yesterday }}</button>
          </div>
          <ui-date-field [class]="'mt-2 ' + F.date" inputId="lf-date" valueType="iso" labelClass="sr-only" [label]="t().farmer.common.pickDate"
            [max]="todayStr" [clearable]="false" name="date" [ngModel]="dateStr()" (ngModelChange)="dateStr.set($event)" />
        </fieldset>
        <div>
          <label for="lf-area" [class]="F.label">{{ t().farmer.log.area }}</label>
          <input id="lf-area" type="number" inputmode="decimal" min="0" step="0.1" [class]="F.input" name="area" [ngModel]="area()" (ngModelChange)="area.set($event)" />
          @if (area() === selectedField()?.areaDecare) { <small [class]="F.muted">{{ t().farmer.log.wholeField }}</small> }
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" [class]="F.btn2" (click)="step.set(1)"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t().farmer.common.back }}</button>
          <button type="button" [class]="F.btn" [disabled]="!fieldId() || !date()" (click)="step.set(3)">{{ t().farmer.common.next }}<i class="pi pi-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
    } @else {
      <h2 [class]="F.h2 + ' mb-3 flex items-center gap-2'"><span [class]="F.tile + ' h-10 w-10 text-20 ' + tile()" aria-hidden="true">{{ TYPE_ICON[type()] }}</span>{{ t().farmer.log.step3 }}</h2>
      <div class="flex flex-col gap-4">
        @if (rec(); as r) {
          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend [class]="F.label">{{ t().farmer.recs.title }}</legend>
            @for (it of r.items; track $index) {
              <label [class]="F.row">
                <input type="radio" name="src" [class]="F.radio" [checked]="source() === 'rec:' + $index" (change)="pickRecItem($index)" />
                <span><b>{{ it.productName }}</b> — {{ it.dose }}</span>
              </label>
            }
          </fieldset>
        }
        @if (barnOptions().length) {
          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend [class]="F.label">{{ t().farmer.log.fromBarn }}</legend>
            @for (o of barnOptions(); track o.key) {
              <label [class]="F.row">
                <input type="radio" name="src" [class]="F.radio" [checked]="source() === o.key" (change)="pickBarn(o)" />
                <span class="flex-1"><b>{{ o.name }}</b> <small class="num text-fg-muted">({{ left(o) }})</small></span>
              </label>
            }
          </fieldset>
        }
        <label [class]="F.row">
          <input type="radio" name="src" [class]="F.radio" [checked]="source() === 'free'" (change)="pickFree()" />
          <span class="flex items-center gap-2"><i class="pi pi-pencil text-fg-muted" aria-hidden="true"></i>{{ t().farmer.log.otherProduct }}</span>
        </label>
        @if (source() === 'free') {
          <div><label for="lf-pname" [class]="F.label">{{ t().farmer.log.productName }}</label>
            <input id="lf-pname" name="pname" [class]="F.input" [ngModel]="productName()" (ngModelChange)="productName.set($event)" maxlength="80" /></div>
        }
        <div class="grid grid-cols-[1fr_120px] gap-2">
          <div><label for="lf-qty" [class]="F.label">{{ t().farmer.log.quantity }}</label>
            <input id="lf-qty" name="qty" type="number" inputmode="decimal" min="0" step="0.01" [class]="F.input" [ngModel]="quantity()" (ngModelChange)="quantity.set($event)" /></div>
          <div><label for="lf-unit" [class]="F.label">{{ t().farmer.log.unit }}</label>
            <select id="lf-unit" name="unit" [class]="F.input" [ngModel]="unit()" (ngModelChange)="unit.set($event)">
              @if (unit() === null) { <option [ngValue]="null" disabled>{{ t().farmer.log.unitPick }}</option> }
              @for (u of units; track u) { <option [ngValue]="u">{{ uLabel(u) }}</option> }
            </select></div>
        </div>
        @if (dose(); as d) {
          <p class="num m-0 rounded-token-lg bg-surface-muted px-3.5 py-2.5 font-display text-19 font-extrabold">{{ perDecare(d) }}</p>
        }

        @if (type() === 'pesticide') {
          <div class="rounded-token-2xl border p-4" [class]="conflict() ? 'border-danger-line bg-danger-soft text-danger-text' : 'border-warning-line bg-warning-soft text-warning-text'">
            @if (phi(); as p) {
              <p class="m-0 flex items-center gap-2 font-display text-19 font-extrabold"><i class="pi pi-hourglass" aria-hidden="true"></i>{{ phiWait(p.days) }}</p>
              <p class="m-0 mt-1 text-18 font-semibold">{{ phiEarliestText() }}</p>
              <p class="m-0 text-14 text-fg-secondary">{{ phiSourceText(p.source) }}</p>
              @if (conflict()) { <p class="m-0 mt-2 font-bold">{{ conflictText() }}</p> }
              <p class="m-0 mt-1 text-14 text-fg-secondary">{{ t().farmer.legal.labelFirst }}</p>
            } @else {
              <p class="m-0 flex items-start gap-2 font-bold"><i class="pi pi-exclamation-triangle mt-1" aria-hidden="true"></i>{{ t().farmer.legal.checkLabel }}</p>
            }
            @if (!dealerPhi()) {
              <label for="lf-phi" [class]="F.label + ' mt-3'">{{ t().farmer.log.phiManual }} ({{ t().farmer.common.optional }})</label>
              <input id="lf-phi" name="phi" type="number" inputmode="numeric" min="0" max="365" step="1" [class]="F.input" [ngModel]="manualPhi()" (ngModelChange)="manualPhi.set($event)" />
            }
          </div>
          <p [class]="F.legal + ' m-0 flex items-start gap-2'"><i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i><span>{{ t().farmer.legal.ukdReminder }}</span></p>
        }
        <div><label for="lf-by" [class]="F.label">{{ t().farmer.log.appliedBy }} ({{ t().farmer.common.optional }})</label>
          <input id="lf-by" name="by" [class]="F.input" [(ngModel)]="appliedBy" maxlength="60" /></div>
        <div><label for="lf-notes" [class]="F.label">{{ t().farmer.log.notes }} ({{ t().farmer.common.optional }})</label>
          <textarea id="lf-notes" name="notes" rows="2" [class]="F.input + ' py-2.5'" [(ngModel)]="notes" maxlength="500"></textarea></div>
        @if (error()) { <p [class]="F.danger + ' m-0'" role="alert">{{ error() }}</p> }
        <div class="grid grid-cols-2 gap-2">
          <button type="button" [class]="F.btn2" (click)="step.set(2)"><i class="pi pi-arrow-left" aria-hidden="true"></i>{{ t().farmer.common.back }}</button>
          <button type="button" [class]="F.btn" (click)="save()"><i class="pi pi-check" aria-hidden="true"></i>{{ t().farmer.common.save }}</button>
        </div>
        <p [class]="F.muted + ' m-0 text-14'">{{ t().farmer.legal.personalLog }}</p>
      </div>
    }
  `,
})
export class FarmerLogFormPage implements OnInit {
  readonly t = inject(LangService).t;
  readonly lang = inject(LangService).lang;
  readonly F = F;
  readonly TYPE_ICON = TYPE_ICON;
  readonly TYPE_TONE = TYPE_TONE;
  readonly tile = computed(() => typeTile(this.type()));
  readonly types = APPLICATION_TYPES;
  readonly units = FARM_UNITS;
  readonly store = inject(FarmerStore);
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly todayStr = toInputDate(new Date());
  readonly yesterdayStr = toInputDate(new Date(Date.now() - 86400000));

  readonly step = signal(1);
  readonly type = signal<ApplicationType>('pesticide');
  readonly fieldId = signal<string | null>(null);
  readonly seasonId = signal<string | null>(null);
  readonly dateStr = signal(this.todayStr);
  readonly area = signal<number | null>(null);
  readonly source = signal<string>('free');
  readonly productName = signal('');
  readonly quantity = signal<number | null>(null);
  /** null = bilinmiyor (eski öneri) → kullanıcı seçer */
  readonly unit = signal<FarmUnit | null>('lt');
  /** Açılan önerinin kaleminde ürün türü yok → kayıt türü kullanıcıdan */
  readonly recTypeUnknown = signal(false);
  readonly manualPhi = signal<number | null>(null);
  readonly barnPick = signal<BarnOption | null>(null);
  readonly recItem = signal<number | null>(null);
  readonly rec = signal<Recommendation | null>(null);
  readonly error = signal('');
  appliedBy = '';
  notes = '';

  readonly date = computed(() => fromInputDate(this.dateStr()));
  readonly selectedField = computed(() => this.store.field(this.fieldId()));
  readonly fieldSeasons = computed(() => (this.fieldId() ? this.store.seasonsOf(this.fieldId() as string) : []));
  readonly season = computed(() => this.store.seasons().find(s => s.id === this.seasonId()) ?? null);

  readonly barnOptions = computed<BarnOption[]>(() => {
    const allowed = TYPE_FOR_PRODUCT[this.type()];
    const out: BarnOption[] = [];
    for (const p of this.store.purchases()) {
      if (p.status !== 'completed') continue;
      p.items.forEach((it, index) => {
        if (allowed && !allowed.includes(it.productType ?? '')) return;
        const remaining = p.remaining[String(index)] ?? it.quantity;
        if (remaining <= 0) return;
        out.push({ key: `${p.id}:${index}`, purchaseId: p.id, index, name: it.productName, unit: toFarmUnit(it.unit), remaining,
          productType: it.productType, phiDays: it.phiDays });
      });
    }
    return out;
  });

  /** Bayi verisinden (ambar kalemi) veya yetkili önerisinden gelen PHI */
  readonly dealerPhi = computed(() => {
    const crop = this.season()?.crop ?? null;
    const r = this.rec();
    const ri = this.recItem();
    if (r && ri != null) return resolvePhi({ phiDays: r.items[ri]?.phiDays }, crop, 'recommendation');
    const b = this.barnPick();
    if (b) return resolvePhi({ phiDays: b.phiDays }, crop, 'dealer');
    return null;
  });

  readonly phi = computed(() => {
    const d = this.dealerPhi();
    if (d) return d;
    const m = this.manualPhi();
    const n = m == null || (m as unknown) === '' ? null : Number(m);
    return isValidPhiDays(n) ? { days: n, source: 'manual' as PhiSource } : null;
  });

  readonly earliest = computed(() => earliestHarvestDate(this.date(), this.phi()?.days));
  readonly conflict = computed(() => isHarvestBeforePhi(this.season()?.expectedHarvestDate, this.earliest()));
  readonly dose = computed(() => {
    const u = this.unit();
    return u ? doseDisplay(this.qty(), u, this.areaNum(), this.productName()) : null;
  });

  async ngOnInit(): Promise<void> {
    await this.store.load();
    const recId = this.query.get('oneri');
    const r = recId ? this.store.recommendations().find(x => x.id === recId && x.status === 'active') ?? null : null;
    if (r) {
      this.rec.set(r);
      if (r.fieldId && this.store.field(r.fieldId)) this.pickField(r.fieldId);
      if (r.seasonId) this.seasonId.set(r.seasonId);
      // Tür / birim öneri kalemindeki ürün kartı bilgisinden; eski önerilerde yoksa kullanıcı seçer (varsayılan yok)
      if (!recItemApplication(r.items[0]).type) {
        this.recTypeUnknown.set(true);
        this.unit.set(null);
        this.step.set(1);
        return;
      }
      this.pickRecItem(0);
      this.step.set(this.fieldId() ? 3 : 2);
      return;
    }
    const tarla = this.query.get('tarla');
    if (tarla && this.store.field(tarla)) this.pickField(tarla);
  }

  pickType(ty: ApplicationType): void {
    this.type.set(ty);
    if (this.rec()) {
      // Öneriden gelindi ama türü bilinmiyordu: tür seçildi, öneri kalemi korunur (birim de bilinmiyorsa seçilecek)
      this.pickRecItem(0);
      if (!this.fieldId() && this.store.fields().length === 1) this.pickField(this.store.fields()[0].id);
      this.step.set(this.fieldId() ? 3 : 2);
      return;
    }
    this.unit.set(ty === 'fertilizer' || ty === 'sowing' ? 'kg' : 'lt');
    this.pickFree();
    if (!this.fieldId() && this.store.fields().length === 1) this.pickField(this.store.fields()[0].id);
    this.step.set(2);
  }

  pickField(id: string): void {
    this.fieldId.set(id);
    this.area.set(this.store.field(id)?.areaDecare ?? null);
    this.seasonId.set(this.store.currentSeason(id)?.id ?? null);
  }

  pickBarn(o: BarnOption): void {
    this.source.set(o.key); this.barnPick.set(o); this.recItem.set(null);
    this.productName.set(o.name); this.unit.set(o.unit);
  }

  pickRecItem(i: number): void {
    const it = this.rec()?.items[i];
    if (!it) return;
    this.source.set('rec:' + i); this.recItem.set(i); this.barnPick.set(null);
    this.productName.set(it.productName);
    const app = recItemApplication(it);
    if (app.type) this.type.set(app.type);
    // Öneri ürünü ambarda varsa kalan miktar düşülsün diye eşleştir (barnOptions türe göre süzülür → tür önce)
    const match = this.barnOptions().find(o => o.name === it.productName);
    if (match) { this.barnPick.set(match); this.unit.set(match.unit); }
    else this.unit.set(app.unit);
  }

  pickFree(): void {
    this.source.set('free'); this.barnPick.set(null); this.recItem.set(null); this.productName.set('');
  }

  private qty(): number | null { const q = this.quantity(); return q == null || (q as unknown) === '' ? null : Number(q); }
  private areaNum(): number | null { const a = this.area(); return a == null || (a as unknown) === '' ? null : Number(a); }

  save(): void {
    this.error.set('');
    const fieldId = this.fieldId();
    const date = this.date();
    if (!fieldId || !date) { this.step.set(2); return; }
    const q = this.qty();
    if (q != null && (!Number.isFinite(q) || q < 0)) { this.error.set(this.t().farmer.log.quantityInvalid); return; }
    const unit = this.unit();
    if (q != null && !unit) { this.error.set(this.t().farmer.log.unitRequired); return; }
    const phi = this.type() === 'pesticide' ? this.phi() : null;
    const b = this.barnPick();
    const r = this.rec();
    const rem = b && q != null && unit ? remainingAfterUse(b.remaining, q, unit, b.unit) : null;
    this.store.addLog({
      fieldId, seasonId: this.seasonId(), type: this.type(), date,
      purchaseId: b?.purchaseId ?? null, purchaseItemIndex: b?.index ?? null,
      productName: this.productName().trim() || null, quantity: q, unit: q != null ? unit : null,
      areaDecare: this.areaNum(), dosePerDecare: dosePerDecare(q, this.areaNum()),
      appliedBy: this.appliedBy.trim() || null, notes: this.notes.trim() || null,
      phiDays: phi?.days ?? null, phiSource: phi?.source ?? null, earliestHarvestDate: phi ? this.earliest() : null,
      recommendationId: r?.id ?? null,
    }, b && rem != null ? { purchaseId: b.purchaseId, index: b.index, remaining: rem } : undefined);
    void this.router.navigate(['/ciftci/defter']);
  }

  num(v: number): string { return fmtNum(v, this.lang()); }
  cropLabel(code: string): string { const c = cropDef(code); return `${c.icon} ${c[this.lang()]}`; }
  uLabel(u: string): string { return unitLabel(u, this.lang()); }
  left(o: BarnOption): string { return fmt(this.t().farmer.log.left, { q: `${fmtNum(o.remaining, this.lang())} ${this.uLabel(o.unit)}` }); }
  perDecare(d: DoseDisplay): string {
    const l = this.t().farmer.log;
    return d.kind === 'decare-per-unit'
      ? fmt(l.decarePerUnit, { u: this.uLabel(d.unit), v: fmtNum(d.value, this.lang()) })
      : fmt(l.perDecare, { v: `${fmtNum(d.value, this.lang())} ${this.uLabel(d.unit)}` });
  }
  phiWait(n: number): string { return fmt(this.t().farmer.log.phiWait, { n }); }
  phiEarliestText(): string { return fmt(this.t().farmer.log.phiEarliest, { date: fmtDate(this.earliest(), this.lang()) }); }
  conflictText(): string { return fmt(this.t().farmer.log.phiConflict, { date: fmtDate(this.season()?.expectedHarvestDate, this.lang()) }); }
  fromRec(r: Recommendation): string { return fmt(this.t().farmer.log.fromRec, { target: r.target }); }
  phiSourceText(s: PhiSource): string {
    const l = this.t().farmer.log;
    return s === 'dealer' ? l.phiSourceDealer : s === 'recommendation' ? l.phiSourceRec : l.phiSourceManual;
  }
}
