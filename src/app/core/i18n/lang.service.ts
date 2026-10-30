import { Injectable, signal, computed, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { TRANSLATIONS, Lang, Translations } from './translations';
import { PRIMENG_LOCALES } from './primeng-locale';

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly KEY = 'lang';
  readonly lang = signal<Lang>(this.loadLang());
  readonly t = computed<Translations>(() => TRANSLATIONS[this.lang()]);
  private readonly primeng = inject(PrimeNG, { optional: true });

  constructor() {
    this.applyPrimeNg(this.lang());
  }

  toggle(): void { this.setLang(this.lang() === 'tr' ? 'en' : 'tr'); }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(this.KEY, lang);
    document.documentElement.lang = lang;
    this.applyPrimeNg(lang);
  }

  /** PrimeNG takvim / boş liste / onay metinlerini aktif dile çevir. */
  private applyPrimeNg(lang: Lang): void {
    this.primeng?.setTranslation(PRIMENG_LOCALES[lang]);
  }

  private loadLang(): Lang {
    const saved = localStorage.getItem(this.KEY) as Lang | null;
    if (saved === 'tr' || saved === 'en') return saved;
    return navigator.language.startsWith('tr') ? 'tr' : 'en';
  }
}
