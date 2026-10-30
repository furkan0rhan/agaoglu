/** Ürün (bitki) kodları → TR/EN ad + ikon. Kod Firestore'a yazılır, ad dile göre gösterilir. */
export interface CropDef { code: string; tr: string; en: string; icon: string }

export const CROPS: readonly CropDef[] = [
  { code: 'wheat', tr: 'Buğday', en: 'Wheat', icon: '🌾' },
  { code: 'barley', tr: 'Arpa', en: 'Barley', icon: '🌾' },
  { code: 'maize', tr: 'Mısır', en: 'Maize', icon: '🌽' },
  { code: 'sunflower', tr: 'Ayçiçeği', en: 'Sunflower', icon: '🌻' },
  { code: 'cotton', tr: 'Pamuk', en: 'Cotton', icon: '☁️' },
  { code: 'sugarbeet', tr: 'Şeker pancarı', en: 'Sugar beet', icon: '🟣' },
  { code: 'potato', tr: 'Patates', en: 'Potato', icon: '🥔' },
  { code: 'tomato', tr: 'Domates', en: 'Tomato', icon: '🍅' },
  { code: 'pepper', tr: 'Biber', en: 'Pepper', icon: '🌶️' },
  { code: 'cucumber', tr: 'Salatalık', en: 'Cucumber', icon: '🥒' },
  { code: 'watermelon', tr: 'Karpuz', en: 'Watermelon', icon: '🍉' },
  { code: 'onion', tr: 'Soğan', en: 'Onion', icon: '🧅' },
  { code: 'chickpea', tr: 'Nohut', en: 'Chickpea', icon: '🫘' },
  { code: 'lentil', tr: 'Mercimek', en: 'Lentil', icon: '🫘' },
  { code: 'grape', tr: 'Üzüm (bağ)', en: 'Grape', icon: '🍇' },
  { code: 'apple', tr: 'Elma', en: 'Apple', icon: '🍎' },
  { code: 'cherry', tr: 'Kiraz', en: 'Cherry', icon: '🍒' },
  { code: 'olive', tr: 'Zeytin', en: 'Olive', icon: '🫒' },
  { code: 'hazelnut', tr: 'Fındık', en: 'Hazelnut', icon: '🌰' },
  { code: 'citrus', tr: 'Narenciye', en: 'Citrus', icon: '🍊' },
  { code: 'other', tr: 'Diğer', en: 'Other', icon: '🌱' },
];

export function cropDef(code: string | null | undefined): CropDef {
  return CROPS.find(c => c.code === code) ?? CROPS[CROPS.length - 1];
}

export function cropName(code: string | null | undefined, lang: 'tr' | 'en'): string {
  return cropDef(code)[lang];
}
