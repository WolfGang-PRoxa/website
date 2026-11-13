#!/bin/sh
# Build Cloudflare Pages : dépendances (si besoin) puis Vite
set -eu
[ -d node_modules/vite ] || npm ci --no-audit --no-fund
npm run build
