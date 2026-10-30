#!/usr/bin/env node
/**
 * src/styles/_primeicons.scss üretir: primeicons.css'in ikon sınıfları + yalnız woff2/woff @font-face.
 * Paketin kendi @font-face'i eot/ttf/svg'yi de bağladığı için Angular bunları dist'e kopyalıyordu.
 * primeicons sürümü güncellenince yeniden çalıştırın: node scripts/codemods/primeicons-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('node_modules/primeicons/package.json', 'utf8'));
const css = readFileSync('node_modules/primeicons/primeicons.css', 'utf8');
const body = css.replace(/@font-face\s*\{[^}]*\}\s*/, '');
if (body === css) throw new Error('primeicons.css içinde @font-face bulunamadı');

const out = `// =============================================================================
// PrimeIcons ${pkg.version} — ÜRETİLMİŞ DOSYA, elle düzenlemeyin (scripts/codemods/primeicons-css.mjs).
// Yalnız woff2/woff: paketin @font-face'i eot/ttf/svg'yi de dist'e taşıyordu.
// =============================================================================

@font-face {
  font-family: 'primeicons';
  font-display: block;
  src: url('../../node_modules/primeicons/fonts/primeicons.woff2') format('woff2'),
       url('../../node_modules/primeicons/fonts/primeicons.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}

${body.trim()}
`;
writeFileSync('src/styles/_primeicons.scss', out);
console.log(`src/styles/_primeicons.scss yazıldı (primeicons ${pkg.version})`);
