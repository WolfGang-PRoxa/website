import { $, $$, decodeHtml, reduceMotion } from '../lib/dom';
import { getPath, i18n, loadDict } from '../lib/i18n';
import type { Dict } from '../types';

/* Bascule FR / EN sans recharger la page.
   Chaque page existe dans les deux langues (/fr/…, /en/…) pour le référencement et les liens
   directs : on remplace seulement les textes et on met l'adresse à jour.
   La page 404 est unique : elle prend la langue du visiteur, sans changer d'adresse. */

const SITE = 'https://romainpiau.dev';
const page = document.body.dataset.page || 'home';
const isNotFound = page === '404';
const LANG_PREFIX = /^\/(fr|en)\//;

// Textes de <head> propres à la page (les autres pages complètent ceux de l'accueil)
const pageMeta = (dict: Dict): Dict['meta'] => {
  const extra = { legal: (dict.legal as { meta?: object })?.meta, 404: (dict.notFound as { meta?: object })?.meta }[
    page
  ];
  return { ...dict.meta, ...(extra || {}) };
};

/** Chemin de la page courante dans une autre langue */
const pathIn = (lang: string) => location.pathname.replace(LANG_PREFIX, `/${lang}/`);

// Fondu flouté sur les textes qui changent
const fade = (els: Element[], out: boolean) =>
  Promise.all(
    els.map((el) =>
      el
        .animate(
          out
            ? [
                { opacity: 1, filter: 'blur(0)' },
                { opacity: 0, filter: 'blur(6px)' },
              ]
            : [
                { opacity: 0, filter: 'blur(6px)' },
                { opacity: 1, filter: 'blur(0)' },
              ],
          {
            duration: out ? 180 : 380,
            easing: out ? 'ease-in' : 'cubic-bezier(.22, 1, .36, 1)',
            fill: out ? 'forwards' : 'none',
          },
        )
        .finished.catch(() => undefined),
    ),
  );

const setMeta = (selector: string, attr: string, value: string) => $(selector)?.setAttribute(attr, value);

const applyDict = (lang: string, dict: Dict) => {
  const root = document.documentElement;
  root.lang = lang;
  $$('[data-i18n]').forEach((el) => {
    const v = getPath(dict, el.dataset.i18n!);
    if (typeof v === 'string') el.innerHTML = v;
  });
  $$('[data-i18n-aria]').forEach((el) => {
    const v = getPath(dict, el.dataset.i18nAria!);
    if (typeof v === 'string') el.setAttribute('aria-label', decodeHtml(v));
  });
  // Liens internes vers une page dans une langue (pied de page, 404…) : vers la même page dans la nouvelle langue
  $$<HTMLAnchorElement>('a[href^="/fr/"], a[href^="/en/"]').forEach((a) => {
    if (!a.closest('.lang-switch')) a.setAttribute('href', a.getAttribute('href')!.replace(LANG_PREFIX, `/${lang}/`));
  });
  const meta = pageMeta(dict);
  const title = decodeHtml(meta.title);
  const description = decodeHtml(meta.description);
  document.title = title;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:locale"]', 'content', meta.ogLocale);
  setMeta('meta[property="og:locale:alternate"]', 'content', meta.ogLocaleAlt);
  setMeta('meta[property="og:image"]', 'content', `${SITE}/og/${lang}.png`);
  setMeta('meta[property="og:image:alt"]', 'content', decodeHtml(meta.ogImageAlt));
  if (!isNotFound) {
    const url = `${SITE}${pathIn(lang)}`;
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('link[rel="canonical"]', 'href', url);
  }
  i18n.set(lang, dict); // met à jour les contenus dynamiques (dépôts…)
};

export const initLanguage = () => {
  const group = $('.lang-switch');
  const links = $$<HTMLAnchorElement>('.lang-switch a');
  const markActive = (lang: string) => {
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.lang === lang));
    if (group) group.dataset.active = lang; // la pastille glisse vers la langue choisie
  };

  const switchTo = async (link: HTMLAnchorElement, push: boolean, remember = true) => {
    const lang = link.dataset.lang!;
    if (lang === i18n.lang) return;
    if (remember) document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    markActive(lang);

    let dict: Dict;
    try {
      dict = await loadDict(lang);
    } catch {
      location.href = link.href; // secours : navigation classique
      return;
    }

    // On n'anime que les textes visibles à l'écran ; les autres changent directement
    const visible = $$('[data-i18n], [data-last-push], #repo-list').filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    if (!reduceMotion) await fade(visible, true);
    applyDict(lang, dict);
    if (push && !isNotFound) history.pushState({ lang }, '', `${pathIn(lang)}${location.hash}`);
    if (!reduceMotion) {
      await fade(visible, false);
      visible.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    }
  };

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nouvel onglet : comportement normal
      e.preventDefault();
      switchTo(link, true);
    });
    // Précharge le dictionnaire dès le survol pour un changement instantané
    link.addEventListener(
      'pointerenter',
      () => {
        if (link.dataset.lang !== i18n.lang) loadDict(link.dataset.lang!).catch(() => undefined);
      },
      { once: true },
    );
  });

  // Page 404 : dans la langue choisie auparavant, celle de l'adresse demandée ou celle du navigateur
  if (isNotFound) {
    const wanted =
      /(?:^|;\s*)lang=([a-z]{2})/.exec(document.cookie)?.[1] ||
      LANG_PREFIX.exec(location.pathname)?.[1] ||
      (navigator.language || '').slice(0, 2).toLowerCase();
    const link = links.find((l) => l.dataset.lang === wanted);
    if (link) switchTo(link, false, false);
  }

  // Boutons précédent / suivant du navigateur
  window.addEventListener('popstate', () => {
    const lang = LANG_PREFIX.exec(location.pathname)?.[1];
    const link = links.find((l) => l.dataset.lang === lang);
    if (link) switchTo(link, false);
  });
};
