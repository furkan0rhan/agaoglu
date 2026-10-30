import { bannerMode, canInstallNow, isCheckDue, isTauriDesktop, progressPercent } from './update-policy';

const fakeWin = (ua: string, tauri = false) =>
  ({ navigator: { userAgent: ua }, ...(tauri ? { __TAURI_INTERNALS__: {} } : {}) }) as unknown as Window;

describe('update-policy', () => {
  describe('isTauriDesktop', () => {
    it('Tauri + Windows → true', () => {
      expect(isTauriDesktop(fakeWin('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130', true))).toBe(true);
    });
    it('Tauri Android (APK) → false', () => {
      expect(isTauriDesktop(fakeWin('Mozilla/5.0 (Linux; Android 14) wv', true))).toBe(false);
    });
    it('tarayıcı / SSR → false', () => {
      expect(isTauriDesktop(fakeWin('Mozilla/5.0 (Windows NT 10.0) Chrome/130'))).toBe(false);
      expect(isTauriDesktop(undefined)).toBe(false);
    });
  });

  describe('bannerMode', () => {
    const base = { version: '1.3.0', saleInProgress: false, dismissedVersion: null, installing: false };
    it('güncelleme yoksa gizli', () => {
      expect(bannerMode({ ...base, version: null })).toBe('hidden');
    });
    it('sepet boşsa "Şimdi güncelle / Sonra" sorulur', () => {
      expect(bannerMode(base)).toBe('prompt');
    });
    it('sepet doluyken (satış sürüyor) yalnız bilgi gösterilir, kurulum önerilmez', () => {
      expect(bannerMode({ ...base, saleInProgress: true })).toBe('notice');
    });
    it('"Sonra" denen sürüm tekrar sorulmaz; daha yeni sürüm sorulur', () => {
      expect(bannerMode({ ...base, dismissedVersion: '1.3.0' })).toBe('hidden');
      expect(bannerMode({ ...base, version: '1.3.1', dismissedVersion: '1.3.0' })).toBe('prompt');
    });
    it('kurulum sürerken ilerleme gösterilir', () => {
      expect(bannerMode({ ...base, installing: true, saleInProgress: true })).toBe('progress');
    });
  });

  describe('canInstallNow', () => {
    it('satış sürerken asla kurulmaz', () => {
      expect(canInstallNow('1.3.0', true, false)).toBe(false);
    });
    it('güncelleme yoksa ya da zaten kuruluyorsa kurulmaz', () => {
      expect(canInstallNow(null, false, false)).toBe(false);
      expect(canInstallNow('1.3.0', false, true)).toBe(false);
    });
    it('güncelleme var + sepet boş → kurulabilir', () => {
      expect(canInstallNow('1.3.0', false, false)).toBe(true);
    });
  });

  describe('isCheckDue', () => {
    const H = 3_600_000;
    it('hiç denetlenmediyse zamanı gelmiştir', () => {
      expect(isCheckDue(null, 1000)).toBe(true);
    });
    it('aralık dolmadan denetlenmez, dolunca denetlenir', () => {
      expect(isCheckDue(0, 3 * H, 4 * H)).toBe(false);
      expect(isCheckDue(0, 4 * H, 4 * H)).toBe(true);
    });
  });

  describe('progressPercent', () => {
    it('toplam bilinmiyorsa null (belirsiz çubuk)', () => {
      expect(progressPercent(10, null)).toBeNull();
      expect(progressPercent(10, 0)).toBeNull();
    });
    it('yüzdeyi 0–100 arasında yuvarlar', () => {
      expect(progressPercent(50, 200)).toBe(25);
      expect(progressPercent(300, 200)).toBe(100);
    });
  });
});
