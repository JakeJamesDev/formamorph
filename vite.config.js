/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { releasedMinorChangelog } from './src/lib/docs/changelogSlice'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
// The ONNX runtime's dist folder, which its package exports do not expose (src/lib/embeddingWorker.ts).
const ortDist = path.dirname(createRequire(import.meta.url).resolve('onnxruntime-web'))
const syncAppOrigin = process.env.E2E_SYNC_APP_ORIGIN

const directSyncAppModules = {
  name: 'direct-sync-app-modules',
  enforce: 'post',
  transformIndexHtml(html) {
    if (!syncAppOrigin) return html
    return html.replace(/src="(\/play\/(?:@vite\/client|src\/main\.tsx))"/g, `src="${syncAppOrigin}$1"`)
  },
}

// VITE_FM_HOLD_UPDATES=1: queue every HMR update and full reload per page until that page sends
// fm:apply-held (the banner in src/lib/dev/heldUpdatesBanner.ts).
const holdUpdates = {
  name: 'hold-updates',
  apply: 'serve',
  configureServer(server) {
    if (!process.env.VITE_FM_HOLD_UPDATES) return
    const send = server.ws.send.bind(server.ws)
    /** @type {WeakMap<object, { updates: Map<string, object>, reload: boolean }>} */
    const queues = new WeakMap()
    const queueOf = (client) => {
      if (!queues.has(client)) queues.set(client, { updates: new Map(), reload: false })
      return queues.get(client)
    }
    const announce = (client) => {
      const q = queueOf(client)
      const files = [...new Set([...q.updates.values()].map((u) => u.path))]
      client.send({ type: 'custom', event: 'fm:held', data: { files, reload: q.reload } })
    }
    server.ws.send = (payload, ...rest) => {
      const held = typeof payload === 'object' && (payload.type === 'update' || payload.type === 'full-reload')
      if (!held) return send(payload, ...rest)
      server.config.logger.info(`${payload.type} held`, { timestamp: true })
      for (const client of server.ws.clients) {
        const q = queueOf(client)
        if (payload.type === 'full-reload') q.reload = true
        else for (const u of payload.updates) q.updates.set(`${u.type}:${u.path}:${u.acceptedPath}`, u)
        announce(client)
      }
    }
    server.ws.on('fm:apply-held', (_data, client) => {
      const q = queueOf(client)
      if (!q.reload && q.updates.size > 0) client.send({ type: 'update', updates: [...q.updates.values()] })
      queues.delete(client)
      announce(client)
    })
  },
}

// `docs/<Page>.md?docs-index`: the page as a string for the Docs Index, with the changelog cut to its
// newest released minor series (src/lib/docs/bundledDocsIndex.ts).
const docsIndexMarkdown = {
  name: 'docs-index-markdown',
  enforce: 'pre',
  load(id) {
    const [file, query] = id.split('?')
    if (query === undefined || !new URLSearchParams(query).has('docs-index')) return null
    this.addWatchFile(file)
    const markdown = readFileSync(file, 'utf-8')
    const text = path.basename(file) === 'Changelog.md' ? releasedMinorChangelog(markdown) : markdown
    return `export default ${JSON.stringify(text)}`
  },
}

export default defineConfig({
  plugins: [react(), directSyncAppModules, holdUpdates, docsIndexMarkdown],
  ...(process.env.E2E_SYNC_APP
    ? { cacheDir: path.resolve(__dirname, 'node_modules/.vite-sync-app') }
    : {}),
  base: './',
  // Expose the package.json version to the app (single source of truth for the app/world/save stamp).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Build-type class, set per target by the release workflow (FORMAMORPH_BUILD): 'portable' | 'installed'
    // | 'web' | 'android'. Empty (a local build) is treated as 'dev'. Mostly a label — the desktop userData
    // redirect keys off the runtime PORTABLE_EXECUTABLE_DIR/APPIMAGE vars, not this — but 'android' also
    // decides the platform the client header reports, because the desktop bridge is absent in the WebView.
    __BUILD_TARGET__: JSON.stringify(process.env.FORMAMORPH_BUILD ?? ''),
  },
  resolve: {
    // Modal menus and dialogs must share the body pointer-lock registry.
    dedupe: ['@radix-ui/react-dismissable-layer'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'onnxruntime-web-dist': ortDist,
    },
  },
  optimizeDeps: {
    // Dev-mode pre-bundling rewrites these into .vite/deps, breaking their import.meta.url-relative
    // .wasm lookup (the QuickJS engine file). Serving them unbundled keeps the wasm path resolvable.
    // Pre-bundling also breaks the ONNX runtime's `?url` imports.
    exclude: ['quickjs-emscripten', '@jitl/quickjs-wasmfile-release-sync', 'wasm-webp', 'onnxruntime-web-dist'],
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
            // Worktrees and build output too: a ticket's `npm run build` holds files in its dist/, and a watch
            // on a held file throws EBUSY, which kills the main checkout's dev server.
            ignored: [
              '**/graphify-out/**',
              '**/testing/**',
              '**/graph.json',
              '**/GRAPH_REPORT.md',
              '**/.claude/worktrees/**',
              '**/.scratch/**',
              '**/dist/**',
            ],
          },
        }),
  },
  test: {
    // e2e/ belongs to Playwright; .scratch/ contains untracked working copies and experiments.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.scratch/**', '.claude/worktrees/**'],
    setupFiles: ['./src/test/setup.ts'],
    // A change to one of these makes `--changed` and `related` run the full suite. They replace vitest's `**/`
    // defaults, which can't match inside a ticket worktree: picomatch's `**` skips the `.claude` folder.
    forceRerunTriggers: [
      'package.json',
      'package-lock.json',
      'vite.config.js',
      'src/lib/docs/changelogSlice.ts',
      'tsconfig*.json',
      '.env*',
    ].map((file) => path.resolve(__dirname, file).replace(/\\/g, '/')),
    css: false,
    // A new jsdom per file is a large share of the suite's CPU, so plain .ts tests run in node. A .ts test
    // that needs the DOM opts in with `// @vitest-environment jsdom`.
    projects: [
      { extends: true, test: { name: 'dom', include: ['**/*.test.{tsx,mjs}'], environment: 'jsdom' } },
      { extends: true, test: { name: 'node', include: ['**/*.test.ts'], environment: 'node' } },
    ],
  },
})
