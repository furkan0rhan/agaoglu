import {
  addMonthsClamped, allocatePayment, buildInstallmentPlan, buildReminderText, buildSchedule, buildStatement,
  checkCreditLimit, creditStatus, daysOverdue, debtInstallments, reminderMessage, smsLink, summarizeOverdue, toIntlPhone, whatsappLink,
} from './credit.utils';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ts = (date: Date) => ({ toDate: () => date });

describe('buildInstallmentPlan', () => {
  it('kuruş farkı son taksitte, toplam tutar korunur', () => {
    const p = buildInstallmentPlan(1727, 3, d(2026, 11, 15));
    expect(p.installments.map(i => i.amount)).toEqual([575.66, 575.66, 575.68]);
    expect(p.installments.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(1727, 2);
    expect(p.financed).toBe(1727);
  });
  it('aylık vade tarihleri, ay sonu kırpılır, zincirleme kaymaz', () => {
    const p = buildInstallmentPlan(300, 3, d(2027, 1, 31));
    expect(p.installments.map(i => i.dueDate)).toEqual([d(2027, 1, 31), d(2027, 2, 28), d(2027, 3, 31)]);
    expect(p.dueDate).toEqual(d(2027, 3, 31));
  });
  it('peşinat düşülür', () => {
    const p = buildInstallmentPlan(1000, 2, d(2026, 12, 1), 200);
    expect(p.downPayment).toBe(200);
    expect(p.financed).toBe(800);
    expect(p.installments.map(i => i.amount)).toEqual([400, 400]);
    expect(p.installments.every(i => i.paidAmount === 0)).toBe(true);
  });
  it('peşinat toplamı karşılıyorsa taksit yok; fazla peşinat kırpılır', () => {
    const p = buildInstallmentPlan(500, 3, d(2026, 12, 1), 900);
    expect(p.downPayment).toBe(500);
    expect(p.installments).toEqual([]);
    expect(p.dueDate).toBeNull();
  });
  it('hasatta tek ödeme ve aralıklı taksit', () => {
    expect(buildInstallmentPlan(1000, 1, d(2027, 7, 15)).installments).toHaveLength(1);
    const q = buildInstallmentPlan(900, 3, d(2027, 1, 10), 0, 3);
    expect(q.installments.map(i => i.dueDate)).toEqual([d(2027, 1, 10), d(2027, 4, 10), d(2027, 7, 10)]);
  });
  it('geçersiz taksit sayısı 1 kabul edilir', () => {
    expect(buildInstallmentPlan(100, 0, d(2027, 1, 1)).installments).toHaveLength(1);
  });
  it('addMonthsClamped artık yıl', () => expect(addMonthsClamped(d(2028, 1, 31), 1)).toEqual(d(2028, 2, 29)));
});

const debt = (id: string, amount: number, installments: { no: number; dueDate: Date; amount: number }[] | null, extra = {}) => ({
  id, type: 'debt' as const, amount, saleId: 'S' + id, createdAt: ts(d(2026, 10, 1)),
  installments: installments?.map(i => ({ ...i, dueDate: ts(i.dueDate) })) ?? null, ...extra,
});

describe('tahsilat dağıtımı (en eski vadeden)', () => {
  const plan = (id: string, total: number, first: Date) =>
    debt(id, total, buildInstallmentPlan(total, 3, first).installments);

  it('allocatePayment en eski vadeyi önce kapatır, artanı döndürür', () => {
    const items = debtInstallments([plan('A', 300, d(2026, 11, 1)), plan('B', 300, d(2026, 10, 15))]);
    const { items: out, unallocated } = allocatePayment(items, 250);
    // B1 (15.10) 100 → A1 (1.11) 100 → B2 (15.11) 50
    expect(out.map(i => `${i.txId}${i.no}:${i.paidAmount}`).slice(0, 3)).toEqual(['B1:100', 'A1:100', 'B2:50']);
    expect(out[2].remaining).toBe(50);
    expect(unallocated).toBe(0);
    expect(allocatePayment(items, 1000).unallocated).toBe(400);
  });

  it('buildSchedule: ödenen = taksit toplamı − bakiye', () => {
    const s = buildSchedule([plan('A', 300, d(2026, 11, 1))], 150);
    expect(s.map(i => i.remaining)).toEqual([0, 50, 100]);
  });

  it('iptal edilen satışın taksitleri düşülür, tahsilat kayıtları yok sayılır', () => {
    const txs = [
      plan('A', 300, d(2026, 11, 1)),
      { id: 'R', type: 'debt' as const, amount: -300, saleId: 'SA', isReversal: true, createdAt: ts(d(2026, 10, 5)) },
      debt('B', 200, null, { dueDate: ts(d(2026, 12, 1)) }),
      { id: 'P', type: 'payment' as const, amount: 50, saleId: null, createdAt: ts(d(2026, 10, 6)) },
    ];
    const s = buildSchedule(txs, 200);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ txId: 'B', amount: 200, remaining: 200 });
  });

  it('vadesiz eski borç gecikmeye düşmez ama önce ödenir', () => {
    const txs = [debt('OLD', 100, null), plan('A', 300, d(2026, 11, 1))];
    const s = buildSchedule(txs, 350);
    expect(s.find(i => i.txId === 'OLD')!.remaining).toBe(50);
    const st = creditStatus(s, d(2026, 12, 15));
    // OLD (oluşturma 1.10) önce ödenir; A1 (1.11), A2 (1.12) gecikmiş, A3 (1.1) değil; OLD vadesiz
    expect(st.overdueAmount).toBe(200);
    expect(st.overdueCount).toBe(2);
  });
});

