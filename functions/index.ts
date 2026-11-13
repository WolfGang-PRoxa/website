// Page d'accueil « / » : sert la version française ou anglaise selon le pays
// du visiteur (adresse IP, fournie par Cloudflare), anglais par défaut.
// Un choix fait avec le bouton FR / EN (cookie « lang ») passe avant le pays.

const LANGS = ['fr', 'en'];
const DEFAULT_LANG = 'en';

// Pays (codes ISO) où le site s'affiche en français
const FRENCH_COUNTRIES = new Set([
  'FR', 'BE', 'CH', 'LU', 'MC', 'AD',
  // Outre-mer
  'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'PF', 'WF',
  // Afrique et océan Indien francophones
  'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GN', 'CM', 'GA', 'CG', 'CD',
  'CF', 'TD', 'DJ', 'KM', 'MG', 'BI', 'RW', 'SC', 'MU', 'MA', 'DZ', 'TN', 'MR',
  // Caraïbes
  'HT',
]);

interface Env {
  ASSETS: { fetch: (input: URL | Request | string) => Promise<Response> };
}

interface Context {
  request: Request & { cf?: { country?: string; regionCode?: string } };
  env: Env;
}

const pickLang = (request: Context['request']): string => {
  const cookie = request.headers.get('Cookie') || '';
  const chosen = /(?:^|;\s*)lang=([a-z]{2})/.exec(cookie)?.[1];
  if (chosen && LANGS.includes(chosen)) return chosen;

  const cf = request.cf || {};
  const country = cf.country || request.headers.get('CF-IPCountry') || '';
  if (FRENCH_COUNTRIES.has(country)) return 'fr';
  if (country === 'CA' && cf.regionCode === 'QC') return 'fr'; // Québec
  return DEFAULT_LANG;
};

export const onRequestGet = async ({ request, env }: Context): Promise<Response> => {
  const lang = pickLang(request);
  const page = await env.ASSETS.fetch(new URL(`/${lang}/`, request.url));
  const response = new Response(page.body, page);
  response.headers.set('Content-Language', lang);
  response.headers.set('Vary', 'Cookie, CF-IPCountry');
  response.headers.set('Cache-Control', 'private, no-cache');
  return response;
};
