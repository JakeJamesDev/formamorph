/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  base: './',
  // Expose the package.json version to the app (single source of truth for the app/world/save stamp).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Build-type class, set per target by the release workflow (FORMAMORPH_BUILD): 'portable' | 'installed'
    // | 'web'. Empty (a local build) is treated as 'dev'. Purely a label — the desktop userData redirect
    // keys off the runtime PORTABLE_EXECUTABLE_DIR/APPIMAGE vars, not this.
    __BUILD_TARGET__: JSON.stringify(process.env.FORMAMORPH_BUILD ?? ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Dev-mode pre-bundling rewrites these into .vite/deps, breaking their import.meta.url-relative
    // .wasm lookup (the QuickJS engine file). Serving them unbundled keeps the wasm path resolvable.
    exclude: ['quickjs-emscripten', '@jitl/quickjs-wasmfile-release-sync', 'wasm-webp'],
  },
  worker: {
    // The image-encode worker lazily `import()`s wasm-webp; under the default iife worker format that dynamic
    // import would force code-splitting (unsupported for iife). Inlining folds it into the single worker chunk.
    // No-op for the other workers (they have no dynamic imports).
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  server: {
    // When the baseline harness spawns the dev server (BASELINE_NO_WATCH=1) it disables watching and HMR
    // entirely: the harness reads source once at page load and never needs live reload, so a developer editing
    // ANY file (src included) while a long scripted run is in flight can't restart the page under it. A normal
    // `npm run dev` leaves both on and keeps the ignore list below.
    ...(process.env.BASELINE_NO_WATCH
      ? { hmr: false, watch: null }
      : {
          watch: {
            // Paths the app never imports. Watching them costs a full page reload every time a background tool
            // rewrites one — `graphify watch` regenerates graphify-out/graph.html on any source change, and the
            // baseline harness writes dumps, profiles and docs of its own. A reload mid-run kills the scripted
            // turn it was driving ("Execution context was destroyed" / "__baseline is undefined").
            ignored: ['**/graphify-out/**', '**/testing/**', '**/graph.json', '**/GRAPH_REPORT.md'],
          },
        }),
  },
  test: {
    // e2e/ is Playwright's, and its specs match Vitest's default glob. Left in, `vitest run` would load
    // them into jsdom and fail on the first browser API they reach.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})