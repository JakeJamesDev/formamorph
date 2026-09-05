/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

/**
 * The formamorph.ai account pages: a second entry, separate from the game bundle.
 *
 * It reuses `src/` through the same `@` alias — AuthService, the shadcn primitives, the shared types —
 * but never imports a game view, so a visitor opening /login downloads a login page rather than the app.
 * The deploy lays its output over the tracked hosting directory at /site-app/, and `hosting/_redirects`
 * rewrites the account routes onto its index.html.
 */
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: 'site',
  // Absolute for the build, because a nested route such as /u/<username> is served the same index.html
  // and a relative asset URL would resolve one level too deep. The dev server keeps '/' so the routes
  // are reachable at the paths they ship at.
  base: command === 'build' ? '/site-app/' : '/',
  // The tracked hosting directory holds the site's public files. The deploy lays it over the build, so
  // the build must copy none of it — but the dev server serves it, so /site/icon.png and the landing
  // page itself resolve locally exactly as they do live.
  publicDir: command === 'build' ? false : path.resolve(__dirname, 'hosting'),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TARGET__: JSON.stringify(process.env.FORMAMORPH_BUILD ?? ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Its own Tailwind config, scanned over the site entry rather than all of `src/`. The root
  // postcss.config.js would otherwise put every class the game uses into a login page's stylesheet.
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(__dirname, 'tailwind.site.config.js') }),
        autoprefixer(),
      ],
    },
  },
  server: {
    // Same seam as the game config: the e2e runner sets BASELINE_NO_WATCH so a save elsewhere in the tree
    // cannot reload the page under a running spec.
    ...(process.env.BASELINE_NO_WATCH ? { hmr: false, watch: null } : {}),
  },
  build: {
    outDir: path.resolve(__dirname, 'site-dist'),
    emptyOutDir: true,
  },
}))
