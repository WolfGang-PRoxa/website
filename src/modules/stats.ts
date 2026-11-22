import { $, $$, reduceMotion } from '../lib/dom';
import { i18n } from '../lib/i18n';
import { repoSplit, repoTotal, type RepoCounts } from '../lib/repo-counts';

/* Chiffres du hero : « années de code » se calcule depuis l'année de départ (data-since),
   pour rester juste sans mise à jour du site, et compte jusqu'à sa valeur au chargement.
   Le nombre de dépôts vient du build, puis de /api/profile (à jour à l'heure près). */

const running = new WeakMap<HTMLElement, number>();

const animateCount = (el: HTMLElement, target: number, from = 0) => {
  if (reduceMotion || from === target) {
    el.textContent = String(target);
    return;
  }
  const id = (running.get(el) ?? 0) + 1;
  running.set(el, id);
  const start = performance.now();
  const tick = (now: number) => {
    if (running.get(el) !== id) return; // une animation plus récente a pris la main
    const p = Math.min((now - start) / 1200, 1);
    el.textContent = String(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const initRepoCounts = async () => {
  const total = $('[data-repo-total]');
  const split = $('[data-repo-split]');
  if (!total || !split) return;

  let counts: RepoCounts | null = null;
  const show = () => {
    split.textContent = repoSplit(counts, i18n.t);
  };
  i18n.onChange(() => {
    if (counts) show();
  });

  for (const url of ['/api/profile', '/data/profile.json']) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      counts = ((await res.json()) as { repos: RepoCounts | null }).repos;
      if (counts) break;
    } catch {
      /* source suivante */
    }
  }
  if (!counts) return; // on garde les chiffres écrits au build
  const target = Number(repoTotal(counts));
  const current = Number(total.textContent);
  if (target !== current) animateCount(total, target, Number.isFinite(current) ? current : 0);
  show();
};

export const initStats = () => {
  $$('[data-count]').forEach((el) => {
    const since = Number(el.dataset.since);
    const value = since ? new Date().getFullYear() - since : Number(el.dataset.value);
    if (Number.isFinite(value)) animateCount(el, value);
  });
  initRepoCounts();
};
