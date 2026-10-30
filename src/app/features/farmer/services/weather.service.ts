import { Injectable } from '@angular/core';

/**
 * Hava tahmini: MET Norway Locationforecast 2.0 (compact). Veri CC BY 4.0 — atıf arayüzde zorunlu.
 * Kullanım koşulları: kimliklendirici User-Agent; tarayıcı User-Agent başlığını değiştirmeye izin vermez,
 * bu yüzden tarayıcıdan Origin/Referer ile istek yapılır (MET'in tarayıcı istemcileri için kabul ettiği yol).
 * Koordinat 2 haneye yuvarlanır (önbellek + mahremiyet), yanıt 1 saat (ve en fazla `Expires`) istemcide saklanır.
 * Firestore'a YAZILMAZ. Tauri'de CSP `connect-src` içinde api.met.no yoksa istek reddedilir → kart gizlenir.
 */

export interface WeatherHour {
  time: Date;
  tempC: number | null;
  windKmh: number | null;
  rainMm: number | null;
}

export type SprayLevel = 'ok' | 'caution' | 'bad';

export interface SprayHint { level: SprayLevel; key: 'windHigh' | 'windMid' | 'calm' | 'rainSoon' | 'hot'; value: number }

/** Varsayılan eşikler (docs/CIFTCI-MODULU.md §7.4). Etiket her zaman önceliklidir. */
export const SPRAY_THRESHOLDS = { windOk: 10, windBad: 15, calm: 2, rainMm: 0.5, hotC: 28 } as const;

const CACHE_PREFIX = 'tm.farmer.wx.';
const CACHE_MS = 60 * 60 * 1000;

interface CacheEntry { at: number; expires: number; hours: { t: string; c: number | null; w: number | null; r: number | null }[] }

@Injectable({ providedIn: 'root' })
export class WeatherService {
  async forecast(lat: number, lng: number): Promise<WeatherHour[]> {
    const la = Math.round(lat * 100) / 100;
    const lo = Math.round(lng * 100) / 100;
    const key = `${CACHE_PREFIX}${la},${lo}`;
    const cached = this.read(key);
    if (cached) return cached;
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('weather-' + res.status);
    const body = (await res.json()) as MetResponse;
    const hours = parseMet(body).slice(0, 24);
    const expHeader = Date.parse(res.headers.get('Expires') ?? '');
    const expires = Number.isFinite(expHeader) ? Math.max(expHeader, Date.now() + 10 * 60 * 1000) : Date.now() + CACHE_MS;
    try {
      const entry: CacheEntry = {
        at: Date.now(), expires,
        hours: hours.map(h => ({ t: h.time.toISOString(), c: h.tempC, w: h.windKmh, r: h.rainMm })),
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch { /* depolama yoksa önbelleksiz devam */ }
    return hours;
  }

  private read(key: string): WeatherHour[] | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const e = JSON.parse(raw) as CacheEntry;
      if (Date.now() - e.at > CACHE_MS && Date.now() > e.expires) return null;
      return e.hours.map(h => ({ time: new Date(h.t), tempC: h.c, windKmh: h.w, rainMm: h.r })).filter(h => h.time.getTime() > Date.now() - 3600_000);
    } catch {
      return null;
    }
  }
}

interface MetResponse {
  properties?: { timeseries?: {
    time: string;
    data?: {
      instant?: { details?: { air_temperature?: number; wind_speed?: number } };
      next_1_hours?: { details?: { precipitation_amount?: number } };
    };
  }[] };
}

export function parseMet(body: MetResponse): WeatherHour[] {
  return (body.properties?.timeseries ?? []).map(ts => {
    const d = ts.data?.instant?.details;
    const ws = d?.wind_speed;
    return {
      time: new Date(ts.time),
      tempC: typeof d?.air_temperature === 'number' ? d.air_temperature : null,
      windKmh: typeof ws === 'number' ? Math.round(ws * 3.6) : null,
      rainMm: ts.data?.next_1_hours?.details?.precipitation_amount ?? null,
    };
  });
}

/** Saatlik seviye (şerit rengi). Bilgi amaçlı; "uygun" demez, karar çiftçidedir. */
export function sprayLevel(h: WeatherHour): SprayLevel {
  const w = h.windKmh ?? 0;
  if (w > SPRAY_THRESHOLDS.windBad || (h.rainMm ?? 0) > SPRAY_THRESHOLDS.rainMm) return 'bad';
  if (w > SPRAY_THRESHOLDS.windOk || w < SPRAY_THRESHOLDS.calm || (h.tempC ?? 0) > SPRAY_THRESHOLDS.hotC) return 'caution';
  return 'ok';
}

/** Şimdiki saat + önümüzdeki 6 saat için dikkat notları. */
export function sprayHints(hours: readonly WeatherHour[]): SprayHint[] {
  const now = hours[0];
  if (!now) return [];
  const hints: SprayHint[] = [];
  const w = now.windKmh ?? 0;
  if (w > SPRAY_THRESHOLDS.windBad) hints.push({ level: 'bad', key: 'windHigh', value: w });
  else if (w > SPRAY_THRESHOLDS.windOk) hints.push({ level: 'caution', key: 'windMid', value: w });
  else if (w < SPRAY_THRESHOLDS.calm) hints.push({ level: 'caution', key: 'calm', value: w });
  const rain6 = hours.slice(0, 6).reduce((s, h) => s + (h.rainMm ?? 0), 0);
  if (rain6 > SPRAY_THRESHOLDS.rainMm) hints.push({ level: 'caution', key: 'rainSoon', value: Math.round(rain6 * 10) / 10 });
  if ((now.tempC ?? 0) > SPRAY_THRESHOLDS.hotC) hints.push({ level: 'caution', key: 'hot', value: Math.round(now.tempC ?? 0) });
  return hints;
}
