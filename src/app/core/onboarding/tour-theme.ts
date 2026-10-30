/**
 * driver.js temel CSS'i (MIT, driver.js 1.9 `dist/driver.css` uyarlaması) + Adaçayı & Krem teması.
 * Yalnız tour-runner ile (dinamik) yüklenir. Renkler token değişkenleri: koyu tema `html.dark` ile kendiliğinden.
 * Yazı boyutları rem (Ayarlar > Yazı boyutu çalışsın).
 */
export const TOUR_CSS = `
.driver-active .driver-overlay{pointer-events:none}
.driver-active.driver-no-scroll{overflow:hidden}
.driver-active *{pointer-events:none}
.driver-active .driver-active-element,.driver-active .driver-active-element *,.driver-popover,.driver-popover *{pointer-events:auto}
.driver-active-element-parent-no-scroll{overflow:hidden!important}
.driver-no-interaction,.driver-no-interaction *{pointer-events:none!important}
@keyframes tm-tour-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.driver-fade .driver-overlay{animation:tm-tour-fade .25s ease-out}
@keyframes tm-tour-fade{from{opacity:0}to{opacity:1}}
.driver-fade .driver-popover{animation:tm-tour-in .22s ease-out}
@media (prefers-reduced-motion: reduce){.driver-fade .driver-overlay,.driver-fade .driver-popover{animation:none}}

.driver-popover{all:unset;box-sizing:border-box;position:fixed;top:0;right:0;z-index:1000000000;margin:0;
  min-width:17.5rem;max-width:22.5rem;padding:1rem 1.125rem 0.875rem;
  font-family:var(--font-sans);color:var(--text-primary);background:var(--surface);
  border:1px solid var(--border-strong);border-radius:var(--radius-2xl);box-shadow:var(--shadow-overlay)}
.driver-popover *{box-sizing:border-box}
.driver-popover-title{display:block;margin:0;padding-right:2.25rem;font-family:var(--font-display);
  font-size:1.125rem;font-weight:800;line-height:1.3;color:var(--text-primary)}
.driver-popover-title[style*=block]+.driver-popover-description{margin-top:0.375rem}
.driver-popover-description{margin:0;font-size:0.9375rem;line-height:1.5;color:var(--text-secondary)}
.driver-popover-close-btn{all:unset;box-sizing:border-box;position:absolute;top:0.5rem;right:0.5rem;z-index:1;
  display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:var(--radius-md);cursor:pointer;
  color:var(--text-muted);font-size:0.875rem}
.driver-popover-close-btn:hover{background:var(--surface-muted);color:var(--text-primary)}
.driver-popover-footer{display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-top:1rem}
.driver-popover-progress-text{font-size:0.8125rem;font-weight:600;color:var(--text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.driver-popover-navigation-btns{display:flex;flex-grow:1;justify-content:flex-end;gap:0.5rem}
.driver-popover-footer-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
  min-height:2.75rem;min-width:2.75rem;padding:0 1rem;border-radius:var(--radius-md);cursor:pointer;
  font-family:var(--font-display);font-size:0.9375rem;font-weight:700;line-height:2.75rem;text-align:center;white-space:nowrap;
  background:var(--surface);color:var(--text-primary);border:1px solid var(--border-strong)}
.driver-popover-footer-btn:hover{background:var(--surface-muted)}
.driver-popover-footer-btn.driver-popover-next-btn{background:var(--brand);color:var(--brand-contrast);border-color:transparent}
.driver-popover-footer-btn.driver-popover-next-btn:hover{background:var(--brand-hover)}
.driver-popover-footer .driver-popover-btn-disabled{opacity:.5;pointer-events:none}
.driver-popover-footer-btn:focus-visible,.driver-popover-close-btn:focus-visible{outline:2px solid var(--brand);outline-offset:2px;box-shadow:var(--focus-ring)}

.driver-popover-arrow{content:"";position:absolute;border:7px solid var(--surface)}
.driver-popover-arrow-side-over{display:none}
.driver-popover-arrow-side-left{left:100%;border-top-color:transparent;border-bottom-color:transparent;border-right-color:transparent}
.driver-popover-arrow-side-right{right:100%;border-top-color:transparent;border-bottom-color:transparent;border-left-color:transparent}
.driver-popover-arrow-side-top{top:100%;border-bottom-color:transparent;border-left-color:transparent;border-right-color:transparent}
.driver-popover-arrow-side-bottom{bottom:100%;border-top-color:transparent;border-left-color:transparent;border-right-color:transparent}
.driver-popover-arrow-side-left.driver-popover-arrow-align-start,.driver-popover-arrow-side-right.driver-popover-arrow-align-start{top:15px}
.driver-popover-arrow-side-top.driver-popover-arrow-align-start,.driver-popover-arrow-side-bottom.driver-popover-arrow-align-start{left:15px}
.driver-popover-arrow-align-end.driver-popover-arrow-side-left,.driver-popover-arrow-align-end.driver-popover-arrow-side-right{bottom:15px}
.driver-popover-arrow-side-top.driver-popover-arrow-align-end,.driver-popover-arrow-side-bottom.driver-popover-arrow-align-end{right:15px}
.driver-popover-arrow-side-left.driver-popover-arrow-align-center,.driver-popover-arrow-side-right.driver-popover-arrow-align-center{top:50%;margin-top:-7px}
.driver-popover-arrow-side-top.driver-popover-arrow-align-center,.driver-popover-arrow-side-bottom.driver-popover-arrow-align-center{left:50%;margin-left:-7px}
.driver-popover-arrow-none,.driver-popover-arrow-side-center{display:none}

/* Çiftçi turu: büyük yazı */
.driver-popover.tm-large .driver-popover-title{font-size:1.375rem}
.driver-popover.tm-large .driver-popover-description{font-size:1.125rem!important;line-height:1.55}
.driver-popover.tm-large .driver-popover-footer-btn{font-size:1.0625rem}

/* Telefon: alt sayfa (bottom sheet); öğe alttaysa üst sayfa */
.driver-popover.tm-sheet{left:0.5rem!important;right:0.5rem!important;top:auto!important;bottom:calc(0.5rem + var(--safe-bottom, 0px))!important;
  width:auto!important;min-width:0!important;max-width:none!important;max-height:45vh;overflow-y:auto;padding:1.125rem 1.125rem 1rem}
.driver-popover.tm-sheet.tm-sheet-top{top:calc(0.5rem + var(--safe-top, 0px))!important;bottom:auto!important}
.driver-popover.tm-sheet .driver-popover-arrow{display:none}
.driver-popover.tm-sheet .driver-popover-description{font-size:1rem}
.driver-popover.tm-sheet .driver-popover-footer-btn{min-height:3rem;line-height:3rem;flex:1}
.driver-popover.tm-sheet .driver-popover-navigation-btns{flex-grow:1}
`;
