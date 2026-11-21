// Plugin Vite du site :
// - génère chaque page dans chaque langue (src/<langue>/…/index.html, src/404.html) à partir de
//   src/pages/_layout.html, des pages de src/pages/, des morceaux de src/partials/ et des textes
//   de src/i18n/<langue>.json ; Vite les compile ensuite ;
// - récupère au build les dépôts GitHub publics et les dernières versions des projets, pour les
//   écrire directement dans la page (visibles sans JavaScript) et dans dist/data/ ;
// - après le build : plan du site, et empreintes des scripts en ligne dans la CSP de dist/_headers.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { downloadUrl, escapeHtml, filterChipsHtml, isDownloadable, repoCardHtml, slimRepo, timeAgo, visibleRepos } from '../src/lib/repo-card.ts';
import { latestRelease, versionLabel } from '../src/lib/releases.ts';
import { repoCounts, repoSplit, repoTotal, type RepoCounts } from '../src/lib/repo-counts.ts';
import type { ClientDict, Repo } from '../src/types.ts';

type Dict = Record<string, unknown>;

/** Année où j'ai commencé à coder (statistique « années de code ») */
const CODING_SINCE = 2018;

interface Options {
  /** Dossier des sources (racine Vite) */
  src: string;
  /** Adresse publique du site, sans barre finale */
  site: string;
  /** Langue servie à la racine si la fonction de langue ne tourne pas */
  defaultLang: string;
  /** Compte GitHub dont on affiche les dépôts publics */
  githubUser: string;
  /** Dossier des icônes choisies à la main (servies sous /icons/) */
  iconsDir: string;
  /** Projets mis en avant : clé utilisée dans les pages → dépôt, et version affichée si GitHub ne répond pas */
  featured: Record<string, { repo: string; fallback?: string }>;
}

/* ---------- Pages ---------- */

interface PageDef {
  /** Fichier de src/pages/ et valeur de data-page */
  name: string;
  /** Chemin après /<langue>/ ('' pour l'accueil) */
  path: string;
  /** Textes de la balise <head> pris dans cette clé du dictionnaire (sinon « meta ») */
  meta?: string;
  /** Page unique (pas une par langue), écrite à la racine sous ce nom */
  single?: string;
  /** Absente du plan du site et des moteurs de recherche */
  noindex?: boolean;
}

export const PAGES: PageDef[] = [
  { name: 'home', path: '' },
  { name: 'legal', path: 'legal/', meta: 'legal.meta' },
  { name: '404', path: '', meta: 'notFound.meta', single: '404.html', noindex: true },
];

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Dict)[k]), obj);

const partials = (src: string): Record<string, string> =>
  Object.fromEntries(readdirSync(join(src, 'partials'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.slice(0, -5), readFileSync(join(src, 'partials', f), 'utf8').replace(/\n$/, '')]));

const fill = (template: string, ctx: Dict, where: string): string =>
  template
    .replace(/<!--[\s\S]*?-->\n?/, '') // commentaire d'en-tête du modèle
    .replace(/\{\{\s*json:([\w.]+)\s*\}\}/g, (_, key: string) => JSON.stringify(get(ctx, key) ?? {}).replace(/</g, '\\u003c'))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const value = get(ctx, key);
      if (typeof value !== 'string') throw new Error(`Texte manquant « ${key} » (${where})`);
      return value;
    });