describe('gecikme hesabı', () => {
  it('daysOverdue: vade günü 0, ertesi gün 1', () => {
    expect(daysOverdue(d(2026, 10, 27), new Date(2026, 9, 27, 18))).toBe(0);
    expect(daysOverdue(d(2026, 10, 20), d(2026, 10, 27))).toBe(7);
    expect(daysOverdue(d(2026, 11, 1), d(2026, 10, 27))).toBe(0);
    expect(daysOverdue(null)).toBe(0);
  });
  it('creditStatus: gecikmiş, bu hafta ve sıradaki vade', () => {
    const txs = [debt('A', 300, buildInstallmentPlan(300, 3, d(2026, 10, 10)).installments)];
    // taksitler: 10.10, 10.11, 10.12 ; bugün 5.11
    const st = creditStatus(buildSchedule(txs, 300), d(2026, 11, 5));
    expect(st.overdueAmount).toBe(100);
    expect(st.maxDaysOverdue).toBe(26);
    expect(st.dueThisWeekAmount).toBe(100);
    expect(st.nextDue).toEqual({ date: d(2026, 11, 10), amount: 100 });
    // Gecikmiş taksit ödendiyse gecikme yok
    expect(creditStatus(buildSchedule(txs, 200), d(2026, 11, 5)).overdueAmount).toBe(0);
  });
  it('summarizeOverdue', () => {
    const a = creditStatus(buildSchedule([debt('A', 100, null, { dueDate: ts(d(2026, 1, 1)) })], 100), d(2026, 2, 1));
    const b = creditStatus([], d(2026, 2, 1));
    expect(summarizeOverdue([a, b, a])).toEqual({ totalOverdue: 200, customerCount: 2 });
  });
});

describe('checkCreditLimit', () => {
  it('limitsiz', () => expect(checkCreditLimit(500, null, 1000).exceeded).toBe(false));
  it('aşım', () => {
    const r = checkCreditLimit(4000, 5000, 1500);
    expect(r).toMatchObject({ exceeded: true, newBalance: 5500, overBy: 500, available: 1000 });
  });
  it('tam limit aşım değildir', () => expect(checkCreditLimit(4000, 5000, 1000).exceeded).toBe(false));
});

describe('buildStatement', () => {
  it('devreden bakiye, aralık içi hareketler ve kapanış', () => {
    const txs = [
      { type: 'debt' as const, amount: 1000, description: 'Satış 1', createdAt: ts(d(2026, 9, 1)) },
      { type: 'payment' as const, amount: 300, description: 'Tahsilat', createdAt: ts(d(2026, 10, 5)) },
      { type: 'debt' as const, amount: 500, description: 'Satış 2', createdAt: ts(d(2026, 10, 20)) },
      { type: 'debt' as const, amount: -500, description: 'İptal', createdAt: ts(d(2026, 10, 21)) },
      { type: 'debt' as const, amount: 99, description: 'Sonra', createdAt: ts(d(2026, 11, 2)) },
    ];
    const s = buildStatement(txs, d(2026, 10, 1), d(2026, 10, 31));
    expect(s.opening).toBe(1000);
    expect(s.rows.map(r => r.balance)).toEqual([700, 1200, 700]);
    expect(s.totalDebit).toBe(500);
    expect(s.totalCredit).toBe(800);
    expect(s.closing).toBe(700);
  });
});

