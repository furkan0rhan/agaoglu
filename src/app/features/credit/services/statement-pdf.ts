/**
 * Müşteri hesap ekstresi (A4 PDF). jsPDF + autotable dinamik import (ana bundle'a girmez).
 * Türkçe karakterler ve ₺ için Noto Sans (OFL, src/assets/fonts) gömülür; ASCII'ye çevirme YOK.
 */
import type { jsPDF as JsPdfType } from 'jspdf';
import type { Statement } from './credit.utils';

export interface StatementPdfInput {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  customerName: string;
  customerPhone?: string | null;
  from: Date;
  to: Date;
  statement: Statement;
  /** Gecikmiş tutar (0 ise yazılmaz). */
  overdueAmount?: number;
  labels: StatementLabels;
}

export interface StatementLabels {
  title: string; period: string; customer: string; date: string; description: string;
  debit: string; credit: string; balance: string; opening: string; closing: string; total: string;
  overdue: string; printedAt: string; pending: string;
}

const FONT = 'NotoSans';
let fontCache: Promise<{ regular: string; bold: string }> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  fontCache ??= (async () => {
    const get = async (file: string) => {
      const res = await fetch(new URL(`assets/fonts/${file}`, document.baseURI).toString());
      if (!res.ok) throw new Error(`FONT_LOAD_FAILED ${file}`);
      return toBase64(await res.arrayBuffer());
    };
    const [regular, bold] = await Promise.all([get('NotoSans-Regular.ttf'), get('NotoSans-Bold.ttf')]);
    return { regular, bold };
  })().catch(err => { fontCache = null; throw err; });
  return fontCache;
}

/** jsPDF belgesine Noto Sans'ı ekler ve etkin font yapar. */
export async function registerTurkishFont(doc: JsPdfType): Promise<string> {
  const { regular, bold } = await loadFonts();
  doc.addFileToVFS('NotoSans-Regular.ttf', regular);
  doc.addFont('NotoSans-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', bold);
  doc.addFont('NotoSans-Bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');
  return FONT;
}

const money = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₺';
const date = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

export async function downloadStatementPdf(input: StatementPdfInput, fileName: string): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const font = await registerTurkishFont(doc);
  const L = input.labels;
  const s = input.statement;
  const left = 40;
  const right = doc.internal.pageSize.getWidth() - 40;

  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.text(input.businessName || '-', left, 44);
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  const bizLines = [input.businessAddress, input.businessPhone].filter(Boolean) as string[];
  bizLines.forEach((l, i) => doc.text(l, left, 58 + i * 12));

  doc.setFont(font, 'bold');
  doc.setFontSize(12);
  doc.text(L.title, right, 44, { align: 'right' });
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`${L.period}: ${date(input.from)} – ${date(input.to)}`, right, 58, { align: 'right' });
  doc.text(`${L.printedAt}: ${date(new Date())}`, right, 70, { align: 'right' });

  doc.setFontSize(10);
  doc.text(`${L.customer}: ${input.customerName}${input.customerPhone ? ' · ' + input.customerPhone : ''}`, left, 96);

  autoTable(doc, {
    startY: 108,
    head: [[L.date, L.description, L.debit, L.credit, L.balance]],
    body: [
      ['', L.opening, '', '', money(s.opening)],
      ...s.rows.map(r => [
        r.date ? date(r.date) : L.pending,
        r.description,
        r.debit ? money(r.debit) : '',
        r.credit ? money(r.credit) : '',
        money(r.balance),
      ]),
    ],
    foot: [[ '', L.total, money(s.totalDebit), money(s.totalCredit), money(s.closing) ]],
    styles: { font, fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { font, fontStyle: 'bold', fillColor: [22, 101, 52] },
    footStyles: { font, fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: {
      0: { cellWidth: 62 },
      2: { halign: 'right', cellWidth: 72 },
      3: { halign: 'right', cellWidth: 72 },
      4: { halign: 'right', cellWidth: 78 },
    },
    margin: { left, right: 40 },
  });

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120) + 22;
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.text(`${L.closing}: ${money(s.closing)}`, right, y, { align: 'right' });
  if (input.overdueAmount && input.overdueAmount > 0) {
    y += 16;
    doc.setTextColor(185, 28, 28);
    doc.text(`${L.overdue}: ${money(input.overdueAmount)}`, right, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  doc.save(`${fileName}.pdf`);
}
