import { $$, reduceMotion } from '../lib/dom';

/* Apparition liée au défilement.
   La progression de chaque élément dépend de sa position dans la fenêtre : elle avance
   quand on descend et se rejoue à l'envers quand on remonte. Un lissage image par image
   garde le mouvement fluide, même à la molette. */

interface Item {
  el: HTMLElement;
  p: number; // progression affichée (0 → 1)
  y: number; // décalage vertical appliqué (px)
  i: number; // rang dans une rangée (décalage en cascade)
  snap: boolean; // prendre directement la position cible
  start: number; // début de l'animation d'entrée
}

const SHIFT = 32; // px
const items: Item[] = [];
let frame = 0;
let lastTime = performance.now();

const request = () => { if (!frame) frame = requestAnimationFrame(update); };

function update(now: number) {
  frame = 0;
  const dt = Math.max(0, Math.min(now - lastTime, 64));
  lastTime = now;
  const vh = innerHeight;
  const k = 1 - Math.pow(1 - 0.14, dt / 16.7); // lissage indépendant de la fréquence d'affichage
  const wide = innerWidth > 900;

  // 1) lectures
  const targets = items.map((it) => {
    if (!it.el.isConnected) return null;
    const rect = it.el.getBoundingClientRect();
    if (!rect.width && !rect.height) return null; // élément masqué (filtre)
    const top = rect.top - it.y; // position sans le décalage de l'animation
    if (top + scrollY < vh * 0.92) return 1; // haut de page : visible dès l'arrivée
    const offset = wide ? it.i * vh * 0.035 : 0; // cascade entre éléments d'une même rangée
    return Math.min(1, Math.max(0, (vh - top - offset) / (vh * 0.28)));
  });

  // 2) écritures
  let moving = false;
  items.forEach((it, idx) => {
    const target = targets[idx];
    if (target == null) return;
    if (now < it.start) { moving = true; return; }
    let p = it.snap ? target : it.p + (target - it.p) * k;
    it.snap = false;
    if (Math.abs(target - p) < 0.002) p = target;
    else moving = true;
    if (p === it.p && it.el.style.opacity !== '') return;
    it.p = p;
    const eased = 1 - Math.pow(1 - p, 3);
    it.y = (1 - eased) * SHIFT;
    it.el.style.opacity = p.toFixed(3);
    it.el.style.translate = p >= 1 ? 'none' : `0 ${it.y.toFixed(2)}px`;
    it.el.style.filter = p >= 0.98 ? 'none' : `blur(${((1 - p) * 6).toFixed(2)}px)`;
  });

  for (let n = items.length - 1; n >= 0; n--) if (!items[n].el.isConnected) items.splice(n, 1);
  if (moving) request();
}

/** Ajoute un élément à animer. `snap` : pas d'animation d'entrée (ex. contenu remplacé). */
export const addReveal = (el: HTMLElement, delay = 0, snap = false) => {
  if (reduceMotion) { el.classList.add('is-static'); return; }
  const i = Math.min(parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0, 3);
  items.push({ el, p: 0, y: SHIFT, i, snap, start: performance.now() + delay });
  request();
};

export const initReveal = () => {
  // Premier affichage : les éléments déjà visibles entrent en cascade
  $$('.reveal').forEach((el) => addReveal(el, (parseFloat(el.style.getPropertyValue('--i')) || 0) * 90));
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
};
