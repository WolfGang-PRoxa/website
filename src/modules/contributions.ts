import { $, reduceMotion } from '../lib/dom';
import { i18n } from '../lib/i18n';

/* Calendrier des contributions GitHub, à droite des statistiques du hero.
   Les données viennent de /api/contributions (functions/api/contributions.ts) ;
   on affiche autant de semaines récentes que la largeur le permet. */

interface Day {
  date: string;
  count: number;
  level: number;
}

interface Data {
  total: number;
  days: Day[];
}

// Taille d'une case et écart de base, lus dans le CSS (en rem : ils grandissent sur grand écran)
const metrics = (grid: HTMLElement) => {
  grid.style.removeProperty('--cell');
  grid.style.removeProperty('gap');
  const cs = getComputedStyle(grid);
  return {
    cell: parseFloat(cs.gridAutoColumns) || 10,
    gap: parseFloat(cs.columnGap) || 3,
  };
};
const MAX_GROW = 2.4; // agrandissement maximal des cases quand toute l'année tient dans la largeur

const fill = (template: string, n: number) => template.replace('{n}', n.toLocaleString(i18n.locale));

const countLabel = (n: number) => {
  const t = i18n.t.contrib;
  if (!n) return t?.none ?? 'No contributions';
  return fill(n === 1 ? t?.one ?? '{n} contribution' : t?.other ?? '{n} contributions', n);
};

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));

export const initContributions = async () => {
  const stat = $('.stat--activity');
  const grid = $('#contrib');
  const totalEl = $('#contrib-total');
  if (!stat || !grid || !totalEl) return;

  let data: Data;
  try {
    const res = await fetch('/api/contributions');
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as Data;
    if (!data.days?.length) throw new Error('vide');
  } catch {
    return; // pas de calendrier : la colonne reste masquée
  }

  // Position de chaque jour : colonne = semaine, ligne = jour (dimanche en haut, comme sur GitHub)
  const offset = new Date(`${data.days[0].date}T00:00:00Z`).getUTCDay();
  const weeksTotal = Math.ceil((data.days.length + offset) / 7);

  const tip = document.createElement('div');
  tip.className = 'contrib__tip';
  tip.setAttribute('aria-hidden', 'true');
  stat.appendChild(tip);

  let shown = 0;
  let first = true;

  const render = () => {
    const width = grid.clientWidth;
    const { cell, gap } = metrics(grid);
    const weeks = Math.max(8, Math.min(weeksTotal, Math.floor((width + gap) / (cell + gap))));
    // Sur grand écran, toute l'année tient avec de la place en trop : les cases grandissent
    // (en pixels entiers, pour rester alignées) jusqu'à occuper toute la largeur.
    if (weeks === weeksTotal) {
      const grow = Math.min(MAX_GROW, (width + gap) / (weeks * (cell + gap)));
      if (grow > 1) {
        let c = Math.round(cell * grow);
        const g = Math.max(gap, Math.round(gap * grow));
        while (c > cell && weeks * (c + g) - g > width) c--;
        grid.style.setProperty('--cell', `${c}px`);
        grid.style.gap = `${g}px`;
      }
    }
    if (weeks === shown) return;
    shown = weeks;
    const firstWeek = weeksTotal - weeks;
    const cells: string[] = [];
    data.days.forEach((day, idx) => {
      const pos = idx + offset;
      const col = Math.floor(pos / 7) - firstWeek;
      if (col < 0) return;
      const row = pos % 7;
      const x = weeks > 1 ? Math.round((col / (weeks - 1)) * 100) : 0;
      cells.push(`<i data-l="${day.level}" data-i="${idx}" style="grid-area:${row + 1}/${col + 1};--x:${x}%;--col:${col};--row:${row}"></i>`);
    });
    grid.innerHTML = cells.join('');
    if (first && !reduceMotion) {
      grid.classList.add('is-entering');
      setTimeout(() => grid.classList.remove('is-entering'), 900 + weeks * 14);
    }
    first = false;
  };

  const renderText = () => {
    const total = fill(i18n.t.contrib?.total ?? '{n} contributions in the last year', data.total);
    totalEl.textContent = total;
    grid.setAttribute('aria-label', total);
  };

  stat.hidden = false;
  renderText();
  render();
  new ResizeObserver(render).observe(grid);
  i18n.onChange(renderText);

  // Infobulle : nombre de contributions et date de la case survolée
  const showTip = (cell: HTMLElement) => {
    const day = data.days[Number(cell.dataset.i)];
    if (!day) return;
    tip.textContent = `${countLabel(day.count)} · ${dateLabel(day.date)}`;
    const box = stat.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    // Centrée sur la case, sans dépasser de la fenêtre
    const half = tip.offsetWidth / 2;
    const center = r.left + r.width / 2;
    const clamped = Math.min(Math.max(center, half + 8), document.documentElement.clientWidth - half - 8);
    tip.style.left = `${clamped - box.left}px`;
    tip.style.top = `${r.top - box.top}px`;
    tip.classList.add('is-visible');
  };
  // Souris : l'infobulle suit le survol.
  // Tactile : un toucher épingle l'infobulle sur la case jusqu'à la prochaine action
  // (défilement, glissement, toucher ailleurs…).
  let pinned: HTMLElement | null = null;
  const hideTip = () => {
    tip.classList.remove('is-visible');
    pinned?.classList.remove('is-pinned');
    pinned = null;
  };
  const cellAt = (e: Event) => (e.target as Element).closest<HTMLElement>('i[data-i]');

  grid.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const cell = cellAt(e);
    if (cell) showTip(cell);
  });
  grid.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTip(); });

  // Un « toucher » = appui puis relâchement presque au même endroit (pas un glissement).
  // On n'utilise pas « click » : Safari sur iPhone ne l'envoie pas sur ces cases.
  let down: { x: number; y: number } | null = null;
  let pinnedScroll = 0;
  let width = innerWidth;
  grid.addEventListener('pointerdown', (e) => {
    down = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  });
  grid.addEventListener('pointercancel', () => { down = null; });
  grid.addEventListener('pointerup', (e) => {
    if (!down || e.pointerType === 'mouse') return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10;
    down = null;
    const cell = cellAt(e);
    if (moved || !cell) return;
    if (cell === pinned) { hideTip(); return; } // second toucher sur la même case : on ferme
    hideTip();
    pinned = cell;
    pinnedScroll = scrollY;
    cell.classList.add('is-pinned');
    showTip(cell);
  });
  // Toute autre action ferme l'infobulle épinglée
  document.addEventListener('pointerdown', (e) => { if (pinned && !cellAt(e)) hideTip(); }, { passive: true });
  window.addEventListener('scroll', () => { if (pinned && Math.abs(scrollY - pinnedScroll) > 6) hideTip(); }, { passive: true });
  window.addEventListener('resize', () => {
    if (innerWidth === width) return; // la barre d'adresse du téléphone qui se replie ne compte pas
    width = innerWidth;
    if (pinned) hideTip();
  });
};
