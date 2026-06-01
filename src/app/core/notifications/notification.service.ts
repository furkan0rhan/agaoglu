import { Injectable, inject } from '@angular/core';
import { ProductStore } from '../../features/products/store/product.store';

const STORAGE_KEY = 'lastStockNotification';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly store = inject(ProductStore);

  async checkAndNotify(): Promise<void> {
    if (this.alreadyNotifiedToday()) return;

    const products = this.store.products();
    if (!products.length) return;

    const now = new Date();
    const in7Days = new Date(now); in7Days.setDate(now.getDate() + 7);
    const in30Days = new Date(now); in30Days.setDate(now.getDate() + 30);

    const lowStock = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    const outOfStock = products.filter(p => p.stock === 0);
    const expiring7 = products.filter(p => p.expiryDate && p.expiryDate.toDate() <= in7Days && p.expiryDate.toDate() >= now);
    const expiring30 = products.filter(p => p.expiryDate && p.expiryDate.toDate() <= in30Days && p.expiryDate.toDate() > in7Days);

    const alerts: { title: string; body: string }[] = [];

    if (outOfStock.length > 0) {
      alerts.push({
        title: '⛔ Stok Bitti',
        body: outOfStock.slice(0, 3).map(p => p.name).join(', ') + (outOfStock.length > 3 ? ` ve ${outOfStock.length - 3} ürün daha` : ''),
      });
    }

    if (lowStock.length > 0) {
      alerts.push({
        title: '⚠️ Kritik Stok',
        body: lowStock.slice(0, 3).map(p => `${p.name} (${p.stock} adet)`).join(', ') + (lowStock.length > 3 ? ` ve ${lowStock.length - 3} ürün daha` : ''),
      });
    }

    if (expiring7.length > 0) {
      alerts.push({
        title: '🔴 SKT 7 Günden Az',
        body: expiring7.slice(0, 3).map(p => p.name).join(', ') + (expiring7.length > 3 ? ` ve ${expiring7.length - 3} ürün daha` : ''),
      });
    }

    if (expiring30.length > 0) {
      alerts.push({
        title: '🟡 SKT 30 Gün İçinde',
        body: expiring30.slice(0, 3).map(p => p.name).join(', ') + (expiring30.length > 3 ? ` ve ${expiring30.length - 3} ürün daha` : ''),
      });
    }

    if (!alerts.length) return;

    localStorage.setItem(STORAGE_KEY, new Date().toDateString());

    const isTauri = !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      await this.sendTauriNotifications(alerts);
    } else {
      await this.sendBrowserNotifications(alerts);
    }
  }

  private alreadyNotifiedToday(): boolean {
    return localStorage.getItem(STORAGE_KEY) === new Date().toDateString();
  }

  private async sendTauriNotifications(alerts: { title: string; body: string }[]): Promise<void> {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await import('@tauri-apps/plugin-notification');

      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === 'granted';
      }
      if (!granted) return;

      for (const alert of alerts) {
        sendNotification({ title: alert.title, body: alert.body });
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.warn('Tauri notification hatası:', e);
    }
  }

  private async sendBrowserNotifications(alerts: { title: string; body: string }[]): Promise<void> {
    if (!('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    for (const alert of alerts) {
      new Notification(alert.title, { body: alert.body, icon: '/assets/TarimLogo.png' });
      await new Promise(r => setTimeout(r, 500));
    }
  }
}
