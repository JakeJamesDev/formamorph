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
  server: {
    watch: {
      // Generated output the app never imports. Watching it costs a full page reload every time a background
      // tool rewrites it — `graphify watch` regenerates graphify-out/graph.html on any source change, and the
      // baseline harness writes a dump per run. Either one reloading the page mid-run kills a scripted turn
      // ("Execution context was destroyed"), which made long harness runs fail ~1 in 3.
      ignored: ['**/graphify-out/**', '**/testing/baseline/runs/**', '**/graph.json', '**/GRAPH_REPORT.md'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})