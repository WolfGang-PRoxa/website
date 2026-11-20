// GET /api/repos : dépôts GitHub publics, à jour à l'heure près sans redéployer le site.
// Les icônes et releases connues au build (data/repos.json) sont reprises ; la dernière release
// n'est redemandée que pour les dépôts modifiés depuis (au plus MAX_RELEASE_CHECKS, car une
// Function a un nombre limité de requêtes). Si GitHub ne répond pas (panne, limite de requêtes),
// on renvoie la liste du dernier build.
// Jeton facultatif : variable secrète GITHUB_TOKEN du projet Pages (5 000 requêtes / heure au lieu de 60).

import { latestRelease } from '../../src/lib/releases.ts';
import { slimRepo } from '../../src/lib/repo-card.ts';
import type { Repo } from '../../src/types.ts';

const GITHUB_USER = 'WolfGang-PRoxa';
const TTL = 3600; // secondes
const MAX_RELEASE_CHECKS = 15;

interface Env {
  ASSETS: { fetch: (input: URL | Request | string) => Promise<Response> };
  GITHUB_TOKEN?: string;
}

interface Context {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

const json = (body: string, cache: string, status = 200) => new Response(body, {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
});

/** Liste du dernier build, et sa version (ETag du fichier) pour la clé de cache */
const staticList = async (env: Env, url: string): Promise<{ list: Repo[]; version: string }> => {
  try {
    const res = await env.ASSETS.fetch(new URL('/data/repos.json', url));
    if (!res.ok) return { list: [], version: '' };
    return { list: (await res.json()) as Repo[], version: res.headers.get('etag') ?? '' };
  } catch {
    return { list: [], version: '' };
  }
};

export const onRequestGet = async ({ request, env, waitUntil }: Context): Promise<Response> => {
  // Clé de cache propre à chaque build : un nouveau déploiement s'applique tout de suite
  const { list: built, version } = await staticList(env, request.url);
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(`/api/repos?build=${encodeURIComponent(version)}`, request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'romainpiau.dev',
        ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const before = new Map(built.map((r) => [r.name, r]));
    const repos = ((await res.json()) as Repo[])
      .filter((r) => !r.fork && !r.private && !r.archived)
      .map((r) => {
        const old = before.get(r.name);
        return { ...slimRepo(r), icon: old?.icon ?? null, release: old?.release };
      });
    if (!repos.length) throw new Error('liste vide');

    // Dépôts modifiés depuis le build (ou inconnus) : leur release a pu changer
    const changed = repos
      .filter((r) => before.get(r.name)?.pushed_at !== r.pushed_at || r.release === undefined)
      .slice(0, MAX_RELEASE_CHECKS);
    await Promise.all(changed.map(async (r) => {
      const release = await latestRelease(r.full_name, env.GITHUB_TOKEN);
      if (release !== undefined) r.release = release;
    }));

    const response = json(JSON.stringify(repos), `public, max-age=600, s-maxage=${TTL}`);
    waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (err) {
    if (built.length) return json(JSON.stringify(built), 'public, max-age=300');
    return json(JSON.stringify({ error: (err as Error).message }), 'no-store', 502);
  }
};
