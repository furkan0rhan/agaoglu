#!/usr/bin/env node
/**
 * Kontrast denetimi: src/styles/_tokens.scss içindeki `-soft` zemin + `-text` metin çiftlerini
 * açık (:root) ve koyu (html.dark) temada WCAG AA (4.5:1) için hesaplar.
 * Yarı saydam `-soft` zeminler alttaki yüzeyle birleştirilir: kart (--surface), sayfa (--bg-page),
 * şerit (--surface-muted) ve tonlu kart içi (soft üstüne soft: TONE_TINT içindeki pill).
 * Ayrıca `-text` doğrudan kart yüzeyinde (TONE_TEXT) ölçülür.
 *
 * Kullanım: node scripts/contrast-check.mjs   (geçmeyen varsa çıkış kodu 1)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', '_tokens.scss');
const scss = readFileSync(file, 'utf8');

function block(selector) {
  const start = scss.indexOf(selector + ' {');
  if (start < 0) throw new Error(`${selector} bulunamadı`);
  let depth = 0;
  for (let i = scss.indexOf('{', start); i < scss.length; i++) {
    if (scss[i] === '{') depth++;
    else if (scss[i] === '}' && --depth === 0) return scss.slice(start, i);
  }
  throw new Error(`${selector} kapanmıyor`);
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = vars(block(':root'));
const dark = { ...light, ...vars(block('html.dark')) };

function parse(v, theme) {
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) return parse(theme[ref[1]], theme);
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`Renk çözülemedi: ${v}`);
}
const over = (fg, bg) => {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
};
const lum = (c) => {
  const [r, g, b] = c.slice(0, 3).map((x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TONES = ['brand', 'accent', 'success', 'warning', 'danger', 'info', 'neutral'];
let fails = 0;
for (const [name, t] of [['açık', light], ['koyu', dark]]) {
  console.log(`\n== ${name} tema ==`);
  console.log('ton       kart   sayfa  şerit  tonlu-kart  metin/kart');
  for (const tone of TONES) {
    const soft = parse(t[`${tone}-soft`], t);
    const text = parse(t[`${tone}-text`], t);
    const surface = parse(t.surface, t);
    const cells = [
      over(soft, surface),
      over(soft, parse(t['bg-page'], t)),
      over(soft, parse(t['surface-muted'], t)),
      over(soft, over(soft, surface)),
      surface,
    ].map((bg) => ratio(over(text, bg), bg));
    const row = cells.map((r) => {
      if (r < 4.5) fails++;
      return (r.toFixed(2) + (r < 4.5 ? '✗' : ' ')).padStart(6);
    });
    console.log(`${tone.padEnd(8)} ${row[0]} ${row[1]} ${row[2]}     ${row[3]}     ${row[4]}`);
  }
  // Dolu zemin + kontrast metin (TONE_SOLID, butonlar) ve gri metinler
  const pairs = [
    ['brand', 'brand-contrast'], ['accent', 'accent-contrast'], ['success', 'text-inverse'],
    ['warning', 'text-inverse'], ['danger', 'text-inverse'], ['info', 'text-inverse'], ['sale', 'sale-text'],
    ['surface', 'text-muted'], ['surface-muted', 'text-muted'], ['bg-page', 'text-muted'], ['surface', 'text-secondary'],
    ['side-bg', 'side-muted'], ['side-bg', 'side-text'], ['side-2', 'side-muted'],
  ];
  const line = pairs.map(([bg, fg]) => {
    const b = over(parse(t[bg], t), parse(t.surface, t));
    const r = ratio(over(parse(t[fg], t), b), b);
    if (r < 4.5) fails++;
    return `${fg}/${bg} ${r.toFixed(2)}${r < 4.5 ? '✗' : ''}`;
  });
  console.log('dolu/gri: ' + line.join(' · '));
}
console.log(fails ? `\n${fails} çift AA (4.5:1) altında.` : '\nTümü AA (≥4.5:1).');
process.exit(fails ? 1 : 0);
