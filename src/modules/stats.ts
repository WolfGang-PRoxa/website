import { $$, reduceMotion } from '../lib/dom';

/* Chiffres du hero : « années de code » se calcule depuis l'année de départ (data-since),
   pour rester juste sans mise à jour du site, et compte jusqu'à sa valeur au chargement. */

const animateCount = (el: HTMLElement, target: number) => {
  if (reduceMotion) { el.textContent = String(target); return; }
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min((now - start) / 1200, 1);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export const initStats = () => {
  $$('[data-count]').forEach((el) => {
    const since = Number(el.dataset.since);
    const value = since ? new Date().getFullYear() - since : Number(el.dataset.value);
    if (Number.isFinite(value)) animateCount(el, value);
  });
};
