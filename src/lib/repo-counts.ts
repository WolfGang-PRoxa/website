// Nombre de dépôts GitHub : publics pour tout le monde, privés seulement avec un jeton
// du compte (variable GITHUB_TOKEN). Sert au build (Node) et à la Function /api/profile.
import type { ClientDict } from '../types.ts';

export interface RepoCounts {
  public: number;
  /** `null` : inconnu (pas de jeton, ou jeton d'un autre compte) */
  private: number | null;
  /** État du jeton GitHub (diagnostic) */
  auth?: string;
}

interface GithubUser {
  login: string;
  public_repos: number;
  owned_private_repos?: number;
  total_private_repos?: number;
}

const get = async <T = GithubUser>(url: string, token?: string): Promise<T> => {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'romainpiau.dev',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
};

/** Dépôts privés du compte, comptés un par un (si le profil ne donne pas le total) */
const countPrivate = async (token: string): Promise<number> => {
  let n = 0;
  for (let page = 1; page <= 10; page++) {
    const list = await get<unknown[]>(`https://api.github.com/user/repos?visibility=private&affiliation=owner&per_page=100&page=${page}`, token);
    n += list.length;
    if (list.length < 100) break;
  }
  return n;
};

/** `null` si GitHub ne répond pas */
export const repoCounts = async (user: string, token?: string): Promise<RepoCounts | null> => {
  // `auth` dit pourquoi les dépôts privés manquent (sans jamais exposer le jeton)
  let auth = token ? 'ok' : 'sans jeton';
  if (token) {
    try {
      // GET /user : profil complet du propriétaire du jeton, avec ses dépôts privés
      const me = await get('https://api.github.com/user', token);
      if (me.login.toLowerCase() === user.toLowerCase()) {
        let priv = me.owned_private_repos ?? me.total_private_repos ?? null;
        if (priv === null) {
          try { priv = await countPrivate(token); } catch (err) { auth = `liste des dépôts privés refusée (${(err as Error).message})`; }
        }
        return { public: me.public_repos, private: priv, auth };
      }
      auth = `jeton d'un autre compte (${me.login})`;
    } catch (err) {
      auth = `jeton refusé (${(err as Error).message})`;
    }
  }
  try {
    const profile = await get(`https://api.github.com/users/${user}`);
    return { public: profile.public_repos, private: null, auth };
  } catch {
    return null;
  }
};

const plural = (forms: { one: string; other: string } | undefined, n: number) =>
  // espace insécable : « 15 privés » ne se coupe pas, seule la séparation « · » peut passer à la ligne
  (forms ? (n === 1 ? forms.one : forms.other).replace('{n}', String(n)) : String(n)).replace(/ /g, '\u00a0');

/** Total affiché en grand */
export const repoTotal = (c: RepoCounts | null) => (c ? String(c.public + (c.private ?? 0)) : '–');

/** Détail sous le total : « 6 publics · 15 privés » */
export const repoSplit = (c: RepoCounts | null, t: ClientDict) => {
  if (!c) return '';
  const parts = [plural(t.repoCounts?.public, c.public)];
  if (c.private !== null) parts.push(plural(t.repoCounts?.private, c.private));
  return parts.join(' · ');
};
