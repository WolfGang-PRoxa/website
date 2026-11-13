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
      defaultLang: 'en',
      githubUser: 'WolfGang-PRoxa',
      iconsDir: 'public/icons',
    }),
  ],
});
