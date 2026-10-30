import { initialsOf } from './initials';


describe('initialsOf', () => {
  it('Türkçe büyük harf kullanır', () => {
    expect(initialsOf('ilker işçi')).toBe('İİ');
  });
  it('ilk ve son kelimenin baş harfini alır', () => {
    expect(initialsOf('  Mehmet Ali  Yılmaz ')).toBe('MY');
  });
  it('tek kelime ve boş değer', () => {
    expect(initialsOf('ayşe')).toBe('A');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null, 'U')).toBe('U');
  });
});
