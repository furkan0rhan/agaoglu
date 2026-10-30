import { signal } from '@angular/core';

/**
 * Testler için AuthService'in oturum kapsamı yüzeyi (sessionKey / onSessionChange / tenant / uid).
 * `switchTo('u2|t2')` gerçek AuthService gibi kayıtlı sıfırlayıcıları senkron çağırır; `''` = çıkış.
 */
export class FakeSessionAuth {
  readonly key = signal('u1|t1');
  private readonly listeners = new Set<(key: string) => void>();

  sessionKey = (): string => this.key();
  currentUserId = (): string => this.key().split('|')[0] ?? '';
  currentTenantId = (): string => this.key().split('|')[1] ?? '';
  isSuperAdmin = (): boolean => false;
  currentUser = () => (this.key() ? { id: this.currentUserId(), tenantId: this.currentTenantId(), role: 'admin' } : null);

  onSessionChange(fn: (key: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  switchTo(key: string): void {
    if (key === this.key()) return;
    this.key.set(key);
    for (const fn of [...this.listeners]) fn(key);
  }
}
