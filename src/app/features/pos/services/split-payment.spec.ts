import { splitPayment } from './split-payment';

describe('splitPayment (5.4 nakit + kart)', () => {
  it('nakit toplamı karşılıyorsa tek ödeme nakit, fark para üstü', () => {
    expect(splitPayment(850, 1000, 'card')).toEqual({ method: 'cash', cash: 1000, card: 0, credit: 0, change: 150 });
    expect(splitPayment(850, 850, 'credit')).toEqual({ method: 'cash', cash: 850, card: 0, credit: 0, change: 0 });
  });

  it('eksik nakitte kalan karta: karma, para üstü yok', () => {
    expect(splitPayment(1250.75, 500, 'card')).toEqual({ method: 'mixed', cash: 500, card: 750.75, credit: 0, change: 0 });
  });

  it('eksik nakitte kalan veresiyeye (eski davranış)', () => {
    expect(splitPayment(1000, 400, 'credit')).toEqual({ method: 'mixed', cash: 400, card: 0, credit: 600, change: 0 });
  });

  it('nakit 0 ise tamamı seçilen yönteme', () => {
    expect(splitPayment(300, 0, 'card')).toEqual({ method: 'card', cash: 0, card: 300, credit: 0, change: 0 });
    expect(splitPayment(300, 0, 'credit').method).toBe('credit');
  });

  it('kuruş yuvarlaması: nakit + kart = toplam', () => {
    const r = splitPayment(0.3, 0.1, 'card');
    expect(r.card).toBe(0.2);
    expect(Math.round((r.cash + r.card) * 100) / 100).toBe(0.3);
  });
});
