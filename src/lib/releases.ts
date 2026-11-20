// Dernière release d'un dépôt GitHub, et si elle contient des fichiers à télécharger.
// Sert au build (Node) et à la Function /api/repos (Cloudflare) : uniquement fetch, pas de DOM.
//
// Avec un jeton (GITHUB_TOKEN) : l'API GitHub, une requête par dépôt.
// Sans jeton : les pages publiques de github.com, qui ne comptent pas dans la limite de
// 60 requêtes par heure de l'API (redirection de /releases/latest, puis liste des fichiers).
import type { Release } from '../types.ts';

const timeout = () => AbortSignal.timeout(10000);

const viaApi = async (fullName: string, token: string): Promise<Release | null> => {
  const res = await fetch(`https://api.github.com/repos/${fullName}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'romainpiau.dev', Authorization: `Bearer ${token}` },
    signal: timeout(),
  });
  if (res.status === 404) return null; // aucune release
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as { tag_name: string; assets?: unknown[] };
  return { tag: data.tag_name, assets: data.assets?.length ?? 0 };
};

const viaPages = async (fullName: string): Promise<Release | null> => {
  const res = await fetch(`https://github.com/${fullName}/releases/latest`, {
    method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'romainpiau.dev' }, signal: timeout(),
  });
  const location = res.headers.get('location') || '';
  const tag = /\/releases\/tag\/([^/?#]+)/.exec(location)?.[1];
  if (!tag) {
    if (res.status >= 300 && res.status < 400) return null; // renvoie vers /releases : aucune release
    throw new Error(`GitHub ${res.status}`);
  }
  // Fichiers joints (hors archives du code source, ajoutées d'office par GitHub)
  const page = await fetch(`https://github.com/${fullName}/releases/expanded_assets/${tag}`, {
    headers: { 'User-Agent': 'romainpiau.dev' }, signal: timeout(),
  });
  if (!page.ok) throw new Error(`GitHub ${page.status}`);
  const assets = new Set((await page.text()).match(/\/releases\/download\/[^"'\s]+/g) ?? []).size;
  return { tag: decodeURIComponent(tag), assets };
};

/** `undefined` : on n'a pas pu savoir (on garde alors l'information précédente) */
export const latestRelease = async (fullName: string, token?: string): Promise<Release | null | undefined> => {
  try {
    return token ? await viaApi(fullName, token) : await viaPages(fullName);
  } catch {
    return undefined;
  }
};

/** Version affichée : « v » + numéro (« app-v2.5.0 » ou « 2.5.0 » → « v2.5.0 ») */
export const versionLabel = (tag: string) => {
  const n = /(?:^|[^a-z\d])v?(\d+(?:\.\d+)*(?:-[\w.]+)?)$/i.exec(tag)?.[1];
  return n ? `v${n}` : tag;
};