export const languages = (src: string): string[] =>
  readdirSync(join(src, 'i18n')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

/** Données calculées au build et écrites dans les pages */
interface BuildData {
  repos: Repo[] | null;
  /** Nombre de dépôts publics et privés */
  counts: RepoCounts | null;
  icons: Record<string, string>;
  featured: Options['featured'];
  githubUser: string;
}

const buildContext = (data: BuildData, client: ClientDict) => {
  const repos = data.repos ? visibleRepos(data.repos) : [];
  // Projets mis en avant : version publiée et lien « Télécharger » s'il y a des fichiers à télécharger
  const release: Record<string, string> = {};
  const download: Record<string, string> = {};
  for (const [key, { repo, fallback }] of Object.entries(data.featured)) {
    const r = data.repos?.find((x) => x.name === repo);
    release[key] = r?.release ? versionLabel(r.release.tag) : fallback ?? '';
    const url = downloadUrl({ html_url: r?.html_url ?? `https://github.com/${data.githubUser}/${repo}` });
    download[key] = r && isDownloadable(r)
      ? `<a class="link-arrow" href="${escapeHtml(url)}" target="_blank" rel="noopener" data-i18n="client.download">${escapeHtml(client.download || 'Download')}</a>`
      : '';
  }
  const skeleton = '<div class="repo card skeleton"></div>'.repeat(3);
  return {
    since: String(CODING_SINCE),
    years: String(new Date().getFullYear() - CODING_SINCE),
    lastPush: repos[0] ? timeAgo(repos[0].pushed_at, client.locale) : '…',
    repoTotal: repoTotal(data.counts),
    repoSplit: escapeHtml(repoSplit(data.counts, client)),
    cards: data.repos ? repos.map((r, i) => repoCardHtml(r, i, client, data.icons[r.name])).join('') : skeleton,
    chips: filterChipsHtml(repos, client),
    release,
    download,
  };
};

/** Écrit chaque page générée dans src/ et renvoie les entrées de Vite */
export const renderPages = (src: string, site: string, data: BuildData): Record<string, string> => {
  const layout = readFileSync(join(src, 'pages', '_layout.html'), 'utf8');
  const parts = partials(src);
  const langs = languages(src);
  const inputs: Record<string, string> = {};

  for (const page of PAGES) {
    const content = readFileSync(join(src, 'pages', `${page.name}.html`), 'utf8').replace(/\n$/, '');
    const blocks: Record<string, string> = {
      ...parts,
      content,
      seo: page.noindex ? '  <meta name="robots" content="noindex">' : parts.seo,
    };
    const template = layout.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name: string) => {
      if (!(name in blocks)) throw new Error(`Morceau introuvable « ${name} »`);
      return blocks[name];
    });

    for (const lang of page.single ? [langs.includes('en') ? 'en' : langs[0]] : langs) {
      const dict = JSON.parse(readFileSync(join(src, 'i18n', `${lang}.json`), 'utf8')) as Dict;
      const home = page.name === 'home';
      const ctx: Dict = {
        ...dict,
        meta: { ...(dict.meta as Dict), ...((page.meta && (get(dict, page.meta) as Dict)) || {}) },
        lang,
        page: page.name,
        path: page.path,
        base: home ? '' : `/${lang}/`,
        homeHref: home ? '#top' : `/${lang}/`,
        xDefault: home ? `${site}/` : `${site}/en/${page.path}`,
        active: Object.fromEntries(langs.map((l) => [l, l === lang ? 'is-active' : ''])),
        build: buildContext(data, dict.client as ClientDict),
      };
      const file = page.single ? join(src, page.single) : join(src, lang, page.path, 'index.html');
      mkdirSync(dirname(file), { recursive: true });
      // Icônes écrites en dur dans les pages (projets principaux) : même adresse versionnée que dans les cartes
      const html = Object.values(data.icons).reduce(
        (out, url) => out.replaceAll(`"${url.split('?')[0]}"`, `"${url}"`),
        fill(template, ctx, `${page.name}, ${lang}`),
      );
      writeFileSync(file, html);
      inputs[page.single ? page.name : `${lang}/${page.path}`.replace(/\/$/, '')] = file;
    }
  }
  return inputs;
};

/* ---------- Données GitHub ---------- */

// Emplacements courants d'une icône dans un dépôt
const ICON_CANDIDATES = [
  'build/icon.png', 'app/build/icon.png', 'branding/icon.svg', 'icon.png', 'icon.svg', 'logo.png', 'logo.svg',
  'assets/icon.png', 'assets/logo.png', 'resources/icon.png',
  'public/icon.png', 'public/logo.png', 'src/assets/icon.png', '.github/icon.png', 'docs/icon.png',
];

