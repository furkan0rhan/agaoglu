/** Aydınlatma metni: şablon doldurma ve küçük, güvenli markdown → HTML dönüştürücü (bağımlılıksız). */

export const LEGAL_TEXT_URL = 'assets/legal/aydinlatma-metni.md';

export function fillLegalTemplate(md: string, vars: Record<string, string>): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_, k: string) => (vars[k] ?? '').trim() || '—');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Başlık (#, ##), madde (-, 1.), kalın (**), yatay çizgi (---) ve paragraf destekler. HTML kaçışlanır. */
export function renderLegalMarkdown(md: string): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) { flushPara(); closeList(); continue; }
    if (line === '---') { flushPara(); closeList(); out.push('<hr>'); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); closeList();
      const lvl = m[1].length + 1; // # → h2 (sayfa başlığı dialogda)
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      continue;
    }
    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}
