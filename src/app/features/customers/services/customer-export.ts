/** KVKK veri dışa aktarma: JSON ve Excel (xlsx dinamik import). */
import type { CustomerDataExport } from './customer.service';

export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cell(v: unknown): string | number {
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
  return JSON.stringify(v);
}

function table(rows: Record<string, unknown>[]): (string | number)[][] {
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  return [keys, ...rows.map(r => keys.map(k => cell(r[k])))];
}

export async function downloadExcel(data: CustomerDataExport, fileName: string, sheetNames: { customer: string; transactions: string; sales: string }): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const customerRows = Object.entries(data.customer).map(([k, v]) => [k, cell(v)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(customerRows), sheetNames.customer.slice(0, 31));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table(data.creditTransactions)), sheetNames.transactions.slice(0, 31));
  // Satış kalemleri tek hücrede JSON; okunabilirlik için kalem özetini ayrı sütun yap
  const sales = data.sales.map(s => ({
    ...s,
    items: Array.isArray(s['items'])
      ? (s['items'] as Record<string, unknown>[]).map(i => `${i['productName']} x${i['quantity']}`).join(', ')
      : s['items'],
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table(sales)), sheetNames.sales.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
