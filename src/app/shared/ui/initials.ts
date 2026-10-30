/**
 * Ad / unvan baş harfleri (Türkçe büyük harf: "ilker işçi" → "İİ").
 * Tek kelime → ilk harf; iki+ kelime → ilk ve son kelimenin ilk harfi.
 * Boşsa `fallback` döner.
 */
export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked.map(w => w.charAt(0)).join('').toLocaleUpperCase('tr');
}
