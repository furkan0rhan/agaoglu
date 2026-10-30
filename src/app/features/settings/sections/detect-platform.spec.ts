import { detectPlatform } from './about-section.component';

const fakeWin = (ua: string, tauri = false) =>
  ({ navigator: { userAgent: ua }, ...(tauri ? { __TAURI_INTERNALS__: {} } : {}) }) as unknown as Window;

describe('detectPlatform', () => {
  it('Android user agent → android (Tauri mobil dahil)', () => {
    expect(detectPlatform(fakeWin('Mozilla/5.0 (Linux; Android 14; SM-A546E) wv', true))).toBe('android');
  });
  it('Tauri masaüstü → desktop', () => {
    expect(detectPlatform(fakeWin('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130', true))).toBe('desktop');
  });
  it('Tarayıcı → web', () => {
    expect(detectPlatform(fakeWin('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'))).toBe('web');
    expect(detectPlatform(undefined)).toBe('web');
  });
});
