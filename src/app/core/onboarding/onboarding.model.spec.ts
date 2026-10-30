import {
  completedVersion, emptyState, markCompleted, matchesPage, mergeStates, parseState, stepsToShow, type TourDef,
} from './onboarding.model';
import { TOURS, TOUR_LIST } from './tours';
import { ONBOARDING_TEXTS } from './onboarding.i18n';

describe('onboarding model', () => {
  it('bozuk veriyi güvenle okur', () => {
    expect(parseState(null)).toEqual(emptyState());
    expect(parseState('x')).toEqual(emptyState());
    const s = parseState({ version: 1, completedTours: ['pos@1', 7, 'bad', 'farmer@2'], dismissed: true, nudgeHidden: 'yes' });
    expect(s.completedTours).toEqual(['pos@1', 'farmer@2']);
    expect(s.dismissed).toBe(true);
    expect(s.nudgeHidden).toBeUndefined();
  });

  it('cihaz ve hesap durumunu birleştirir', () => {
    const a = { version: 1, completedTours: ['pos@1'] };
    const b = { version: 1, completedTours: ['farmer@1', 'pos@1'], dismissed: true };
    expect(mergeStates(a, b)).toEqual({ version: 1, completedTours: ['farmer@1', 'pos@1'], dismissed: true });
  });

  it('tamamlanan sürümü izler, eski kaydı değiştirir', () => {
    let s = markCompleted(emptyState(), 'pos', 1);
    expect(completedVersion(s, 'pos')).toBe(1);
    expect(completedVersion(s, 'farmer')).toBe(0);
    s = markCompleted(s, 'pos', 2);
    expect(s.completedTours).toEqual(['pos@2']);
  });

  it('sürüm artınca yalnız yeni adımlar gösterilir', () => {
    const def: TourDef = {
      id: 'pos', version: 2, area: 'dealer', audience: ['admin'], route: '/pos',
      steps: [{ key: 'a' }, { key: 'b' }, { key: 'c', since: 2 }],
    };
    expect(stepsToShow(def, 0, false).map(s => s.key)).toEqual(['a', 'b', 'c']);
    expect(stepsToShow(def, 1, false).map(s => s.key)).toEqual(['c']);
    expect(stepsToShow(def, 2, false)).toEqual([]);
    expect(stepsToShow(def, 2, true).length).toBe(3);
  });

  it('sayfa eşleşmesi önek ve sorgu dizesine duyarsız', () => {
    expect(matchesPage(TOURS.pos, '/pos?x=1')).toBe(true);
    expect(matchesPage(TOURS.pos, '/possible')).toBe(false);
    expect(matchesPage(TOURS.farmer, '/ciftci/defter')).toBe(true);
  });

  it('her turun 5-8 adımı ve iki dilde metni var', () => {
    for (const def of TOUR_LIST) {
      expect(def.steps.length).toBeGreaterThanOrEqual(5);
      expect(def.steps.length).toBeLessThanOrEqual(8);
      for (const lang of ['tr', 'en'] as const) {
        for (const step of def.steps) {
          const text = ONBOARDING_TEXTS[lang].tours[def.id][step.key];
          expect(text?.title, `${lang} ${def.id}.${step.key}`).toBeTruthy();
          expect(text?.body, `${lang} ${def.id}.${step.key}`).toBeTruthy();
        }
      }
    }
  });
});
