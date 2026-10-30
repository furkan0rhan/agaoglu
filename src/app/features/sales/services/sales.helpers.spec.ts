import { TRANSLATIONS } from '../../../core/i18n/translations';
import { methodLabel } from './sales.helpers';

describe('methodLabel (5.4 karma ödeme)', () => {
  const t = TRANSLATIONS.tr;
  it('tek yöntemler', () => {
    expect(methodLabel(t, 'cash')).toBe('Nakit');
    expect(methodLabel(t, 'card', { cardPaid: 10 })).toBe('Kart');
  });
  it('karma: bileşenler yazılır', () => {
    expect(methodLabel(t, 'mixed', { cashPaid: 300, cardPaid: 700, creditAmount: 0 })).toBe('Nakit + Kart');
    expect(methodLabel(t, 'mixed', { cashPaid: 100, cardPaid: 0, creditAmount: 400 })).toBe('Nakit + Veresiye');
  });
  it('karma, tutar yoksa "Karma"', () => {
    expect(methodLabel(t, 'mixed')).toBe('Karma');
    expect(methodLabel(t, 'mixed', { cashPaid: 100 })).toBe('Karma');
  });
});
