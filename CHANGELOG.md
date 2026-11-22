# Changelog

[Français](CHANGELOG.fr.md)

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Prettier and ESLint, with `npm run format`, `npm run lint` and `npm run check` (Prettier, ESLint and TypeScript checks).
- Continuous integration: GitHub Actions runs `npm run check` and `npm run build` on every push and pull request.

### Changed

- TypeScript 6.0 instead of 7.0, because typescript-eslint does not support TypeScript 7 yet.

## [2.0.0] - 2026-11-22

Complete redesign of the site, rebuilt from scratch with Vite and TypeScript.

### Added

- New modern design with scroll animations, a light / dark theme and a layout that adapts from phones to large screens.
- Main projects section: Minecraft Modding Manager, Universal Learn Academy and Interactive Music Player, with their icons, latest version and a Download button for each project that has a release.
- List of all public GitHub repositories, written into the page at build time and refreshed live (`/api/repos`).
- Hero with years of coding and the number of public and private repositories (`/api/profile`), plus the GitHub contribution calendar (`/api/contributions`).
- English and French versions: `/` picks the language from the visitor's country (English by default), and a FR / EN switch changes it instantly without reloading. `/en/` and `/fr/` remain real pre-rendered pages.
- Stack and contact sections, legal notice page and 404 page.
- SEO: sitemap, social images, `robots.txt` and `llms.txt`; `www.romainpiau.dev` and `romainpiau.pages.dev` redirect to `romainpiau.dev`.
- Strict security headers (HSTS, and a CSP with the hashes of inline scripts computed at build time).

### Changed

- Hosting moved from Netlify to Cloudflare Pages, with Pages Functions.
- Fonts are self-hosted and every built file has a content hash in its name, so it can be cached for a year.
- Accessibility improvements (skip link, labels, keyboard navigation, reduced motion).

### Removed

- The previous design and its code.
