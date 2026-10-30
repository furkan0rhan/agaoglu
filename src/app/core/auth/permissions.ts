import { computed, inject, Signal } from '@angular/core';
import { UserRole } from '../../shared/models/user.model';
import { AuthService } from './services/auth.service';

/**
 * Rol bazlı yetkiler (Y5). Tek kaynak: arayüz (gizleme), rota guard'ları ve Firestore kuralları
 * (firestore.rules → products / purchases / suppliers / expenses / sales iptali) aynı tabloyu izler.
 *
 * | Yetki            | admin | cashier | staff |
 * |------------------|:-----:|:-------:|:-----:|
 * | seeCosts         |  ✓    |         |       |  alış fiyatı, kâr, stok değeri, aylık ciro / trend
 * | manageProducts   |  ✓    |         |       |  ürün ekle, fiyat / bilgi değiştir, stok girişi
 * | exportData       |  ✓    |         |       |  reçete kayıtları (Excel), müşteri verisi dışa aktarma
 * | cancelAnySale    |  ✓    |         |       |  her satışı iptal (kasiyer: yalnız kendi + bugünkü, bkz. cancel-policy)
 *
 * Destek modundaki superadmin işletmede admin yetkisiyle çalışır.
 */
export interface Permissions {
  seeCosts: boolean;
  manageProducts: boolean;
  exportData: boolean;
  cancelAnySale: boolean;
}

const NONE: Permissions = { seeCosts: false, manageProducts: false, exportData: false, cancelAnySale: false };
const ALL: Permissions = { seeCosts: true, manageProducts: true, exportData: true, cancelAnySale: true };

export function permissionsFor(role: UserRole | null | undefined): Permissions {
  return role === 'admin' ? ALL : NONE;
}

/** Bileşenlerde: `readonly can = injectPermissions();` → `can().seeCosts` */
export function injectPermissions(): Signal<Permissions> {
  const auth = inject(AuthService);
  return computed(() => permissionsFor(auth.currentUser()?.role));
}
