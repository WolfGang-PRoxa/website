import { $, $$, decodeHtml, reduceMotion } from '../lib/dom';
import { getPath, i18n, loadDict } from '../lib/i18n';
import type { Dict } from '../types';

/* Bascule FR / EN sans recharger la page.
   Les deux pages /fr/ et /en/ existent toujours (référencement, liens directs) : on remplace
   seulement les textes et on met l'adresse à jour. */

const SITE = 'https://romainpiau.dev';

// Fondu flouté sur les textes qui changent
const fade = (els: Element[], out: boolean) =>
  Promise.all(els.map((el) => el.animate(
    out
      ? [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)' }]
      : [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }],
    { duration: out ? 180 : 380, easing: out ? 'ease-in' : 'cubic-bezier(.22, 1, .36, 1)', fill: out ? 'forwards' : 'none' },
  ).finished.catch(() => undefined)));

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
  const title = decodeHtml(dict.meta.title);
  const description = decodeHtml(dict.meta.description);
  const url = `${SITE}/${lang}/`;
  document.title = title;
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:locale"]', 'content', dict.meta.ogLocale);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('link[rel="canonical"]', 'href', url);
  i18n.set(lang, dict); // met à jour les contenus dynamiques (dépôts…)
};

export const initLanguage = () => {
  const group = $('.lang-switch');
  const links = $$<HTMLAnchorElement>('.lang-switch a');
  const markActive = (lang: string) => {
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.lang === lang));
    if (group) group.dataset.active = lang; // la pastille glisse vers la langue choisie
  };

  const switchTo = async (link: HTMLAnchorElement, push: boolean) => {
    const lang = link.dataset.lang!;
    if (lang === i18n.lang) return;
    document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
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
    if (push) history.pushState({ lang }, '', `/${lang}/${location.hash}`);
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
    link.addEventListener('pointerenter', () => {
      if (link.dataset.lang !== i18n.lang) loadDict(link.dataset.lang!).catch(() => undefined);
    }, { once: true });
  });

  // Boutons précédent / suivant du navigateur
  window.addEventListener('popstate', () => {
    const lang = /^\/([a-z]{2})\//.exec(location.pathname)?.[1];
    const link = links.find((l) => l.dataset.lang === lang);
    if (link) switchTo(link, false);
  });
};
