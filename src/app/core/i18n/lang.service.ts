import { Injectable, signal, computed } from '@angular/core';
import { TRANSLATIONS, Lang, Translations } from './translations';

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly KEY = 'lang';
  readonly lang = signal<Lang>(this.loadLang());
  readonly t = computed<Translations>(() => TRANSLATIONS[this.lang()]);

  toggle(): void { this.setLang(this.lang() === 'tr' ? 'en' : 'tr'); }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(this.KEY, lang);
    document.documentElement.lang = lang;
  }

  private loadLang(): Lang {
    const saved = localStorage.getItem(this.KEY) as Lang | null;
    if (saved === 'tr' || saved === 'en') return saved;
    return navigator.language.startsWith('tr') ? 'tr' : 'en';
  }
}
