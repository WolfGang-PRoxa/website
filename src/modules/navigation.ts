import { $, $$, reduceMotion } from '../lib/dom';

// Démarrage lent (on voit la flèche partir), puis arrivée très amortie
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const LAUNCH_DELAY = 140; // ms : la flèche prend son élan avant que la page ne bouge

let stopScroll: (() => void) | null = null;
const scrollToTop = (done: () => void) => {
  stopScroll?.();
  const start = window.scrollY;
  if (start <= 0) { done(); return; }
  // Durée selon la distance : courte pour quelques écrans, plafonnée pour les longues pages
  const duration = Math.min(1400, 650 + start * 0.18);
  let frame = 0;
  let t0 = 0;
  const finish = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    ['wheel', 'touchstart', 'keydown'].forEach((type) => removeEventListener(type, finish));
    stopScroll = null;
    done();
  };
  const step = (now: number) => {
    t0 ||= now;
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo({ top: Math.round(start * (1 - easeInOut(t))), behavior: 'instant' });
    if (t < 1) frame = requestAnimationFrame(step);
    else finish();
  };
  // L'utilisateur reprend la main dès qu'il fait défiler lui-même
  ['wheel', 'touchstart', 'keydown'].forEach((type) => addEventListener(type, finish, { passive: true }));
  const timer = setTimeout(() => { frame = requestAnimationFrame(step); }, LAUNCH_DELAY);
  stopScroll = finish;
};

export const initNavigation = () => {
  // Retour en haut : la flèche s'envole, puis la page remonte en douceur.
  // Le défilement est animé ici (et non par le navigateur) pour maîtriser sa durée et sa courbe.
  $$<HTMLAnchorElement>('a[href="#top"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(history.state, '', location.pathname + location.search);
      if (reduceMotion) { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
      a.classList.remove('is-launching');
      void a.offsetWidth; // relance l'animation de la flèche à chaque clic
      a.classList.add('is-launching');
      scrollToTop(() => a.classList.remove('is-launching'));
    });
  });

  // Fond de la barre au défilement
  const nav = $('.nav');
  const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Lien de la section en cours
  const links = $$<HTMLAnchorElement>('.nav__links a');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => observer.observe(s));

  // Année du pied de page
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
};
