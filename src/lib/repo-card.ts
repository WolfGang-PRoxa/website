// Cartes des dépôts GitHub, en texte HTML : le même code sert au build (cartes écrites
// dans la page, visibles sans JavaScript) et dans le navigateur (mise à jour en direct).
// Aucun accès au DOM ici.
import type { ClientDict, Repo } from '../types.ts';
import { versionLabel } from './releases.ts';

/** Dépôts publics à ne jamais afficher (ex. un dépôt qui n'est pas un projet) */
export const HIDDEN_REPOS = new Set<string>([]);

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  'C#': '#178600',
  'C++': '#f34b7d',
  Go: '#00ADD8',
  Rust: '#dea584',
  Lua: '#000080',
  Vue: '#41b883',
};
export const OTHER = 'other';
export const colorOf = (lang: string) => LANG_COLORS[lang] || '#8b8b9b';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const BOOK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></svg>';

/** Dépôts à afficher, du plus récent au plus ancien */
export const visibleRepos = (repos: Repo[]): Repo[] =>
  repos
    .filter((r) => !r.fork && !r.private && !r.archived && !HIDDEN_REPOS.has(r.name))
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());

/** Champs utiles d'un dépôt (le reste de la réponse GitHub est inutile et lourd) */
export const slimRepo = (r: Repo): Repo => ({
  name: r.name,
  full_name: r.full_name,
  html_url: r.html_url,
  description: r.description,
  language: r.language,
  stargazers_count: r.stargazers_count,
  pushed_at: r.pushed_at,
  fork: r.fork,
  private: r.private,
  archived: r.archived,
  icon: r.icon ?? null,
  ...(r.release !== undefined ? { release: r.release } : {}),
});

/** Le dépôt a une release avec des fichiers à télécharger */
export const isDownloadable = (r: Repo) => !!r.release && r.release.assets > 0;

/** Lien de téléchargement (page de la dernière release, où l'on choisit son fichier) */
export const downloadUrl = (r: Pick<Repo, 'html_url'>) => `${r.html_url}/releases/latest`;

export const timeAgo = (iso: string, locale: string, now = Date.now()) => {
  const diff = (now - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit, number][] = [
    [60, 'second', 1],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [2592000, 'day', 86400],
    [31536000, 'month', 2592000],
    [Infinity, 'year', 31536000],
  ];
  const [, unit, div] = steps.find(([limit]) => diff < limit)!;
  return rtf.format(-Math.round(diff / div), unit);
};

// « speedrun-games » → « Speedrun Games » ; un nom court d'un seul mot est un sigle : « lma » → « LMA »
const prettyName = (name: string) =>
  /^[a-z]{2,3}$/i.test(name)
    ? name.toUpperCase()
    : name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';

/** Une carte de dépôt. Toute la carte mène au code source (lien étiré sur la carte) ;
    les liens du bas (Télécharger, plus tard Démo) passent au-dessus. */
export const repoCardHtml = (r: Repo, i: number, t: ClientDict, icon?: string | null) => {
  const override = t.repos?.[r.name] ?? {};
  const title = override.title || prettyName(r.name);
  const description = override.description || r.description;
  const src = r.icon || icon;
  const download = isDownloadable(r)
    ? `<a class="repo__action repo__action--download" href="${escapeHtml(downloadUrl(r))}" target="_blank" rel="noopener">${DOWNLOAD_ICON}<span>${escapeHtml(t.download || 'Download')}</span><span class="repo__version">${escapeHtml(versionLabel(r.release!.tag))}</span></a>`
    : '';
  return `<article class="repo card spotlight reveal${download ? ' has-download' : ''}" data-lang="${escapeHtml(r.language || OTHER)}" style="--i:${i % 3}">
    <div class="repo__top">
      ${
        src
          ? `<span class="repo__icon repo__icon--img"><img src="${escapeHtml(src)}" alt="" width="40" height="40" loading="lazy" decoding="async"></span>`
          : `<span class="repo__icon">${BOOK_ICON}</span>`
      }
      <span class="repo__ext" aria-hidden="true">↗</span>
    </div>
    <h3><a class="repo__link" href="${escapeHtml(r.html_url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a></h3>
    <p class="${description ? '' : 'is-empty'}">${escapeHtml(description || t.noDescription || '')}</p>
    <div class="repo__meta">
      ${r.language ? `<span><i class="dot" style="--c:${colorOf(r.language)}"></i>${escapeHtml(r.language)}</span>` : ''}
      ${r.stargazers_count ? `<span><span aria-hidden="true">★</span> ${r.stargazers_count}</span>` : ''}
      <span>${escapeHtml(timeAgo(r.pushed_at, t.locale))}</span>
    </div>
    ${download ? `<div class="repo__actions">${download}</div>` : ''}
  </article>`;
};

/** Nombre de dépôts par langage, du plus fréquent au moins fréquent */
export const languageCounts = (repos: Repo[]): [string, number][] => {
  const counts = repos.reduce<Record<string, number>>((acc, r) => {
    const l = r.language || OTHER;
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

/** Boutons de filtre par langage (sans le bouton « Tous ») */
export const filterChipsHtml = (repos: Repo[], t: ClientDict) =>
  languageCounts(repos)
    .map(([lang, n]) => {
      const label = lang === OTHER ? t.other || 'Other' : lang;
      return `<button class="chip" type="button" data-lang="${escapeHtml(lang)}" aria-pressed="false"><i class="dot" style="--c:${colorOf(lang)}"></i>${escapeHtml(label)} <span class="chip__n">${n}</span></button>`;
    })
    .join('');

export const languageTotal = (repos: Repo[]) => new Set(repos.map((r) => r.language).filter(Boolean)).size;
