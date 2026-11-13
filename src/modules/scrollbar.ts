import { reduceMotion } from '../lib/dom';

/* Barre de défilement du site : un curseur fin posé par-dessus la page, sans largeur réservée.
   Elle apparaît quand on fait défiler ou qu'on approche du bord droit, puis s'efface.
   À la souris, on peut la saisir pour faire défiler, ou cliquer sur le rail pour sauter. */

const IDLE = 1100; // ms avant de s'effacer
const MIN_THUMB = 36; // px
const EDGE = 18; // px : zone du bord droit qui fait apparaître la barre

export const initScrollbar = () => {
  const root = document.documentElement;
  root.classList.add('has-scrollbar'); // masque la barre du navigateur (voir le CSS)

  const bar = document.createElement('div');
  bar.className = 'scrollbar';
  bar.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'scrollbar__thumb';
  bar.appendChild(thumb);
  document.body.appendChild(bar);

  let thumbH = 0;
  let range = 0; // course du curseur, en px
  let scrollable = 0; // hauteur de défilement de la page, en px
  let idle = 0;
  let frame = 0;

  const measure = () => {
    const track = bar.clientHeight;
    scrollable = root.scrollHeight - innerHeight;
    bar.classList.toggle('is-off', scrollable <= 1);
    thumbH = Math.max(MIN_THUMB, (track * innerHeight) / root.scrollHeight);
    range = track - thumbH;
    thumb.style.height = `${thumbH}px`;
  };

  const place = () => {
    frame = 0;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
    thumb.style.transform = `translateY(${ratio * range}px)`;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };

  const wake = () => {
    bar.classList.add('is-active');
    clearTimeout(idle);
    idle = window.setTimeout(() => {
      if (!bar.matches(':hover') && !bar.classList.contains('is-dragging')) bar.classList.remove('is-active');
    }, IDLE);
  };

  measure();
  place();
  addEventListener('scroll', () => { schedule(); wake(); }, { passive: true });
  addEventListener('resize', () => { measure(); schedule(); });
  // La hauteur de la page change (dépôts chargés, changement de langue…)
  new ResizeObserver(() => { measure(); schedule(); }).observe(document.body);

  // Souris : la barre apparaît près du bord droit
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const near = e.clientX >= root.clientWidth - EDGE;
    bar.classList.toggle('is-near', near);
    if (near) wake();
  }, { passive: true });
  document.addEventListener('pointerleave', () => bar.classList.remove('is-near'));

  // Saisie du curseur
  let grab = 0; // décalage entre le pointeur et le haut du curseur
  const scrollToPointer = (clientY: number) => {
    const top = bar.getBoundingClientRect().top;
    const ratio = range > 0 ? (clientY - top - grab) / range : 0;
    window.scrollTo({ top: Math.min(1, Math.max(0, ratio)) * scrollable, behavior: 'instant' });
  };
  thumb.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grab = e.clientY - thumb.getBoundingClientRect().top;
    thumb.setPointerCapture(e.pointerId);
    bar.classList.add('is-dragging', 'is-active');
  });
  thumb.addEventListener('pointermove', (e) => {
    if (bar.classList.contains('is-dragging')) scrollToPointer(e.clientY);
  });
  const release = () => { bar.classList.remove('is-dragging'); wake(); };
  thumb.addEventListener('pointerup', release);
  thumb.addEventListener('pointercancel', release);

  // Clic sur le rail : la page saute à cet endroit (curseur centré sous le pointeur)
  bar.addEventListener('pointerdown', (e) => {
    if (e.target !== bar || e.button !== 0) return;
    e.preventDefault();
    grab = thumbH / 2;
    const top = bar.getBoundingClientRect().top;
    const ratio = range > 0 ? (e.clientY - top - grab) / range : 0;
    window.scrollTo({ top: Math.min(1, Math.max(0, ratio)) * scrollable, behavior: reduceMotion ? 'instant' : 'smooth' });
  });
};