describe('hatırlatma', () => {
  it('telefon dönüşümü', () => {
    expect(toIntlPhone('0532 123 45 67')).toBe('905321234567');
    expect(toIntlPhone('+90 (532) 123-45-67')).toBe('905321234567');
    expect(toIntlPhone('123')).toBeNull();
  });
  it('Türkçe şablon: borç, vade, işletme adı', () => {
    const text = buildReminderText({
      customerName: 'Mehmet Yılmaz', balance: 1227, businessName: 'Yeşil Tarım', overdueAmount: 500, dueDate: d(2026, 10, 15),
    });
    expect(text).toContain('Sayın Mehmet Yılmaz');
    expect(text).toContain('1.227,00 TL');
    expect(text).toContain('500,00 TL');
    expect(text).toContain('15.10.2026');
    expect(text).toContain('Yeşil Tarım');
  });
  it('wa.me ve sms bağlantıları', () => {
    expect(whatsappLink('05321234567', 'a b')).toBe('https://wa.me/905321234567?text=a%20b');
    expect(smsLink('05321234567', 'ç')).toBe('sms:+905321234567?body=%C3%A7');
  });
});

describe('reminderMessage', () => {
  const input = { customerName: 'Ali Yılmaz', balance: 1500, businessName: 'Ağaoğlu Tarım', dueDate: d(2026, 11, 15), businessPhone: '0555 111 22 33' };

  it('şablon boşsa yerleşik metin', () => {
    expect(reminderMessage('', input)).toBe(buildReminderText(input));
    expect(reminderMessage('   ', input)).toBe(buildReminderText(input));
  });

  it('şablon doluysa değişkenler doldurulur', () => {
    expect(reminderMessage('Sayın {ad}, borcunuz {borc}. Vade {vade}. {isletme} {telefon}', input))
      .toBe('Sayın Ali Yılmaz, borcunuz 1.500,00 TL. Vade 15.11.2026. Ağaoğlu Tarım 0555 111 22 33');
  });
});

describe('Y7: vadesiz borçlara varsayılan vade', () => {
  // Satış 1.10.2026 (debt() createdAt), vade kaydı yok
  it('varsayılan vade verilmezse vadesiz kalır (eski davranış)', () => {
    const st = creditStatus(buildSchedule([debt('A', 500, null)], 500), d(2026, 12, 30));
    expect(st.overdueAmount).toBe(0);
  });

  it('satış + varsayılan vade (30 gün) geçince gecikmiş sayılır', () => {
    const items = buildSchedule([debt('A', 500, null)], 500, { defaultDueDays: 30 });
    expect(items[0].dueDate).toEqual(d(2026, 10, 31));
    expect(items[0].dueDerived).toBe('default');
    expect(creditStatus(items, d(2026, 10, 30)).overdueAmount).toBe(0);
    const late = creditStatus(items, d(2026, 11, 30));
    expect(late.overdueAmount).toBe(500);
    expect(late.maxDaysOverdue).toBe(30);
  });

  it('taksit planı kaydedilmemiş eski taksitli satış: taksit sayısından aylık plan türetilir', () => {
    const items = buildSchedule([debt('A', 300, null, { installmentCount: 3 })], 300, { defaultDueDays: 30 });
    expect(items.map(i => i.dueDate)).toEqual([d(2026, 11, 1), d(2026, 12, 1), d(2027, 1, 1)]);
    expect(items.map(i => i.amount)).toEqual([100, 100, 100]);
    expect(items.every(i => i.dueDerived === 'installments')).toBe(true);
    expect(creditStatus(items, d(2026, 11, 15)).overdueAmount).toBe(100);
  });

  it('kayıtlı vade / taksit planı varsa varsayılan uygulanmaz', () => {
    const explicit = buildSchedule([debt('A', 100, null, { dueDate: ts(d(2027, 3, 1)) })], 100, { defaultDueDays: 30 });
    expect(explicit[0].dueDate).toEqual(d(2027, 3, 1));
    expect(explicit[0].dueDerived).toBeUndefined();
  });

  it('taksit tutarları kuruşu kaybetmez', () => {
    const items = debtInstallments([debt('A', 100, null, { installmentCount: 3 })], {});
    expect(items.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(100, 2);
    expect(items[2].amount).toBe(33.34);
  });
});
