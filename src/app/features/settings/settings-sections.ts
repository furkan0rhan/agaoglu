import type { UserRole } from '../../shared/models/user.model';

/** Ayarlar merkezindeki bölümler (URL: /settings/<key>, hesap sayfası: /account?s=<key>). */
export type SettingsSectionKey =
  | 'business' | 'receipt' | 'sales' | 'credit' | 'team'
  | 'appearance' | 'language' | 'backup'
  | 'license' | 'support' | 'profile' | 'security' | 'about';

export type SettingsGroup = 'business' | 'app' | 'account';

export interface SettingsSectionDef {
  key: SettingsSectionKey;
  group: SettingsGroup;
  icon: string;
  /** Yalnız bu roller görür (boş = herkes). */
  roles: UserRole[];
}

const ADMIN: UserRole[] = ['admin'];

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
  { key: 'business', group: 'business', icon: 'pi-building', roles: ADMIN },
  { key: 'receipt', group: 'business', icon: 'pi-print', roles: ADMIN },
  { key: 'sales', group: 'business', icon: 'pi-shopping-cart', roles: ADMIN },
  { key: 'credit', group: 'business', icon: 'pi-book', roles: ADMIN },
  { key: 'team', group: 'business', icon: 'pi-users', roles: ADMIN },
  { key: 'appearance', group: 'app', icon: 'pi-palette', roles: [] },
  { key: 'language', group: 'app', icon: 'pi-globe', roles: [] },
  { key: 'backup', group: 'app', icon: 'pi-cloud-download', roles: ADMIN },
  { key: 'profile', group: 'account', icon: 'pi-user', roles: [] },
  { key: 'license', group: 'account', icon: 'pi-crown', roles: ADMIN },
  { key: 'support', group: 'account', icon: 'pi-headphones', roles: ADMIN },
  { key: 'security', group: 'account', icon: 'pi-lock', roles: [] },
  { key: 'about', group: 'account', icon: 'pi-info-circle', roles: [] },
];

/** Rolün görebildiği bölümler (sıra korunur). */
export function sectionsForRole(role: UserRole | null | undefined): SettingsSectionDef[] {
  return SETTINGS_SECTIONS.filter(s => s.roles.length === 0 || (!!role && s.roles.includes(role)));
}

/**
 * URL'deki anahtarı doğrular; görülemeyen / bilinmeyen anahtar → `fallback` (görülebiliyorsa) ya da rolün ilk bölümü.
 */
export function resolveSection(
  key: string | null | undefined, role: UserRole | null | undefined, fallback?: SettingsSectionKey,
): SettingsSectionKey {
  const list = sectionsForRole(role);
  return list.find(s => s.key === key)?.key
    ?? list.find(s => s.key === fallback)?.key
    ?? list[0]?.key
    ?? 'profile';
}
