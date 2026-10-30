/** Rapor tablolarını dışa aktarma. xlsx / jspdf dinamik import ile yüklenir (ana bundle'a girmez). */

export interface ExportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function exportExcel(fileName: string, tables: ExportTable[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const t of tables) {
    const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]);
    // Sayfa adı en fazla 31 karakter, bazı karakterler yasak
    XLSX.utils.book_append_sheet(wb, ws, t.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** jsPDF'in standart fontları Türkçe karakterleri desteklemiyor → ASCII'ye çevir. */
function pdfSafe(v: string | number): string {
  const map: Record<string, string> = {
    'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ç': 'c', 'Ç': 'C',
    'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U', '₺': 'TL',
  };
  return String(v).replace(/[şŞğĞıİçÇöÖüÜ₺]/g, ch => map[ch] ?? ch);
}

export async function exportPdf(fileName: string, heading: string, tables: ExportTable[]): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(pdfSafe(heading), 40, 40);
  let y = 60;
  for (const t of tables) {
    doc.setFontSize(11);
    doc.text(pdfSafe(t.title), 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [t.headers.map(pdfSafe)],
      body: t.rows.map(r => r.map(pdfSafe)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 40, right: 40 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 28;
  }
  doc.save(`${fileName}.pdf`);
}
