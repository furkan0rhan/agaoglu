/**
 * Firestore kuralı testleri için ortak kurulum.
 * Kimlikler firestore.rules.md'deki elle test tablosuyla aynı:
 *   OWNER  — işletme sahibi (tenantId 'OWNER', admin)
 *   CASH   — OWNER işletmesinde kasiyer
 *   STAFF  — OWNER işletmesinde personel
 *   OFF    — OWNER işletmesinde pasif personel
 *   OTHER  — başka işletmenin sahibi (tenantId 'OTHER', admin)
 *
 * Superadmin (platformAdmins) testleri ayrı bir spec dosyasında eklenebilir; aynı yardımcılarla:
 *   await seed(env, { 'platformAdmins/SUPER': { createdAt: new Date() } });
 *   const db = as(env, 'SUPER', { email: 'super@test.local', email_verified: true });
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-tarim-rules';

export async function createEnv(): Promise<RulesTestEnvironment> {
  const hostPort = process.env['FIRESTORE_EMULATOR_HOST'];
  if (!hostPort) {
    throw new Error('FIRESTORE_EMULATOR_HOST yok. Testleri `npm run test:rules` ile çalıştırın.');
  }
  const [host, port] = hostPort.split(':');
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
}

export const BASE_USERS: Record<string, Record<string, unknown>> = {
  'users/OWNER': { tenantId: 'OWNER', role: 'admin', isActive: true, email: 'owner@test.local', displayName: 'Sahip' },
  'users/CASH': { tenantId: 'OWNER', role: 'cashier', isActive: true, email: 'cash@test.local', displayName: 'Kasiyer' },
  'users/STAFF': { tenantId: 'OWNER', role: 'staff', isActive: true, email: 'staff@test.local', displayName: 'Personel' },
  'users/OFF': { tenantId: 'OWNER', role: 'staff', isActive: false, email: 'off@test.local', displayName: 'Pasif' },
  'users/OTHER': { tenantId: 'OTHER', role: 'admin', isActive: true, email: 'other@test.local', displayName: 'Diğer' },
  'tenants/OWNER': { name: 'Ağaoğlu Tarım', ownerId: 'OWNER' },
  'tenants/OTHER': { name: 'Yeşil Vadi Zirai', ownerId: 'OTHER' },
};

/** Kuralları atlayarak doküman yazar (test ön koşulları). */
export async function seed(env: RulesTestEnvironment, docs: Record<string, Record<string, unknown>>): Promise<void> {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

/** Kimliği doğrulanmış istemci (e-posta claim'leri isteğe bağlı). */
export function as(env: RulesTestEnvironment, uid: string, token: TokenOptions = {}): Firestore {
  return env.authenticatedContext(uid, token).firestore() as unknown as Firestore;
}

export function anon(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}
