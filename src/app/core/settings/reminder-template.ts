/**
 * Veresiye hatırlatma mesajı şablonu (`settings.credit.reminderTemplate`).
 * Boş şablon = müşteri modülünün yerleşik metni (`buildReminderText`, credit.utils.ts).
 *
 * Değişkenler: {ad} müşteri adı · {borc} güncel bakiye · {gecikmis} vadesi geçmiş tutar ·
 * {vade} sıradaki/en eski vade (GG.AA.YYYY) · {isletme} işletme adı · {telefon} işletme telefonu.
 */
export const REMINDER_VARIABLES = ['ad', 'borc', 'gecikmis', 'vade', 'isletme', 'telefon'] as const;
export type ReminderVariable = (typeof REMINDER_VARIABLES)[number];
export type ReminderValues = Partial<Record<ReminderVariable, string>>;

/** Varsayılan (önerilen) şablon — ayarlarda "Örnek şablonu kullan" ile doldurulur. */
export const DEFAULT_REMINDER_TEMPLATE =
  'Sayın {ad}, {isletme} nezdindeki güncel borç bakiyeniz {borc}. Sıradaki vade: {vade}. Ödemenizi bekler, iyi çalışmalar dileriz. Tel: {telefon}';

/**
 * Şablondaki `{degisken}` yerlerini doldurur. Bilinmeyen değişkenler olduğu gibi kalır; değeri boş olanlar
 * silinir ve kalan çift boşluklar/boş " Tel: " gibi artıklar sadeleştirilir.
 */
export function renderReminderTemplate(template: string, values: ReminderValues): string {
  return template
    .replace(/\{([a-z_]+)\}/g, (m, key: string) =>
      (REMINDER_VARIABLES as readonly string[]).includes(key) ? (values[key as ReminderVariable] ?? '').trim() : m)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim();
}
