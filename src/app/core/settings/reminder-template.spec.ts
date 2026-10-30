import { DEFAULT_REMINDER_TEMPLATE, renderReminderTemplate } from './reminder-template';
import { parseTenantSettings } from './tenant-settings.model';

describe('renderReminderTemplate', () => {
  it('bilinen değişkenleri doldurur', () => {
    expect(renderReminderTemplate('Sayın {ad}, borcunuz {borc}.', { ad: 'Ali Veli', borc: '1.250,00 TL' }))
      .toBe('Sayın Ali Veli, borcunuz 1.250,00 TL.');
  });

  it('bilinmeyen değişkene dokunmaz, boş değeri siler ve boşlukları sadeleştirir', () => {
    expect(renderReminderTemplate('{ad} {xyz} vade {vade} .', { ad: 'Ali' })).toBe('Ali {xyz} vade.');
  });

  it('varsayılan şablon tüm değişkenlerle dolar', () => {
    const out = renderReminderTemplate(DEFAULT_REMINDER_TEMPLATE, {
      ad: 'Ali', borc: '10 TL', vade: '01.01.2027', isletme: 'Ağaoğlu', telefon: '0555',
    });
    expect(out).not.toContain('{');
  });
});

describe('parseTenantSettings (fiş / veresiye / SKT)', () => {
  it('eksik alanlarda varsayılanlar', () => {
    const s = parseTenantSettings(undefined);
    expect(s.receipt.paperWidth).toBe(80);
    expect(s.receipt.showGts).toBe(true);
    expect(s.credit.defaultDueDays).toBe(30);
    expect(s.credit.defaultCreditLimit).toBeNull();
    expect(s.expiryWarnDays).toBe(30);
    expect(s.expiryCriticalDays).toBe(7);
  });

  it('geçersiz değerleri reddeder', () => {
    const s = parseTenantSettings({
      expiryWarnDays: 10, expiryCriticalDays: 40,
      receipt: { paperWidth: 57, logo: 'javascript:alert(1)', showGts: 'yes' },
      credit: { defaultDueDays: -3, defaultCreditLimit: 0 },
    });
    expect(s.expiryCriticalDays).toBe(10); // uyarı eşiğini aşamaz
    expect(s.receipt.paperWidth).toBe(80);
    expect(s.receipt.logo).toBe('');
    expect(s.receipt.showGts).toBe(true);
    expect(s.credit.defaultDueDays).toBe(30);
    expect(s.credit.defaultCreditLimit).toBeNull();
  });

  it('geçerli değerleri korur', () => {
    const s = parseTenantSettings({
      receipt: { paperWidth: 58, headerNote: 'Bayi', showLicenseNo: false, logo: 'data:image/png;base64,AAA' },
      credit: { defaultDueDays: 60, defaultCreditLimit: 25000, reminderTemplate: 'Sayın {ad}' },
    });
    expect(s.receipt.paperWidth).toBe(58);
    expect(s.receipt.showLicenseNo).toBe(false);
    expect(s.receipt.logo).toContain('data:image/png');
    expect(s.credit.defaultCreditLimit).toBe(25000);
    expect(s.credit.reminderTemplate).toBe('Sayın {ad}');
  });
});
