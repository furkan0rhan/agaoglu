import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UpdaterService } from './updater.service';

interface DownloadEvent { event: string; data?: { contentLength?: number; chunkLength?: number } }

function fakeUpdate(version = '1.3.0') {
  return {
    version,
    downloadAndInstall: vi.fn(async (cb: (ev: DownloadEvent) => void) => {
      cb({ event: 'Started', data: { contentLength: 100 } });
      cb({ event: 'Progress', data: { chunkLength: 100 } });
      cb({ event: 'Finished' });
    }),
    close: vi.fn(async () => undefined),
  };
}

describe('UpdaterService', () => {
  let svc: UpdaterService;
  let relaunch: ReturnType<typeof vi.fn>;

  function setup(update: ReturnType<typeof fakeUpdate> | null) {
    svc = TestBed.inject(UpdaterService);
    svc.supported = true;
    relaunch = vi.fn(async () => undefined);
    svc.loadUpdater = (async () => ({ check: vi.fn(async () => update) })) as unknown as UpdaterService['loadUpdater'];
    svc.loadProcess = (async () => ({ relaunch })) as unknown as UpdaterService['loadProcess'];
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    try { localStorage.clear(); } catch { /* depolama yok */ }
  });

  it('web/Android: denetim yapılmaz', async () => {
    svc = TestBed.inject(UpdaterService);
    svc.supported = false;
    expect(await svc.check(false)).toBe('unsupported');
    expect(svc.lastCheckedAt()).toBeNull();
  });

  it('güncelleme yoksa "güncel" döner ve son denetim zamanı kaydedilir', async () => {
    setup(null);
    expect(await svc.check(true)).toBe('up-to-date');
    expect(svc.availableVersion()).toBeNull();
    expect(svc.lastCheckedAt()).not.toBeNull();
    expect(svc.mode()).toBe('hidden');
  });

  it('sepet doluyken yalnız bilgi verilir ve kurulum başlamaz; sepet boşalınca kurulur', async () => {
    const u = fakeUpdate();
    setup(u);
    const cartFull = signal(true);
    svc.registerSaleInProgress(() => cartFull());
    expect(await svc.check(false)).toBe('available');
    expect(svc.mode()).toBe('notice');
    expect(await svc.install()).toBe(false);
    expect(u.downloadAndInstall).not.toHaveBeenCalled();
    expect(relaunch).not.toHaveBeenCalled();

    cartFull.set(false);
    expect(svc.mode()).toBe('prompt');
    expect(await svc.install()).toBe(true);
    expect(u.downloadAndInstall).toHaveBeenCalledOnce();
    expect(svc.progress()).toBe(100);
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('"Sonra" bu sürümü gizler; otomatik denetim gizli tutar, elle denetim yeniden gösterir', async () => {
    setup(fakeUpdate());
    await svc.check(false);
    svc.dismiss();
    expect(svc.mode()).toBe('hidden');
    await svc.check(false);
    expect(svc.mode()).toBe('hidden');
    await svc.check(true);
    expect(svc.mode()).toBe('prompt');
  });

  it('kurulum hatasında uygulama yeniden başlatılmaz, hata gösterilir', async () => {
    const u = fakeUpdate();
    u.downloadAndInstall.mockRejectedValueOnce(new Error('ağ'));
    setup(u);
    await svc.check(false);
    expect(await svc.install()).toBe(false);
    expect(svc.installError()).toBe(true);
    expect(svc.installing()).toBe(false);
    expect(relaunch).not.toHaveBeenCalled();
  });

  it('denetim hatası sessizce "error" döner, bildirim çıkmaz', async () => {
    setup(null);
    svc.loadUpdater = (async () => ({
      check: vi.fn(async () => { throw new Error('404'); }),
    })) as unknown as UpdaterService['loadUpdater'];
    expect(await svc.check(false)).toBe('error');
    expect(svc.mode()).toBe('hidden');
  });
});
