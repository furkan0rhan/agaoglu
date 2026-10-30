import { fillLegalTemplate, renderLegalMarkdown } from './legal-text';

describe('aydınlatma metni', () => {
  it('şablon değişkenlerini doldurur, yorumları siler, boş değere tire koyar', () => {
    const out = fillLegalTemplate('<!-- not -->Ad: {{ISLETME_ADI}} / {{ISLETME_ADRES}}', { ISLETME_ADI: 'Yeşil Tarım' });
    expect(out).toBe('Ad: Yeşil Tarım / —');
  });
  it('markdown → HTML, HTML kaçışlanır', () => {
    const html = renderLegalMarkdown('# Başlık\n\nMetin **kalın** <script>x</script>\n\n- a\n- b\n\n1. bir');
    expect(html).toContain('<h2>Başlık</h2>');
    expect(html).toContain('<strong>kalın</strong>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>bir</li>\n</ol>');
  });
});
