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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Dev-mode pre-bundling rewrites these into .vite/deps, breaking their import.meta.url-relative
    // .wasm lookup (the QuickJS engine file). Serving them unbundled keeps the wasm path resolvable.
    exclude: ['quickjs-emscripten', '@jitl/quickjs-wasmfile-release-sync'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})