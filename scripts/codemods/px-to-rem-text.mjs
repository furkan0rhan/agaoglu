#!/usr/bin/env node
/**
 * Codemod: Tailwind `text-[Npx]` yazı boyutu sınıflarını rem'e çevirir ki Ayarlar > Görünüm > Yazı boyutu
 * (`--font-scale`, html font-size'ı ölçekler) bu yazıları da büyütsün. Görünüm 16px tabanında aynı kalır.
 *
 *   text-[13px]    → text-13            (tailwind.config.js `fontSize` isimli adım; yalnız font-size, line-height yok)
 *   text-[34px]    → text-[2.125rem]    (isimli adımı olmayan değerler: rem arbitrary)
 *   sm:text-[15px] → sm:text-15         (varyant önekleri korunur)
 *
 * Yalnız `text-[<sayı>px]` sınıflarına dokunur; renk (`text-[#..]`), `text-[length:..]`, `leading-[..px]`
 * ve inline `font-size:` değişmez. Varsayılan: src/app altındaki .ts ve .html.
 *
 * Kullanım: node scripts/codemods/px-to-rem-text.mjs [--dry] [dizin...]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** tailwind.config.js `theme.extend.fontSize` ile AYNI liste (px değerleri). */
export const NAMED_STEPS = [10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 19, 20, 22, 24, 26, 28];

// Öncesinde sınıf ayırıcı olmalı (boşluk, tırnak, backtick, varyant ':' , '!' önemi, '[class.' noktası).
const RE = /(?<=^|[\s"'`:!.])text-\[(\d+(?:\.\d+)?)px\](?=$|[\s"'`\]])/gm;

export function convert(src) {
  let count = 0;
  const out = src.replace(RE, (_m, px) => {
    count++;
    const n = Number(px);
    if (NAMED_STEPS.includes(n)) return `text-${px}`;
    return `text-[${+(n / 16).toFixed(5)}rem]`;
  });
  return { out, count };
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (['.ts', '.html'].includes(extname(p))) yield p;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const roots = args.filter((a) => !a.startsWith('--'));
  let files = 0;
  let total = 0;
  for (const root of roots.length ? roots : ['src/app']) {
    for (const file of walk(root)) {
      const src = readFileSync(file, 'utf8');
      const { out, count } = convert(src);
      if (!count) continue;
      files++;
      total += count;
      if (!dry) writeFileSync(file, out);
      console.log(`${String(count).padStart(4)}  ${file}`);
    }
  }
  console.log(`${dry ? '[dry] ' : ''}${total} sınıf, ${files} dosya`);
}
