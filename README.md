# romainpiau.dev 

[![Français](https://img.shields.io/badge/langue-Fran%C3%A7ais-0366d6)](README.fr.md)

The source code of my portfolio, live at **[romainpiau.dev](https://romainpiau.dev)**.

It showcases my featured projects and lists all my public GitHub repositories, which stay in sync automatically. The site is available in English and French: the home page picks the language from the visitor's country and falls back to English, and a FR / EN switch lets visitors change it instantly, without reloading the page. Both `/en/` and `/fr/` remain real, pre-rendered pages.

## Tech

- [Vite](https://vite.dev) and TypeScript, with no UI framework: the pages are pre-rendered at build time and the script stays small.
- Fonts are self-hosted, and every built file has a content hash in its name, so it can be cached for a year.
- Hosted on Cloudflare Pages, with a Pages Function that serves the right language on `/`.

## Project structure

| Path | Contents |
| --- | --- |
| `src/template.html` | Page template, with `{{ key }}` placeholders for the text |
| `src/i18n/` | Translations (`en.json`, `fr.json`) |
| `src/main.ts`, `src/modules/` | Scripts: theme, language switch, scroll animations, repositories… |
| `src/styles/` | Styles |
| `public/` | Files served as is: icons, favicon, `robots.txt`, `sitemap.xml`, `llms.txt`, `_headers` |
| `scripts/pages.ts` | Vite plugin: renders `/en/` and `/fr/` from the template and fetches my public repositories |
| `functions/index.ts` | Picks the language for `/` (FR / EN choice first, then country, English by default) |
| `Web Sites/` | My earlier websites, kept for reference and no longer published |

## Run it locally

Requires Node.js 22.

```sh
npm install
npm run dev      # development server with live reload
npm run build    # production build in dist/
npm run preview  # serve the build
```

The dev server opens on `/en/` and `/fr/`. The automatic language detection only runs on Cloudflare.

## Deployment

Every push to `main` is deployed to Cloudflare Pages automatically, and every other branch gets its own preview URL.

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `sh build.sh` |
| Build output directory | `dist` |
| Root directory | *(empty)* |

## Adding a language

Add `src/i18n/<code>.json` with the same keys as `en.json`, add a link to the language switch in `src/template.html`, then list the code in `LANGS` (and its countries) in `functions/index.ts`.
