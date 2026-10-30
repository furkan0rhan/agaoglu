import { addMonths, buildCreditPlan, creditDebtFields } from './credit-plan';

describe('buildCreditPlan (POS veresiye dialogu)', () => {
  const first = new Date(2026, 10, 30);

  it('peşinatsız, vade farksız: toplam taksitlere eşit bölünür, kuruş farkı son taksitte', () => {
    const r = buildCreditPlan({ total: 1727.01, rate: 0, downPayment: 0, count: 3, firstDueDate: first, intervalMonths: 1 });
    expect(r.financed).toBe(1727.01);
    expect(r.plan.installments.map(i => i.amount)).toEqual([575.67, 575.67, 575.67]);
    expect(r.plan.installments.reduce((s, i) => s + i.amount, 0)).toBeCloseTo(1727.01, 2);
  });

  it('peşinat düşülür, vade farkı yalnız kalan tutara uygulanır', () => {
    const r = buildCreditPlan({ total: 1000, rate: 10, downPayment: 200, count: 2, firstDueDate: first, intervalMonths: 1 });
    expect(r.downPayment).toBe(200);
    expect(r.base).toBe(800);
    expect(r.interest).toBe(80);
    expect(r.financed).toBe(880);
    expect(r.plan.installments).toHaveLength(2);
    expect(r.plan.dueDate?.getMonth()).toBe(11);
  });

  it('hasatta öde: tek taksit, vade = hasat tarihi', () => {
    const harvest = new Date(2027, 6, 15);
    const r = buildCreditPlan({ total: 500, rate: 0, downPayment: 0, count: 1, firstDueDate: harvest, intervalMonths: 1 });
    expect(r.plan.installments).toHaveLength(1);
    expect(r.plan.dueDate?.getTime()).toBe(new Date(2027, 6, 15).getTime());
  });

  it('peşinat toplamı aşamaz; tamamı peşinse borç yok', () => {
    const r = buildCreditPlan({ total: 300, rate: 5, downPayment: 999, count: 3, firstDueDate: first, intervalMonths: 1 });
    expect(r.downPayment).toBe(300);
    expect(r.financed).toBe(0);
    expect(r.plan.installments).toHaveLength(0);
  });

  it('addMonths ay sonunu kırpar', () => {
    expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(28);
  });
});

describe('creditDebtFields (borç kaydı)', () => {
  it('plan varsa amount = plan.financed, vade/taksit/peşinat yazılır', () => {
    const r = buildCreditPlan({ total: 1000, rate: 10, downPayment: 200, count: 2, firstDueDate: new Date(2026, 10, 30), intervalMonths: 1 });
    const f = creditDebtFields(800, {
      interestRate: 10, installmentCount: 2, installmentAmount: r.plan.installments[0].amount, totalWithInterest: r.financed, plan: r.plan,
    });
    expect(f.amount).toBe(880);
    expect(f.originalAmount).toBe(800);
    expect(f.downPayment).toBe(200);
    expect(f.dueDate).toEqual(r.plan.dueDate);
    expect(f.installments).toHaveLength(2);
  });

  it('plan yoksa (kısmi nakit → veresiye) sepetteki veresiye yazılır, vade yok', () => {
    const f = creditDebtFields(150);
    expect(f).toMatchObject({ amount: 150, originalAmount: null, dueDate: null, installments: null, downPayment: null });
  });

  it('eski çağrı: totalWithInterest varsa o yazılır', () => {
    expect(creditDebtFields(100, { interestRate: 10, installmentCount: null, installmentAmount: null, totalWithInterest: 110 }).amount).toBe(110);
  });
});
