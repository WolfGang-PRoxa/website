# romainpiau.dev

[![English](https://img.shields.io/badge/lang-English-2ea44f)](README.md)

Le code source de mon portfolio, en ligne sur **[romainpiau.dev](https://romainpiau.dev)**.

On y trouve mes projets phares et la liste de tous mes dépôts GitHub publics, synchronisée automatiquement. Le site existe en français et en anglais : la page d'accueil choisit la langue selon le pays du visiteur, avec l'anglais par défaut, et un bouton FR / EN permet d'en changer instantanément, sans recharger la page. Les pages `/fr/` et `/en/` restent de vraies pages générées à l'avance.

## Technique

- [Vite](https://vite.dev) et TypeScript, sans framework d'interface : les pages sont générées au build et le script reste léger.
- Les polices sont hébergées par le site, et chaque fichier généré porte une empreinte de son contenu dans son nom, ce qui permet de le garder en cache un an.
- Hébergé sur Cloudflare Pages, avec des Pages Functions pour la langue de `/`, les redirections et les données GitHub à jour.
- Les dépôts sont écrits dans la page au build : ils s'affichent même sans JavaScript, puis se mettent à jour en direct.
- En-têtes de sécurité stricts (HSTS, CSP avec l'empreinte des scripts en ligne, calculée au build).

## Organisation

| Chemin                                    | Contenu                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/`                              | Pages (`home`, `legal`, `404`) et mise en page commune (`_layout.html`), avec des repères `{{ clé }}` pour les textes                     |
| `src/partials/`                           | Morceaux communs : `<head>`, barre de navigation, pied de page                                                                            |
| `src/i18n/`                               | Traductions (`en.json`, `fr.json`)                                                                                                        |
| `src/main.ts`, `src/modules/`, `src/lib/` | Scripts : thème, changement de langue, menu, animations au défilement, dépôts…                                                            |
| `src/styles/`                             | Styles                                                                                                                                    |
| `public/`                                 | Fichiers servis tels quels : icônes, images de partage, `robots.txt`, `llms.txt`, `_headers`, `_routes.json`                              |
| `scripts/pages.ts`                        | Plugin Vite : génère les pages dans chaque langue, y écrit mes dépôts publics et les versions des projets, puis le plan du site et la CSP |
| `functions/index.ts`                      | Choisit la langue de `/` (choix FR / EN d'abord, puis pays, anglais par défaut)                                                           |
| `functions/_middleware.ts`                | Redirige `www.romainpiau.dev` et `romainpiau.pages.dev` vers `romainpiau.dev`                                                             |
| `functions/api/`                          | `/api/repos` (dépôts à jour à l'heure près) et `/api/contributions` (calendrier GitHub)                                                   |

## Lancer en local

Nécessite Node.js 22.

```sh
npm install
npm run dev      # serveur de développement avec rechargement automatique
npm run build    # build de production dans dist/
npm run preview  # sert le build
npm run format   # formate le code avec Prettier
npm run lint     # analyse le code avec ESLint
npm run check    # vérifications Prettier, ESLint et TypeScript (lancées par la CI à chaque push)
```

Le serveur de développement répond sur `/fr/` et `/en/`. La détection automatique de la langue ne fonctionne que sur Cloudflare.

## Déploiement

Chaque push sur `main` est déployé automatiquement sur Cloudflare Pages, et chaque autre branche a sa propre adresse d'aperçu.

| Réglage                | Valeur        |
| ---------------------- | ------------- |
| Framework preset       | None          |
| Build command          | `sh build.sh` |
| Build output directory | `dist`        |
| Root directory         | _(vide)_      |

Le projet Pages doit être relié à ce dépôt (Settings › Builds › Git repository). Si le dépôt est recréé, il faut le relier à nouveau : le prochain push relance alors les builds.

## Variable facultative

`GITHUB_TOKEN` (build et Functions) : un jeton GitHub du compte WolfGang-PRoxa, en lecture seule. Il évite la limite de 60 requêtes par heure de l'API publique et permet d'afficher le nombre de dépôts privés (`/api/profile`) ; sans lui, seuls les dépôts publics sont comptés. Un secret ajouté ou modifié ne sert qu'à partir du déploiement suivant. À ajouter comme secret dans Settings › Variables and Secrets, pour la production et les aperçus.

## Ajouter une langue

Ajouter `src/i18n/<code>.json` avec les mêmes clés que `en.json`, ajouter un lien dans le sélecteur de langue de `src/partials/nav.html`, déclarer le code dans `LANGS` (et ses pays) dans `functions/index.ts`, puis l'ajouter à `public/_routes.json` et à `LANG_PREFIX` dans `src/modules/language.ts`.

## Licence

Le code est sous [licence MIT](LICENSE). Les textes et visuels restent les miens.
