#!/usr/bin/env node
/**
 * Firebase CLI'yi proje içindeki JRE ile çalıştırır (Firestore emulator Java 11+ ister).
 *
 *   node scripts/emulator/firebase.mjs <firebase argümanları...>
 *
 * - `.tools/jre/` yoksa ve sistemde `java` yoksa Windows x64 için Eclipse Temurin 21 JRE'yi indirir.
 * - JAVA_HOME ve PATH'i `.tools/jre`'ye yönlendirir.
 * - `--import=<klasör>` verilmiş ama klasörde dışa aktarım yoksa (ilk çalıştırma) argümanı atlar.
 * - Canlı projeye yanlışlıkla bağlanmamak için `--project` mutlaka `demo-` ile başlamalı.
 *
 * Ayrıntı: docs/TEST-ORTAMI.md
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = path.join(ROOT, '.tools');
const JRE_DIR = path.join(TOOLS, 'jre');
const IS_WIN = process.platform === 'win32';
const JAVA_BIN = path.join(JRE_DIR, 'bin', IS_WIN ? 'java.exe' : 'java');
const JRE_URL = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';
const FIREBASE_CLI = path.join(ROOT, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

function systemJavaWorks() {
  const r = spawnSync('java', ['-version'], { stdio: 'ignore', shell: IS_WIN });
  return r.status === 0;
}

async function ensureJre() {
  if (existsSync(JAVA_BIN)) return true;
  if (!(IS_WIN && process.arch === 'x64')) {
    if (systemJavaWorks()) return false;
    console.error('[emulator] Java 11+ bulunamadı. Java 21 kurun veya JRE\'yi .tools/jre/ altına açın.');
    process.exit(1);
  }
  console.log('[emulator] .tools/jre yok: Eclipse Temurin 21 JRE indiriliyor (~50 MB)...');
  mkdirSync(TOOLS, { recursive: true });
  const zip = path.join(TOOLS, 'jre.zip');
  const res = await fetch(JRE_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`JRE indirilemedi: HTTP ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const tmp = path.join(TOOLS, 'jre-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  // Windows 10+ ile gelen bsdtar zip açabilir
  const r = spawnSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('JRE arşivi açılamadı (tar)');
  const inner = readdirSync(tmp).find(d => existsSync(path.join(tmp, d, 'bin')));
  if (!inner) throw new Error('JRE arşivinde bin/ bulunamadı');
  rmSync(JRE_DIR, { recursive: true, force: true });
  renameSync(path.join(tmp, inner), JRE_DIR);
  rmSync(tmp, { recursive: true, force: true });
  rmSync(zip, { force: true });
  console.log('[emulator] JRE hazır:', JRE_DIR);
  return true;
}

function fixArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--import=')) {
      const dir = path.resolve(ROOT, a.slice('--import='.length));
      if (!existsSync(path.join(dir, 'firebase-export-metadata.json'))) {
        console.log(`[emulator] ${path.relative(ROOT, dir)} içinde kayıtlı veri yok; boş başlatılıyor (npm run emu:seed ile doldurun).`);
        continue;
      }
    }
    out.push(a);
  }
  const pIdx = out.findIndex(a => a === '--project' || a.startsWith('--project='));
  const project = pIdx < 0 ? null : out[pIdx].includes('=') ? out[pIdx].split('=')[1] : out[pIdx + 1];
  if (!project || !project.startsWith('demo-')) {
    console.error('[emulator] Güvenlik: --project demo-... verilmeli (canlı projeye bağlanılmasın).');
    process.exit(1);
  }
  return out;
}

const args = fixArgs(process.argv.slice(2));
const env = { ...process.env };
// GCE metadata sunucusu yoklaması açılışı dakikalarca geciktirebiliyor; emulator için gereksiz
env.METADATA_SERVER_DETECTION = 'none';
if (await ensureJre()) {
  env.JAVA_HOME = JRE_DIR;
  const key = Object.keys(env).find(k => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[key] = path.join(JRE_DIR, 'bin') + path.delimiter + (env[key] ?? '');
}

const child = spawn(process.execPath, [FIREBASE_CLI, ...args], { cwd: ROOT, env, stdio: 'inherit' });
// Ctrl+C: firebase kendi kapanışını yapsın (--export-on-exit veriyi yazar). Windows'ta Ctrl+C aynı
// konsoldaki alt sürece zaten ulaşır; child.kill() orada süreci zorla sonlandırır (dışa aktarım yapılmaz).
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (!IS_WIN) child.kill(sig); });
}
child.on('exit', code => process.exit(code ?? 1));