const githubHeaders = (): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'romainpiau.dev-build',
  // Jeton facultatif (variable GITHUB_TOKEN du build Cloudflare) : évite la limite de 60 requêtes / heure
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const getJson = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

/** Icônes trouvées dans les dépôts eux-mêmes, à écrire dans dist/data/icons/ */
const repoIconFiles = new Map<string, Buffer>();

const findRepoIcon = async (repo: Repo): Promise<string | null> => {
  for (const path of ICON_CANDIDATES) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/HEAD/${path}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 1_500_000) continue; // trop lourd pour une vignette
      const file = `${repo.name}.${path.split('.').pop()}`;
      repoIconFiles.set(file, buf);
      return `/data/icons/${file}`;
    } catch { /* emplacement suivant */ }
  }
  return null;
};

const loadBuildData = async ({ githubUser, iconsDir, featured, site }: Options, build: boolean, log: (msg: string) => void): Promise<BuildData> => {
  // 1. icônes choisies à la main (prioritaires)
  const icons: Record<string, string> = {};
  for (const file of existsSync(iconsDir) ? readdirSync(iconsDir) : []) {
    const m = /^(.+)\.(webp|png|svg)$/.exec(file);
    // ?v=<empreinte> : une icône remplacée s'affiche tout de suite malgré le cache (une semaine) de /icons/
    if (m) icons[m[1]] = `/icons/${file}?v=${createHash('sha256').update(readFileSync(join(iconsDir, file))).digest('hex').slice(0, 8)}`;
  }

  // 2. dépôts publics : API GitHub, sinon la liste du site en ligne (dernier build réussi)
  let repos: Repo[] | null = null;
  try {
    const all = await getJson<Repo[]>(`https://api.github.com/users/${githubUser}/repos?per_page=100&sort=pushed`, githubHeaders());
    repos = all.filter((r) => !r.fork && !r.private && !r.archived).map(slimRepo);
    if (build) await Promise.all(repos.map(async (r) => { r.icon = icons[r.name] || (await findRepoIcon(r)); }));
    else repos.forEach((r) => { r.icon = icons[r.name] || null; });
    log(`Dépôts GitHub : ${repos.length} (icônes : ${repos.filter((r) => r.icon).map((r) => r.name).join(', ') || 'aucune'})`);
  } catch (err) {
    try {
      // Les icônes trouvées par l'ancien build ne seront pas republiées : on ne garde que les nôtres
      repos = (await getJson<Repo[]>(`${site}/data/repos.json`)).map((r) => ({ ...slimRepo(r), icon: icons[r.name] || null }));
      log(`API GitHub indisponible (${(err as Error).message}) : liste reprise du site en ligne (${repos.length} dépôts).`);
    } catch {
      log(`API GitHub indisponible (${(err as Error).message}) : la page chargera les dépôts depuis le navigateur.`);
    }
  }

  // 3. dernière release de chaque dépôt (bouton « Télécharger » quand elle a des fichiers)
  if (repos) {
    await Promise.all(repos.map(async (r) => {
      const release = await latestRelease(r.full_name, process.env.GITHUB_TOKEN);
      if (release !== undefined) r.release = release;
    }));
    const unknown = repos.filter((r) => r.release === undefined).length;
    const downloads = repos.filter(isDownloadable).map((r) => `${r.name} ${r.release!.tag}`);
    log(`Releases téléchargeables : ${downloads.join(', ') || 'aucune'}${unknown ? ` (${unknown} dépôt(s) sans réponse de GitHub)` : ''}`);
  }

  // 4. nombre de dépôts (privés compris avec le jeton du compte), sinon ceux du site en ligne
  let counts = await repoCounts(githubUser, process.env.GITHUB_TOKEN);
  if (!counts) {
    try { counts = (await getJson<{ repos: RepoCounts | null }>(`${site}/data/profile.json`)).repos; } catch { /* inconnu */ }
  }
  log(`Nombre de dépôts : ${counts ? `${counts.public} publics, ${counts.private ?? '?'} privés (jeton : ${counts.auth ?? '?'})` : 'inconnu'}`);

  return { repos, counts, icons, featured, githubUser };
};

