import { TestBed } from '@angular/core/testing';
import { RecommendationDialogComponent } from './recommendation-dialog.component';
import { DEALER_FARMER_REPOSITORY, DealerProductOption } from '../data/repositories';
import { FarmerLink } from '../../../shared/models/farmer.model';

const PRODUCTS: DealerProductOption[] = [
  { id: 'P1', name: 'Mantar İlacı', productType: 'bitki_koruma', unit: 'lt', requiresPrescription: true, phiDays: 14, activeIngredient: null },
  { id: 'P2', name: '20.20.0', productType: 'gubre', unit: 'kg', requiresPrescription: false, phiDays: null, activeIngredient: null },
];

const flush = () => new Promise(r => setTimeout(r, 0));

describe('RecommendationDialogComponent', () => {
  async function setup() {
    TestBed.configureTestingModule({
      imports: [RecommendationDialogComponent],
      providers: [
        { provide: DEALER_FARMER_REPOSITORY, useValue: { listPrescriptionProducts: () => Promise.resolve(PRODUCTS) } },
      ],
    });
    const fixture = TestBed.createComponent(RecommendationDialogComponent);
    fixture.componentRef.setInput('link', { tenantId: 'T', farmerId: 'F', status: 'active', tenantName: 'Bayi' } as unknown as FarmerLink);
    fixture.componentInstance.visible.set(true);
    fixture.componentInstance.open();
    fixture.detectChanges();
    await flush();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const type = async (el: HTMLInputElement, value: string, fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await flush();
    await fixture.whenStable();
    fixture.detectChanges();
    await flush();
  };

  it('ürün seçilince yazılmış doz korunur', async () => {
    const fixture = await setup();
    // [name] NgModel girdisidir (DOM özniteliği değil): fieldset içindeki sıraya göre seç
    const q = (name: 'p0' | 'd0') => document.querySelectorAll<HTMLInputElement>('fieldset input')[name === 'p0' ? 0 : 1];
    expect(document.querySelector('#rec-target')).toBeTruthy();
    expect(q('d0')).toBeTruthy();
    await type(q('d0'), '100 ml/da', fixture);
    await type(q('p0'), 'Mantar İlacı', fixture);
    expect(fixture.componentInstance.items()[0].productId).toBe('P1');
    expect(fixture.componentInstance.items()[0].dose).toBe('100 ml/da');
    expect(q('d0').value).toBe('100 ml/da');
    // önce ürün, sonra doz, sonra ürün değişikliği
    await type(q('d0'), '50 ml/da', fixture);
    await type(q('p0'), 'Mantar', fixture);
    await type(q('p0'), 'Mantar İlacı', fixture);
    expect(fixture.componentInstance.items()[0].dose).toBe('50 ml/da');
    expect(q('d0').value).toBe('50 ml/da');
  });

  it('kalem silinince kalan kalemin dozu korunur', async () => {
    const fixture = await setup();
    const c = fixture.componentInstance;
    c.addItem();
    fixture.detectChanges();
    const doses = () => [...document.querySelectorAll<HTMLInputElement>('fieldset input')].filter((_, k) => k % 4 === 1);
    await type(doses()[0], 'A doz', fixture);
    await type(doses()[1], 'B doz', fixture);
    c.removeItem(0);
    fixture.detectChanges();
    await flush();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(c.items().map(i => i.dose)).toEqual(['B doz']);
    expect(doses()[0].value).toBe('B doz');
  });

  it('ürün seçilince ürün tipi ve birimi kaleme yazılır; serbest metinde boşalır (14.12)', async () => {
    const fixture = await setup();
    const q = () => document.querySelectorAll<HTMLInputElement>('fieldset input')[0];
    await type(q(), '20.20.0', fixture);
    expect(fixture.componentInstance.items()[0]).toMatchObject({ productId: 'P2', productType: 'gubre', unit: 'kg' });
    await type(q(), 'Bilinmeyen gübre', fixture);
    expect(fixture.componentInstance.items()[0]).toMatchObject({ productId: null, productType: null, unit: null });
  });
});
