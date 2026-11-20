// GET /api/profile : nombre de dépôts GitHub (publics et privés), à jour à l'heure près.
// Les dépôts privés ne sont comptés qu'avec la variable secrète GITHUB_TOKEN du projet Pages
// (jeton du compte WolfGang-PRoxa). Si GitHub ne répond pas, on renvoie les chiffres du dernier build.

import { repoCounts, type RepoCounts } from '../../src/lib/repo-counts.ts';

const GITHUB_USER = 'WolfGang-PRoxa';
const TTL = 3600; // secondes

interface Env {
  ASSETS: { fetch: (input: URL | Request | string) => Promise<Response> };
  GITHUB_TOKEN?: string;
}

interface Context {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

const json = (body: unknown, cache: string, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
});

interface Built { repos: RepoCounts | null; at?: string }

const built = async (env: Env, url: string): Promise<Built> => {
  try {
    const res = await env.ASSETS.fetch(new URL('/data/profile.json', url));
    return res.ok ? ((await res.json()) as Built) : { repos: null };
  } catch {
    return { repos: null };
  }
};

export const onRequestGet = async ({ request, env, waitUntil }: Context): Promise<Response> => {
  // Clé de cache propre à chaque déploiement : un nouveau build (ou un secret ajouté) s'applique tout de suite
  const fromBuild = await built(env, request.url);
  const old = fromBuild.repos;
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(`/api/profile?build=${encodeURIComponent(fromBuild.at ?? '')}`, request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;

  const live = await repoCounts(GITHUB_USER, env.GITHUB_TOKEN);
  if (!live) {
    return old ? json({ repos: old }, 'public, max-age=300') : json({ error: 'GitHub indisponible' }, 'no-store', 502);
  }
  // Sans jeton, le nombre de dépôts privés connu au build reste affiché
  const repos: RepoCounts = { public: live.public, private: live.private ?? old?.private ?? null, auth: live.auth };
  const response = json({ repos }, `public, max-age=600, s-maxage=${TTL}`);
  waitUntil(cache.put(key, response.clone()));
  return response;
};