/* ---------- Après le build ---------- */

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);

/** Empreintes SHA-256 des scripts écrits dans les pages (hors données JSON) */
const inlineScriptHashes = (out: string): string[] => {
  const hashes = new Set<string>();
  for (const file of htmlFiles(out)) {
    for (const [, attrs, body] of readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\bsrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs) || !body.trim()) continue;
      hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
    }
  }
  return [...hashes];
};

const sitemap = (site: string, langs: string[]) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.filter((p) => !p.single && !p.noindex).flatMap((p) => langs.map((lang) => `  <url>
    <loc>${site}/${lang}/${p.path}</loc>
    <lastmod>${today}</lastmod>
${langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site}/${l}/${p.path}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${p.path ? `${site}/en/${p.path}` : `${site}/`}"/>
  </url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
};

/* ---------- Plugin ---------- */

export default function sitePages(options: Options): Plugin {
  const src = resolve(options.src);
  let config: ResolvedConfig;
  let data: BuildData;

  return {
    name: 'site-pages',

    async config(_, { command }) {
      data = await loadBuildData(options, command === 'build', (msg) => console.log(`[site] ${msg}`));
      const inputs = renderPages(src, options.site, data);
      return { build: { rolldownOptions: { input: inputs } } };
    },

    configResolved(resolved) {
      config = resolved;
    },

    // Précharge les polices du titre et du texte (alphabet latin) pour un affichage sans saut
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        return Object.keys(ctx.bundle)
          .filter((file) => /\/(inter|space-grotesk)-latin-wght-normal-[\w-]+\.woff2$/.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          }));
      },
    },

    // Développement : pages régénérées à chaque modification d'une page, d'un morceau ou des textes ;
    // « / » → langue par défaut
    configureServer(server) {
      const watched = ['pages', 'partials', 'i18n'].map((d) => join(src, d));
      server.watcher.add(watched);
      server.watcher.on('change', (file) => {
        if (watched.some((dir) => !relative(dir, file).startsWith('..'))) {
          renderPages(src, options.site, data);
          server.ws.send({ type: 'full-reload' });
        }
      });
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) req.url = `/${options.defaultLang}/${req.url.slice(1)}`;
        next();
      });
    },

    async closeBundle() {
      if (config.command !== 'build') return;
      const out = resolve(config.root, config.build.outDir);
      const log = (msg: string) => config.logger.info(msg);

      // Repli si la fonction de langue (functions/index.ts) ne tourne pas
      copyFileSync(join(out, options.defaultLang, 'index.html'), join(out, 'index.html'));

      // Dépôts et icônes, pour la mise à jour dans le navigateur et la Function /api/repos
      await mkdir(join(out, 'data', 'icons'), { recursive: true });
      await writeFile(join(out, 'data', 'icons.json'), JSON.stringify(data.icons));
      if (data.repos) await writeFile(join(out, 'data', 'repos.json'), JSON.stringify(data.repos));
      await writeFile(join(out, 'data', 'profile.json'), JSON.stringify({ repos: data.counts, at: new Date().toISOString() }));
      for (const [file, buf] of repoIconFiles) await writeFile(join(out, 'data', 'icons', file), buf);

      await writeFile(join(out, 'sitemap.xml'), sitemap(options.site, languages(src)));

      // CSP : seuls les scripts en ligne écrits par nous sont autorisés, par leur empreinte
      const headersFile = join(out, '_headers');
      const hashes = inlineScriptHashes(out);
      const headers = readFileSync(headersFile, 'utf8');
      if (!headers.includes('__CSP_SCRIPT_HASHES__')) throw new Error('_headers : marqueur __CSP_SCRIPT_HASHES__ introuvable');
      writeFileSync(headersFile, headers.replace('__CSP_SCRIPT_HASHES__', hashes.join(' ')));
      log(`CSP : ${hashes.length} script(s) en ligne autorisé(s)`);
    },
  };
}
