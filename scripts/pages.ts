// Plugin Vite du site :
// - génère une page par langue (src/<langue>/index.html) à partir de src/template.html
//   et des textes de src/i18n/<langue>.json ; Vite les compile ensuite en /fr/ et /en/ ;
// - après le build, publie la liste des dépôts GitHub publics et leurs icônes dans dist/data/.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

type Dict = Record<string, unknown>;

interface Options {
  /** Dossier des sources (racine Vite) */
  src: string;
  /** Langue servie à la racine si la fonction de langue ne tourne pas */
  defaultLang: string;
  /** Compte GitHub dont on affiche les dépôts publics */
  githubUser: string;
  /** Dossier des icônes choisies à la main (servies sous /icons/) */
  iconsDir: string;
}

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Dict)[k]), obj);

const render = (template: string, dict: Dict, lang: string, langs: string[]): string => {
  const ctx = { ...dict, lang, active: Object.fromEntries(langs.map((l) => [l, l === lang ? 'is-active' : ''])) };
  return template
    .replace(/<!--[\s\S]*?-->\n?/, '') // commentaire d'en-tête du modèle
    .replace(/\{\{\s*json:([\w.]+)\s*\}\}/g, (_, key: string) => JSON.stringify(get(ctx, key) ?? {}).replace(/</g, '\\u003c'))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const value = get(ctx, key);
      if (typeof value !== 'string') throw new Error(`Traduction manquante « ${key} » (${lang})`);
      return value;
    });
};

export const languages = (src: string): string[] =>
  readdirSync(join(src, 'i18n')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

/** Écrit src/<langue>/index.html pour chaque langue et renvoie leurs chemins */
export const renderPages = (src: string): Record<string, string> => {
  const template = readFileSync(join(src, 'template.html'), 'utf8');
  const langs = languages(src);
  const inputs: Record<string, string> = {};
  for (const lang of langs) {
    const dict = JSON.parse(readFileSync(join(src, 'i18n', `${lang}.json`), 'utf8')) as Dict;
    const dir = join(src, lang);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'index.html');
    writeFileSync(file, render(template, dict, lang, langs));
    inputs[lang] = file;
  }
  return inputs;
};

/* ---------- Dépôts GitHub ---------- */

interface Repo {
  name: string;
  full_name: string;
  fork: boolean;
  private: boolean;
  archived: boolean;
  icon?: string | null;
}

// Emplacements courants d'une icône dans un dépôt
const ICON_CANDIDATES = [
  'build/icon.png', 'icon.png', 'icon.svg', 'logo.png', 'logo.svg',
  'assets/icon.png', 'assets/logo.png', 'resources/icon.png',
  'public/icon.png', 'public/logo.png', 'src/assets/icon.png', '.github/icon.png', 'docs/icon.png',
];

const publishRepos = async (out: string, { githubUser, iconsDir }: Options, log: (msg: string) => void) => {
  // 1. icônes choisies à la main (prioritaires)
  const localIcons: Record<string, string> = {};
  for (const file of existsSync(iconsDir) ? readdirSync(iconsDir) : []) {
    const m = /^(.+)\.(webp|png|svg)$/.exec(file);
    if (m) localIcons[m[1]] = `/icons/${file}`;
  }
  await mkdir(join(out, 'data'), { recursive: true });
  await writeFile(join(out, 'data', 'icons.json'), JSON.stringify(localIcons));

  // 2. sinon, une icône trouvée dans le dépôt lui-même
  const findRepoIcon = async (repo: Repo): Promise<string | null> => {
    for (const path of ICON_CANDIDATES) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/HEAD/${path}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1_500_000) continue; // trop lourd pour une vignette
        const ext = path.split('.').pop();
        await mkdir(join(out, 'data', 'icons'), { recursive: true });
        await writeFile(join(out, 'data', 'icons', `${repo.name}.${ext}`), buf);
        return `/data/icons/${repo.name}.${ext}`;
      } catch { /* emplacement suivant */ }
    }
    return null;
  };

  // Dépôts publics figés au build. En cas d'échec, la page interroge GitHub depuis le navigateur.
  try {
    const res = await fetch(`https://api.github.com/users/${githubUser}/repos?per_page=100&sort=pushed`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'romainpiau.dev-build' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const repos = ((await res.json()) as Repo[]).filter((r) => !r.fork && !r.private && !r.archived);
    await Promise.all(repos.map(async (r) => { r.icon = localIcons[r.name] || (await findRepoIcon(r)); }));
    await writeFile(join(out, 'data', 'repos.json'), JSON.stringify(repos));
    log(`Dépôts GitHub : ${repos.length} (icônes : ${repos.filter((r) => r.icon).map((r) => r.name).join(', ') || 'aucune'})`);
  } catch (err) {
    log(`API GitHub indisponible (${(err as Error).message}) : la page chargera les dépôts depuis le navigateur.`);
  }
};

/* ---------- Plugin ---------- */

export default function sitePages(options: Options): Plugin {
  const src = resolve(options.src);
  let config: ResolvedConfig;

  return {
    name: 'site-pages',

    config() {
      const inputs = renderPages(src);
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

    // Développement : pages régénérées à chaque modification du modèle ou des textes, « / » → langue par défaut
    configureServer(server) {
      const watched = [join(src, 'template.html'), join(src, 'i18n')];
      server.watcher.add(watched);
      server.watcher.on('change', (file) => {
        if (file === watched[0] || file.startsWith(watched[1])) {
          renderPages(src);
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
      // Repli si la fonction de langue (functions/index.ts) ne tourne pas
      copyFileSync(join(out, options.defaultLang, 'index.html'), join(out, 'index.html'));
      await publishRepos(out, options, (msg) => config.logger.info(msg));
    },
  };
}
