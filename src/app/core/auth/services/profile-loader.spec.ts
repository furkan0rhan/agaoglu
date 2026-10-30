import { fetchProfileWithRetry, isTransientFirestoreError, ProfileSnap } from './profile-loader';

const offline = () => Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const snap = (data: Record<string, unknown> | null): ProfileSnap => ({ exists: () => data !== null, data: () => data ?? undefined });
const noCache = () => Promise.reject(Object.assign(new Error('not in cache'), { code: 'unavailable' }));
const fast = { delays: [1, 1, 1, 1, 1], sleep: () => Promise.resolve() };

describe('fetchProfileWithRetry', () => {
  it('ilk 2 deneme "client is offline", 3. başarılı → profil döner', async () => {
    let calls = 0;
    const server = vi.fn(() => (++calls <= 2 ? Promise.reject(offline()) : Promise.resolve(snap({ tenantId: 't1' }))));
    const res = await fetchProfileWithRetry(server, noCache, fast);
    expect(server).toHaveBeenCalledTimes(3);
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.fromCache).toBe(false);
      expect(res.snap.data()).toEqual({ tenantId: 't1' });
    }
  });

  it('sunucu çevrimdışı ama önbellekte varsa önbellekten döner', async () => {
    const res = await fetchProfileWithRetry(() => Promise.reject(offline()), () => Promise.resolve(snap({ a: 1 })), fast);
    expect(res).toMatchObject({ status: 'ok', fromCache: true });
  });

  it('permission-denied tekrar denenmez', async () => {
    const server = vi.fn(() => Promise.reject(denied()));
    const res = await fetchProfileWithRetry(server, noCache, fast);
    expect(server).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('denied');
  });

  it('tüm denemeler çevrimdışı → unavailable (delays.length + 1 deneme)', async () => {
    const server = vi.fn(() => Promise.reject(offline()));
    const sleeps: number[] = [];
    const res = await fetchProfileWithRetry(server, noCache, { delays: [500, 1000, 2000], sleep: ms => { sleeps.push(ms); return Promise.resolve(); } });
    expect(server).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([500, 1000, 2000]);
    expect(res.status).toBe('unavailable');
  });

  it('geçici hata tanıma', () => {
    expect(isTransientFirestoreError(offline())).toBe(true);
    expect(isTransientFirestoreError(denied())).toBe(false);
  });
});
