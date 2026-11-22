# Journal des modifications

[English](CHANGELOG.md)

Toutes les modifications notables du projet sont consignées dans ce fichier.
Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/spec/v2.0.0.html).

## [Unreleased]

### Ajouts

- Prettier et ESLint, avec `npm run format`, `npm run lint` et `npm run check` (vérifications Prettier, ESLint et TypeScript).

### Améliorations

- TypeScript 6.0 au lieu de 7.0, car typescript-eslint ne prend pas encore en charge TypeScript 7.

## [2.0.0] - 2026-11-22

Refonte complète du site, reconstruit de zéro avec Vite et TypeScript.

### Ajouts

- Nouveau design moderne avec animations au défilement, thème clair / sombre et mise en page adaptée du téléphone aux grands écrans.
- Section des projets principaux : Minecraft Modding Manager, Universal Learn Academy et Interactive Music Player, avec leur icône, leur dernière version et un bouton Télécharger pour chaque projet qui a une release.
- Liste de tous les dépôts GitHub publics, écrite dans la page au build et rafraîchie en direct (`/api/repos`).
- Héros avec les années de code et le nombre de dépôts publics et privés (`/api/profile`), et calendrier des contributions GitHub (`/api/contributions`).
- Versions anglaise et française : `/` choisit la langue selon le pays du visiteur (anglais par défaut), et un bouton FR / EN en change instantanément sans recharger. `/en/` et `/fr/` restent de vraies pages générées à l'avance.
- Sections Stack et Contact, page des mentions légales et page 404.
- Référencement : sitemap, images de partage, `robots.txt` et `llms.txt` ; `www.romainpiau.dev` et `romainpiau.pages.dev` redirigent vers `romainpiau.dev`.
- En-têtes de sécurité stricts (HSTS, et une CSP avec les empreintes des scripts en ligne, calculées au build).

### Améliorations

- Hébergement déplacé de Netlify vers Cloudflare Pages, avec les Pages Functions.
- Les polices sont hébergées par le site et chaque fichier généré porte une empreinte de son contenu dans son nom, ce qui permet de le garder en cache un an.
- Accessibilité améliorée (lien d'évitement, libellés, navigation au clavier, animations réduites).

### Suppressions

- L'ancien design et son code.
