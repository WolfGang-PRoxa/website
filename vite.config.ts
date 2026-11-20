import { defineConfig } from 'vite';
import sitePages from './scripts/pages.ts';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  plugins: [
    sitePages({
      src: 'src',
      site: 'https://romainpiau.dev',
      defaultLang: 'en',
      githubUser: 'WolfGang-PRoxa',
      iconsDir: 'public/icons',
      featured: {
        mm: { repo: 'minecraft-modding-manager', fallback: 'v2.5.0' },
        ula: { repo: 'universal-learn-academy', fallback: 'v2.6.1' },
        imp: { repo: 'interactive-music-player', fallback: 'v0.0.1' },
      },
    }),
  ],
});
