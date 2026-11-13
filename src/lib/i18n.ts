import type { ClientDict, Dict } from '../types';

// Textes de la langue de la page, injectés au build dans <script id="i18n-data">
const readInitial = (): ClientDict => {
  try {
    return JSON.parse(document.getElementById('i18n-data')?.textContent || '{}') as ClientDict;
  } catch {
    return {} as ClientDict;
  }
};

let lang = document.documentElement.lang || 'en';
let client = readInitial();
const listeners = new Set<() => void>();

export const i18n = {
  get lang() { return lang; },
  get t() { return client; },
  get locale() { return client.locale || lang; },
  /** Appelé après chaque changement de langue */
  onChange(fn: () => void) { listeners.add(fn); },
  set(next: string, dict: Dict) {
    lang = next;
    client = dict.client;
    listeners.forEach((fn) => fn());
  },
};

// Chaque dictionnaire devient un petit fichier chargé seulement si on change de langue
const loaders = import.meta.glob<Dict>('../i18n/*.json', { import: 'default' });
const cache = new Map<string, Promise<Dict>>();

export const loadDict = (code: string): Promise<Dict> => {
  const loader = loaders[`../i18n/${code}.json`];
  if (!loader) return Promise.reject(new Error(`Langue inconnue : ${code}`));
  if (!cache.has(code)) cache.set(code, loader());
  return cache.get(code)!;
};

export const getPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
