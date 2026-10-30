import { Injectable, signal } from '@angular/core';

/**
 * Kabuk sayaçları için hafif paylaşım: ek Firestore dinleyicisi açmadan, zaten yüklenen
 * veriyi (ör. dashboard'un gecikmiş alacak özeti) sidebar / bildirim zili ile paylaşır.
 * Bilinmiyorsa null (rozet gösterilmez).
 */
@Injectable({ providedIn: 'root' })
export class ShellStatusService {
  /** Vadesi geçmiş borcu olan müşteri sayısı (dashboard yükleyince dolar). */
  readonly overdueCustomers = signal<number | null>(null);
}
