/** Tauri içinde mi (masaüstü veya mobil) */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

/** Tauri mobil (Android/iOS) — yerel barcode-scanner eklentisi yalnız burada kayıtlı */
export function isTauriMobile(): boolean {
  return isTauri() && typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Tarayıcı kamera API'si var mı (güvenli bağlam + getUserMedia) */
export function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** En az bir video girişi var mı. İzin verilmeden önce de cihaz türü listelenir (etiketler boş olabilir). */
export async function hasVideoInput(): Promise<boolean> {
  if (!hasMediaDevices() || !navigator.mediaDevices.enumerateDevices) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

let audioCtx: AudioContext | null = null;

/** Başarı/uyarı geri bildirimi: kısa titreşim + bip (WebAudio; ses dosyası/CSP gerekmez) */
export function scanFeedback(tone: 'success' | 'warn' | 'error' = 'success'): void {
  try {
    navigator.vibrate?.(tone === 'success' ? 60 : [80, 60, 80]);
  } catch { /* titreşim desteklenmiyor */ }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const beep = (freq: number, at: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + dur);
    };
    if (tone === 'success') beep(1760, 0, 0.09);
    else {
      beep(440, 0, 0.12);
      beep(330, 0.16, 0.16);
    }
  } catch { /* ses yok */ }
}
