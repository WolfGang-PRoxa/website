# romainpiau.dev

[![English](https://img.shields.io/badge/lang-English-2ea44f)](README.md)

Le code source de mon portfolio, en ligne sur **[romainpiau.dev](https://romainpiau.dev)**.

On y trouve mes projets phares et la liste de tous mes dépôts GitHub publics, synchronisée automatiquement. Le site existe en français et en anglais : la page d'accueil choisit la langue selon le pays du visiteur, avec l'anglais par défaut, et un bouton FR / EN permet d'en changer instantanément, sans recharger la page. Les pages `/fr/` et `/en/` restent de vraies pages générées à l'avance.

## Technique

- [Vite](https://vite.dev) et TypeScript, sans framework d'interface : les pages sont générées au build et le script reste léger.
- Les polices sont hébergées par le site, et chaque fichier généré porte une empreinte de son contenu dans son nom, ce qui permet de le garder en cache un an.
- Hébergé sur Cloudflare Pages, avec une Pages Function qui sert la bonne langue sur `/`.

## Organisation

| Chemin | Contenu |
| --- | --- |
| `src/template.html` | Modèle de page, avec des repères `{{ clé }}` pour les textes |
| `src/i18n/` | Traductions (`en.json`, `fr.json`) |
| `src/main.ts`, `src/modules/` | Scripts : thème, changement de langue, animations au défilement, dépôts… |
| `src/styles/` | Styles |
| `public/` | Fichiers servis tels quels : icônes, favicon, `robots.txt`, `sitemap.xml`, `llms.txt`, `_headers` |
| `scripts/pages.ts` | Plugin Vite : génère `/en/` et `/fr/` à partir du modèle et récupère mes dépôts publics |
| `functions/index.ts` | Choisit la langue de `/` (choix FR / EN d'abord, puis pays, anglais par défaut) |
| `Web Sites/` | Mes anciens sites, gardés pour mémoire et qui ne sont plus publiés |

## Lancer en local

Nécessite Node.js 22.

```sh
npm install
npm run dev      # serveur de développement avec rechargement automatique
npm run build    # build de production dans dist/
npm run preview  # sert le build
```

Le serveur de développement répond sur `/fr/` et `/en/`. La détection automatique de la langue ne fonctionne que sur Cloudflare.

## Déploiement

Chaque push sur `main` est déployé automatiquement sur Cloudflare Pages, et chaque autre branche a sa propre adresse d'aperçu.

| Réglage | Valeur |
| --- | --- |
| Framework preset | None |
| Build command | `sh build.sh` |
| Build output directory | `dist` |
| Root directory | *(vide)* |

## Ajouter une langue

Ajouter `src/i18n/<code>.json` avec les mêmes clés que `en.json`, ajouter un lien dans le sélecteur de langue de `src/template.html`, puis déclarer le code dans `LANGS` (et ses pays) dans `functions/index.ts`.
