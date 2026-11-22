# romainpiau.dev

[![Français](https://img.shields.io/badge/langue-Fran%C3%A7ais-0366d6)](README.fr.md)

The source code of my portfolio, live at **[romainpiau.dev](https://romainpiau.dev)**.

It showcases my featured projects and lists all my public GitHub repositories, which stay in sync automatically. The site is available in English and French: the home page picks the language from the visitor's country and falls back to English, and a FR / EN switch lets visitors change it instantly, without reloading the page. Both `/en/` and `/fr/` remain real, pre-rendered pages.

## Tech

- [Vite](https://vite.dev) and TypeScript, with no UI framework: the pages are pre-rendered at build time and the script stays small.
- Fonts are self-hosted, and every built file has a content hash in its name, so it can be cached for a year.
- Hosted on Cloudflare Pages, with Pages Functions for the language on `/`, redirects and fresh GitHub data.
- Repositories are written into the page at build time: they show up even without JavaScript, then refresh live.
- Strict security headers (HSTS, and a CSP with the hashes of inline scripts, computed at build time).

## Project structure

| Path                                      | Contents                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/`                              | Pages (`home`, `legal`, `404`) and the shared layout (`_layout.html`), with `{{ key }}` placeholders for the text                      |
| `src/partials/`                           | Shared pieces: `<head>`, navigation bar, footer                                                                                        |
| `src/i18n/`                               | Translations (`en.json`, `fr.json`)                                                                                                    |
| `src/main.ts`, `src/modules/`, `src/lib/` | Scripts: theme, language switch, menu, scroll animations, repositories…                                                                |
| `src/styles/`                             | Styles                                                                                                                                 |
| `public/`                                 | Files served as is: icons, social images, `robots.txt`, `llms.txt`, `_headers`, `_routes.json`                                         |
| `scripts/pages.ts`                        | Vite plugin: renders every page in each language with my public repositories and project versions, then writes the sitemap and the CSP |
| `functions/index.ts`                      | Picks the language for `/` (FR / EN choice first, then country, English by default)                                                    |
| `functions/_middleware.ts`                | Redirects `www.romainpiau.dev` and `romainpiau.pages.dev` to `romainpiau.dev`                                                          |
| `functions/api/`                          | `/api/repos` (repositories, refreshed hourly) and `/api/contributions` (GitHub calendar)                                               |

## Run it locally

Requires Node.js 22.

```sh
npm install
npm run dev      # development server with live reload
npm run build    # production build in dist/
npm run preview  # serve the build
npm run format   # format the code with Prettier
npm run lint     # lint with ESLint
npm run check    # Prettier, ESLint and TypeScript checks (run by the CI on every push)
```

The dev server opens on `/en/` and `/fr/`. The automatic language detection only runs on Cloudflare.

## Deployment

Every push to `main` is deployed to Cloudflare Pages automatically, and every other branch gets its own preview URL.

| Setting                | Value         |
| ---------------------- | ------------- |
| Framework preset       | None          |
| Build command          | `sh build.sh` |
| Build output directory | `dist`        |
| Root directory         | _(empty)_     |

The Pages project must be linked to this repository (Settings › Builds › Git repository). If the repository is recreated, link it again: the next push starts the builds again.

## Optional variable

`GITHUB_TOKEN` (build and Functions): a read-only GitHub token of the WolfGang-PRoxa account. It avoids the public API limit of 60 requests per hour and lets the site show the number of private repositories (`/api/profile`); without it, only public repositories are counted. A new or changed secret only applies from the next deployment. Add it as a secret in Settings › Variables and Secrets, for production and previews.

## Adding a language

Add `src/i18n/<code>.json` with the same keys as `en.json`, add a link to the language switch in `src/partials/nav.html`, list the code in `LANGS` (and its countries) in `functions/index.ts`, then add it to `public/_routes.json` and to `LANG_PREFIX` in `src/modules/language.ts`.

## License

The code is under the [MIT license](LICENSE). The text and visuals remain mine.
