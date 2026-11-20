import { $, $$, escapeHtml, reduceMotion } from '../lib/dom';
import { i18n } from '../lib/i18n';
import { filterChipsHtml, languageCounts, repoCardHtml, timeAgo, visibleRepos } from '../lib/repo-card';
import type { Repo } from '../types';
import { bindSpotlight } from './effects';
import { addReveal } from './reveal';

const GITHUB_USER = 'WolfGang-PRoxa';

let icons: Record<string, string> = {};
let data: Repo[] | null = null;
let failed = false;

const list = () => $('#repo-list');
const filters = () => $('#filters');
const status = () => $('#repo-status');

const toElements = (html: string) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return [...tpl.content.children] as HTMLElement[];
};

const announce = (n: number) => {
  const el = status();
  const t = i18n.t.shown;
  if (el && t) el.textContent = (n === 1 ? t.one : t.other).replace('{n}', String(n));
};

const applyFilter = (lang: string, animate: boolean) => {
  const el = list();
  const bar = filters();
  if (!el || !bar) return;
  $$('.chip', bar).forEach((c) => {
    const on = c.dataset.lang === lang;
    c.classList.toggle('is-active', on);
    c.setAttribute('aria-pressed', String(on));
  });
  let n = 0;
  $$('.repo', el).forEach((card) => {
    const show = lang === 'all' || card.dataset.lang === lang;
    card.classList.toggle('is-hidden', !show);
    if (!show) return;
    if (animate && !reduceMotion) {
      card.classList.remove('enter');
      void card.offsetWidth; // relance l'animation
      card.style.setProperty('--d', String(n));
      card.classList.add('enter');
    }
    n++;
  });
  if (animate) announce(n);
};

/** `snap` : les cartes prennent leur place sans animation d'entrée (contenu remplacé) */
const render = (repos: Repo[], snap: boolean) => {
  const el = list();
  const bar = filters();
  if (!el || !bar) return;
  data = repos = visibleRepos(repos);
  const active = $('.chip.is-active', bar)?.dataset.lang || 'all';

  const cards = toElements(repos.map((r, i) => repoCardHtml(r, i, i18n.t, icons[r.name])).join(''));
  cards.forEach(bindSpotlight);
  el.replaceChildren(...cards);
  cards.forEach((card) => addReveal(card, 0, snap));

  // Filtres par langage
  $$('.chip:not([data-lang="all"])', bar).forEach((c) => c.remove());
  bar.append(...toElements(filterChipsHtml(repos, i18n.t)));
  const langs = languageCounts(repos).map(([l]) => l);
  applyFilter(langs.includes(active) ? active : 'all', false);

  const last = $('[data-last-push]');
  if (last && repos[0]) last.textContent = timeAgo(repos[0].pushed_at, i18n.locale);
};

const showError = () => {
  failed = true;
  const el = list();
  if (el) {
    el.innerHTML = `<div class="repos__error card">${escapeHtml(i18n.t.error || '')} <a href="https://github.com/${GITHUB_USER}?tab=repositories" target="_blank" rel="noopener">${escapeHtml(i18n.t.errorLink || 'GitHub ↗')}</a></div>`;
  }
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
  const el = list();
  filters()?.addEventListener('click', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('.chip');
    if (chip?.dataset.lang) applyFilter(chip.dataset.lang, true);
  });

  // Après un changement de langue : textes des cartes, dates relatives, message d'erreur
  i18n.onChange(() => {
    if (data) render(data, true);
    else if (failed) showError();
  });

  // Cartes déjà écrites dans la page au build : elles restent jusqu'à l'arrivée de la liste à jour
  const prerendered = !!el?.querySelector('.repo:not(.skeleton)');
  if (prerendered) $$('.repo', el!).forEach(bindSpotlight);

  // 1. /api/repos : liste à jour (Function Cloudflare, en cache une heure)
  // 2. /data/repos.json : liste figée au dernier build
  // 3. l'API GitHub, depuis le navigateur
  try { icons = await getJson<Record<string, string>>('/data/icons.json'); } catch { /* pas d'icônes */ }
  let repos: Repo[] | null = null;
  for (const url of ['/api/repos', '/data/repos.json', `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`]) {
    try { repos = await getRepos(url); break; } catch { /* source suivante */ }
  }
  if (!repos) {
    if (!prerendered) showError();
    return;
  }
  render(repos, prerendered);
};
