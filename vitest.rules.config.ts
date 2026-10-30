import { defineConfig } from 'vitest/config';

/**
 * Firestore güvenlik kuralı testleri (Angular'dan bağımsız, Node ortamı).
 * Doğrudan çalıştırmayın: `npm run test:rules` Firestore emulator'ü (port 8180) açıp bu config ile
 * vitest'i çalıştırır ve FIRESTORE_EMULATOR_HOST'u ayarlar. Ayrıntı: docs/TEST-ORTAMI.md
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.spec.ts'],
    environment: 'node',
    // Tüm dosyalar aynı emulator projesini paylaşır (clearFirestore) → sıralı çalış
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
