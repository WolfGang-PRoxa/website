/** Textes utilisés par le script (clé « client » de src/i18n/<langue>.json) */
export interface ClientDict {
  locale: string;
  other: string;
  noDescription: string;
  error: string;
  errorLink: string;
  /** Calendrier des contributions ({n} = nombre) */
  contrib?: { one: string; other: string; none: string; total: string };
  /** Titre et description affichés à la place de ceux de GitHub */
  repos: Record<string, { title?: string; description?: string }>;
}

/** Dictionnaire complet d'une langue */
export interface Dict {
  meta: { title: string; description: string; ogLocale: string };
  client: ClientDict;
  [section: string]: unknown;
}

/** Dépôt tel que renvoyé par l'API GitHub (champs utilisés) */
export interface Repo {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  private: boolean;
  archived: boolean;
  icon?: string | null;
}
