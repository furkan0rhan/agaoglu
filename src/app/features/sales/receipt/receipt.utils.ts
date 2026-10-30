import { Sale, SaleReceipt } from '../../../shared/models/sale.model';

/** Firestore satış dokümanından fiş verisi. */
export function saleToReceipt(sale: Sale): SaleReceipt {
  return {
    saleNumber: sale.saleNumber,
    date: sale.createdAt?.toDate?.() ?? new Date(),
    customerName: sale.customerName,
    items: sale.items ?? [],
    subtotal: sale.subtotal ?? 0,
    totalDiscount: sale.totalDiscount ?? 0,
    totalAmount: sale.totalAmount ?? 0,
    paymentMethod: sale.paymentMethod,
    cashPaid: sale.cashPaid ?? 0,
    cardPaid: sale.cardPaid ?? 0,
    creditAmount: sale.creditAmount ?? 0,
    change: sale.change ?? 0,
    totalWithInterest: sale.totalWithInterest ?? null,
    installmentCount: sale.installmentCount ?? null,
    prescriptionNo: sale.prescriptionNo ?? null,
    dueDate: toDate(sale.creditDueDate),
    downPayment: sale.downPayment ?? null,
  };
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date } | null | undefined;
  return t?.toDate?.() ?? null;
}

/**
 * Ayarlar → Fiş önizlemesi ve "test fişi" için örnek fiş (ikisi aynı veriyi kullanır).
 * İlk kalemde ruhsat no ve GTS var: ilgili gösterim ayarları önizlemede görülebilsin.
 */
export function sampleReceipt(customerName: string, itemNames: readonly string[]): SaleReceipt {
  const [a, b] = itemNames;
  return {
    saleNumber: 'TEST-0001',
    date: new Date(),
    customerName,
    items: [
      { productName: a, quantity: 2, unit: 'adet', unitPrice: 485, discount: 0, discountType: 'amount', totalPrice: 970,
        licenseNo: '1452/2019', gtsNos: ['8690000123457-0041', '8690000123457-0042'] },
      { productName: b, quantity: 4, unit: 'adet', unitPrice: 1150, discount: 0, discountType: 'amount', totalPrice: 4600 },
    ],
    subtotal: 5570, totalDiscount: 0, totalAmount: 5570,
    paymentMethod: 'cash', cashPaid: 5570, cardPaid: 0, creditAmount: 0, change: 0,
    totalWithInterest: null, installmentCount: null,
  };
}
