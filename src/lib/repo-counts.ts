// Nombre de dépôts GitHub : publics pour tout le monde, privés seulement avec un jeton
// du compte (variable GITHUB_TOKEN). Sert au build (Node) et à la Function /api/profile.
import type { ClientDict } from '../types.ts';

export interface RepoCounts {
  public: number;
  /** `null` : inconnu (pas de jeton, ou jeton d'un autre compte) */
  private: number | null;
}

interface GithubUser {
  login: string;
  public_repos: number;
  owned_private_repos?: number;
  total_private_repos?: number;
}

const get = async (url: string, token?: string): Promise<GithubUser> => {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'romainpiau.dev',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as GithubUser;
};

/** `null` si GitHub ne répond pas */
export const repoCounts = async (user: string, token?: string): Promise<RepoCounts | null> => {
  try {
    if (token) {
      // GET /user : profil complet du propriétaire du jeton, avec ses dépôts privés
      const me = await get('https://api.github.com/user', token);
      if (me.login.toLowerCase() === user.toLowerCase()) {
        return { public: me.public_repos, private: me.owned_private_repos ?? me.total_private_repos ?? null };
      }
    }
    const profile = await get(`https://api.github.com/users/${user}`, token);
    return { public: profile.public_repos, private: null };
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
