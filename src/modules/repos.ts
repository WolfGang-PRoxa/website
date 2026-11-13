import { $, $$, escapeHtml, reduceMotion } from '../lib/dom';
import { i18n } from '../lib/i18n';
import type { Repo } from '../types';
import { bindSpotlight } from './effects';
import { addReveal } from './reveal';

const GITHUB_USER = 'WolfGang-PRoxa';

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Java: '#b07219',
  Kotlin: '#A97BFF', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', 'C#': '#178600',
  'C++': '#f34b7d', Go: '#00ADD8', Rust: '#dea584', Lua: '#000080', Vue: '#41b883',
};
const OTHER = 'other';
const colorOf = (lang: string) => LANG_COLORS[lang] || '#8b8b9b';

const BOOK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></svg>';

let icons: Record<string, string> = {};
let data: Repo[] | null = null;
let failed = false;

const list = () => $('#repo-list');
const filters = () => $('#filters');

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(i18n.locale, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit, number][] = [
    [60, 'second', 1], [3600, 'minute', 60], [86400, 'hour', 3600],
    [2592000, 'day', 86400], [31536000, 'month', 2592000], [Infinity, 'year', 31536000],
  ];
  const [, unit, div] = steps.find(([limit]) => diff < limit)!;
  return rtf.format(-Math.round(diff / div), unit);
};

const prettyName = (name: string) => name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const repoCard = (r: Repo, i: number) => {
  const override = i18n.t.repos?.[r.name] ?? {};
  const title = override.title || prettyName(r.name);
  const description = override.description || r.description;
  const icon = r.icon || icons[r.name];
  const a = document.createElement('a');
  a.className = 'repo card spotlight reveal';
  a.href = r.html_url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.lang = r.language || OTHER;
  a.style.setProperty('--i', String(i % 3));
  a.innerHTML = `
    <div class="repo__top">
      ${icon
        ? `<span class="repo__icon repo__icon--img"><img src="${escapeHtml(icon)}" alt="" width="40" height="40" loading="lazy" decoding="async"></span>`
        : `<span class="repo__icon">${BOOK_ICON}</span>`}
      <span class="repo__ext" aria-hidden="true">↗</span>
    </div>
    <h3>${escapeHtml(title)}</h3>
    <p class="${description ? '' : 'is-empty'}">${escapeHtml(description || i18n.t.noDescription || '')}</p>
    <div class="repo__meta">
      ${r.language ? `<span><i class="dot" style="--c:${colorOf(r.language)}"></i>${escapeHtml(r.language)}</span>` : ''}
      ${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ''}
      <span>${timeAgo(r.pushed_at)}</span>
    </div>`;
  bindSpotlight(a);
  return a;
};

const applyFilter = (lang: string, animate: boolean) => {
  const el = list();
  const bar = filters();
  if (!el || !bar) return;
  $$('.chip', bar).forEach((c) => c.classList.toggle('is-active', c.dataset.lang === lang));
  let n = 0;
  $$('.repo', el).forEach((card) => {
    const show = lang === 'all' || card.dataset.lang === lang;
    card.classList.toggle('is-hidden', !show);
    if (show && animate && !reduceMotion) {
      card.classList.remove('enter');
      void card.offsetWidth; // relance l'animation
      card.style.setProperty('--d', String(n++));
      card.classList.add('enter');
    }
  });
};

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

const render = (repos: Repo[], first: boolean) => {
  const el = list();
  const bar = filters();
  if (!el || !bar) return;
  data = repos = repos
    .filter((r) => !r.fork && !r.private && !r.archived)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
  const active = $('.chip.is-active', bar)?.dataset.lang || 'all';

  el.replaceChildren(...repos.map(repoCard));
  $$('.repo', el).forEach((card) => addReveal(card, 0, !first));

  // Filtres par langage
  $$('.chip:not([data-lang="all"])', bar).forEach((c) => c.remove());
  const counts = repos.reduce<Record<string, number>>((acc, r) => {
    const l = r.language || OTHER;
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([lang, n]) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.dataset.lang = lang;
    const label = lang === OTHER ? i18n.t.other || 'Other' : lang;
    chip.innerHTML = `<i class="dot" style="--c:${colorOf(lang)}"></i>${escapeHtml(label)} <span style="opacity:.6">${n}</span>`;
    bar.appendChild(chip);
  });
  applyFilter(counts[active] ? active : 'all', false);

  // Statistiques du hero
  if (first) {
    const repoCount = $('[data-count="repos"]');
    const langCount = $('[data-count="langs"]');
    if (repoCount) animateCount(repoCount, repos.length);
    if (langCount) animateCount(langCount, new Set(repos.map((r) => r.language).filter(Boolean)).size);
  }
  const last = $('[data-last-push]');
  if (last && repos[0]) last.textContent = timeAgo(repos[0].pushed_at);
};

const showError = () => {
  failed = true;
  const el = list();
  if (el) {
    el.innerHTML = `<div class="repos__error card">${escapeHtml(i18n.t.error || '')} <a href="https://github.com/${GITHUB_USER}?tab=repositories" target="_blank" rel="noopener">${escapeHtml(i18n.t.errorLink || 'GitHub ↗')}</a></div>`;
  }
  ['repos', 'langs'].forEach((k) => { const c = $(`[data-count="${k}"]`); if (c) c.textContent = '–'; });
  const last = $('[data-last-push]');
  if (last) last.textContent = '–';
};

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
};

const getRepos = async (url: string) => {
  const repos = await getJson<Repo[]>(url);
  if (!Array.isArray(repos) || !repos.length) throw new Error('vide');
  return repos;
};

export const initRepos = async () => {
  filters()?.addEventListener('click', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('.chip');
    if (chip?.dataset.lang) applyFilter(chip.dataset.lang, true);
  });

  // Après un changement de langue : textes des cartes, dates relatives, message d'erreur
  i18n.onChange(() => {
    if (data) render(data, false);
    else if (failed) showError();
  });

  // data/icons.json : icônes choisies à la main (public/icons/), aussi utilisées en secours.
  // data/repos.json est généré au build (pas de limite d'API côté visiteur) ;
  // à défaut, on interroge l'API GitHub directement.
  try { icons = await getJson<Record<string, string>>('/data/icons.json'); } catch { /* pas d'icônes */ }
  try {
    render(await getRepos('/data/repos.json'), true);
  } catch {
    try {
      render(await getRepos(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`), true);
    } catch {
      showError();
    }
  }
};
