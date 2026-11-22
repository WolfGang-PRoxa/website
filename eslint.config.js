// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    // Dossiers et pages générés (voir .gitignore)
    ignores: ['node_modules/', 'dist/', 'out/', 'release/', '.wrangler/', 'src/en/', 'src/fr/', 'src/404.html'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Site : code exécuté dans le navigateur
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Outils de build (plugin Vite, config) : Node
    files: ['scripts/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Cloudflare Pages Functions : environnement Workers
    files: ['functions/**/*.ts'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
);
