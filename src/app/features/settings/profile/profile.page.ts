/**
 * `/account` (tüm roller) — Ayarlar merkezinin kişisel bölümleri (Profil, Görünüm, Dil, Güvenlik, Hakkında).
 * app.routes.ts bu dosyadan `ProfilePage` yükler; sayfa `SettingsCenterPage`'dir.
 */
export { SettingsCenterPage as ProfilePage } from '../settings-center.page';
export { detectPlatform } from '../sections/about-section.component';
export type { AppPlatform } from '../sections/about-section.component';
