/**
 * Tur motoru — YALNIZ dinamik import ile yüklenir (`import('./tour-runner')`): driver.js (MIT) ve tema CSS'i
 * ana bundle'a girmez. driver.js: SVG kesitli karartma, kaydırma, yeniden boyutlanma, Tab odak tuzağı,
 * ok tuşları / Esc, role="dialog" + aria-labelledby/-describedby. Üstüne: aria-modal, odak "İleri"de,
 * Adaçayı & Krem tokenlarıyla tema, telefonda alt sayfa (bottom sheet) — öğe alttaysa sayfa üste geçer.
 */
import { driver, type DriveStep } from 'driver.js';
import { TOUR_CSS } from './tour-theme';

export interface RunnerStep {
  element?: Element;
  title: string;
  body: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export interface RunnerLabels {
  next: string;
  prev: string;
  done: string;
  close: string;
  progress: string;
}

export interface RunnerHandle {
  /** Tur kapanınca çözülür: `done` = son adımda "Bitti", `closed` = Esc / kapat / sayfadan ayrılma. */
  finished: Promise<'done' | 'closed'>;
  destroy(): void;
}

const STYLE_ID = 'tm-tour-style';
const SHEET_MAX = 640;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = TOUR_CSS;
  doc.head.appendChild(el);
}

export function runTour(steps: RunnerStep[], labels: RunnerLabels, opts: { dark: boolean; large?: boolean }): RunnerHandle {
  ensureStyle(document);
  let reachedEnd = false;
  let resolve!: (v: 'done' | 'closed') => void;
  const finished = new Promise<'done' | 'closed'>(r => (resolve = r));
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lastFocus = document.activeElement as HTMLElement | null;

  const driveSteps: DriveStep[] = steps.map((s, i) => ({
    element: s.element,
    popover: {
      title: s.title,
      description: s.body,
      side: s.side,
      align: s.align ?? 'start',
      showButtons: i === 0 ? ['next', 'close'] : ['next', 'previous', 'close'],
    },
  }));

  const d = driver({
    steps: driveSteps,
    animate: !reduceMotion,
    smoothScroll: !reduceMotion,
    allowClose: true,
    allowKeyboardControl: true,
    overlayClickBehavior: 'none',
    disableActiveInteraction: true,
    overlayColor: opts.dark ? '#000000' : '#1f2a1a',
    overlayOpacity: opts.dark ? 0.66 : 0.58,
    stagePadding: 6,
    stageRadius: 10,
    popoverOffset: 12,
    showProgress: steps.length > 1,
    progressText: labels.progress,
    nextBtnText: labels.next,
    prevBtnText: labels.prev,
    doneBtnText: labels.done,
    closeBtnLabel: labels.close,
    popoverClass: opts.large ? 'tm-tour tm-large' : 'tm-tour',
    // driver.js yalnız pencereye göre kaydırır; kaydırılabilir iç kutudaki öğe (sidebar menüsü) kesik kalmasın
    onHighlightStarted: el => {
      if (el && el.id !== 'driver-dummy-element') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    onPopoverRender: (pop, { state }) => {
      pop.wrapper.setAttribute('aria-modal', 'true');
      pop.closeButton.setAttribute('aria-label', labels.close);
      pop.closeButton.setAttribute('title', labels.close);
      pop.closeButton.innerHTML = '<i class="pi pi-times" aria-hidden="true"></i>';
      // Telefonda alt sayfa; vurgulanan öğe ekranın alt yarısındaysa üste al (alt çubuk kapanmasın)
      const el = state.activeElement as Element | undefined;
      const sheet = window.innerWidth < SHEET_MAX;
      pop.wrapper.classList.toggle('tm-sheet', sheet);
      let top = false;
      if (sheet && el && el.id !== 'driver-dummy-element') {
        const r = el.getBoundingClientRect();
        top = r.top + r.height / 2 > window.innerHeight * 0.55;
      }
      pop.wrapper.classList.toggle('tm-sheet-top', top);
      // Son adımı gören kullanıcı turu "tamamladı" sayılır (Bitti ya da Esc fark etmez)
      if (d.isLastStep()) reachedEnd = true;
      setTimeout(() => pop.nextButton.focus({ preventScroll: true }), 0);
    },
    onDestroyed: () => {
      resolve(reachedEnd ? 'done' : 'closed');
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    },
  });

  d.drive();
  return { finished, destroy: () => { if (d.isActive()) d.destroy(); } };
}
