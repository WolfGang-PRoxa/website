// GET /api/contributions : calendrier des contributions GitHub de l'année écoulée.
// GitHub ne propose pas d'API publique sans jeton pour ce calendrier : on lit la page
// publique du profil côté serveur, et on garde le résultat en cache une heure.

const GITHUB_USER = 'WolfGang-PRoxa';
const TTL = 3600; // secondes

interface Day {
  date: string; // AAAA-MM-JJ
  count: number;
  level: number; // 0 à 4, comme sur GitHub
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

export const parseContributions = (html: string) => {
  // Nombre de contributions de chaque case, dans les infobulles
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^([\d,]+) contribution/.exec(m[2].trim());
    counts.set(m[1], n ? Number(n[1].replace(/,/g, '')) : 0);
  }

  const days: Day[] = [];
  for (const [tag] of html.matchAll(/<td\b[^>]*\bContributionCalendar-day\b[^>]*>/g)) {
    const date = attr(tag, 'data-date');
    if (!date) continue;
    const id = attr(tag, 'id') ?? '';
    days.push({ date, level: Number(attr(tag, 'data-level') ?? 0), count: counts.get(id) ?? 0 });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const heading = /([\d,]+)\s+contributions?\s+in the last year/.exec(html);
  const total = heading ? Number(heading[1].replace(/,/g, '')) : days.reduce((sum, d) => sum + d.count, 0);
  return { total, days };
};

interface Context {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

export const onRequestGet = async ({ request, waitUntil }: Context): Promise<Response> => {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL('/api/contributions', request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;

  try {
    const res = await fetch(`https://github.com/users/${GITHUB_USER}/contributions`, {
      headers: { 'User-Agent': 'romainpiau.dev', Accept: 'text/html' },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = parseContributions(await res.text());
    if (!data.days.length) throw new Error('calendrier introuvable');

    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${TTL}`,
      },
    });
    waitUntil(cache.put(key, response.clone()));
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
