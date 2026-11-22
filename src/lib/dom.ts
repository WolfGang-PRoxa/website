export const $ = <E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E | null =>
  root.querySelector<E>(selector);

export const $$ = <E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E[] => [
  ...root.querySelectorAll<E>(selector),
];

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { escapeHtml } from './repo-card';

/** Décode les entités HTML d'un texte (ex. « &amp; » → « & ») */
export const decodeHtml = (html: string): string => {
  const t = document.createElement('textarea');
  t.innerHTML = html;
  return t.value;
};
