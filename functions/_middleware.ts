// Une seule adresse pour le site : www.romainpiau.dev et romainpiau.pages.dev redirigent
// vers romainpiau.dev (même chemin), pour ne pas disperser le référencement.
// Les aperçus des branches (<branche>.romainpiau.pages.dev) ne sont pas touchés.
// Ne tourne que sur les pages HTML et /api/* (voir public/_routes.json).

const CANONICAL_HOST = 'romainpiau.dev';
const ALIASES = new Set(['www.romainpiau.dev', 'romainpiau.pages.dev']);

interface Context {
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  if (ALIASES.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return next();
};
