#!/usr/bin/env node
// Kullanım: npm run release -- 1.0.1
// package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml ve environment dosyalarındaki
// sürümü günceller, commit + tag atar ve push eder. GitHub Actions exe/msi'yi üretir.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Kullanım: npm run release -- <x.y.z>   (ör. 1.0.1)');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const dirty = execSync('git status --porcelain').toString().trim();
if (dirty) {
  console.error('Çalışma dizininde commit edilmemiş değişiklik var. Önce commit et.');
  process.exit(1);
}

const editJson = (path, fn) => {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  fn(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
};
editJson('package.json', (p) => { p.version = version; });
editJson('src-tauri/tauri.conf.json', (c) => { c.version = version; });

const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8')
  .replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync('src-tauri/Cargo.toml', cargo);

for (const env of ['src/environments/environment.ts', 'src/environments/environment.prod.ts']) {
  const s = readFileSync(env, 'utf8').replace(/appVersion: '[^']*'/, `appVersion: '${version}'`);
  writeFileSync(env, s);
}

run('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src/environments');
run(`git commit -m "release: v${version}"`);
run(`git tag v${version}`);
run('git push');
run(`git push origin v${version}`);
console.log(`\nv${version} gönderildi. GitHub > Actions'ta derleme başladı; bitince Releases'te taslak olarak görünecek.`);
