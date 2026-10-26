// Production builds bundle each bundled world in its shipped form: Downscale applied to the lossless source
// file (src/lib/shippedWorld.ts). FORMAMORPH_LOSSLESS_WORLDS=1 bundles the source files, for a Steam build.
// The dev server never runs this, so the editor shows the lossless art. See shipBundledWorlds.md.
import { readFileSync } from 'node:fs'
import path from 'node:path'

const WORLD_RAW = /[\\/]src[\\/]defaultworlds[\\/]([^\\/?]+)\.json\?raw$/

const lossless = () => process.env.FORMAMORPH_LOSSLESS_WORLDS === '1'

const megabytes = (n) => `${(n / 1e6).toFixed(2)} MB`

/**
 * The Vite plugin. `root` is the project folder, whose `src` the shipped-world module loads from.
 *
 * @param {string} root
 * @returns {import('vite').Plugin}
 */
export function shipBundledWorlds(root) {
  /** @type {Promise<import('vite').ViteDevServer> | null} */
  let loader = null
  /** @type {import('vite').Logger | null} */
  let logger = null
  /** @type {{ name: string, source: number, shipped: number }[]} */
  const sizes = []
  /** @type {string[]} */
  const skipped = []

  return {
    name: 'ship-bundled-worlds',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    async load(id) {
      const match = WORLD_RAW.exec(id)
      if (!match || lossless()) return null
      const file = id.slice(0, id.indexOf('?'))
      this.addWatchFile(file)
      const source = readFileSync(file, 'utf8')
      // A Node-side module loader, so the shipped-world module keeps its `@/` imports and TypeScript.
      loader ??= import('vite').then(({ createServer }) => createServer({
        configFile: false,
        root,
        logLevel: 'error',
        appType: 'custom',
        resolve: { alias: { '@': path.resolve(root, 'src') } },
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      }))
      const { shippedWorldText, skippedAnimations } = await (await loader).ssrLoadModule('/src/lib/shippedWorld.ts')
      const shipped = await shippedWorldText(source)
      sizes.push({ name: match[1], source: Buffer.byteLength(source), shipped: Buffer.byteLength(shipped) })
      for (const name of await skippedAnimations(source)) skipped.push(`${match[1]}: ${name}`)
      return `export default ${JSON.stringify(shipped)}`
    },
    async buildEnd() {
      if (lossless()) logger?.info('Bundled worlds ship lossless (FORMAMORPH_LOSSLESS_WORLDS=1).')
      if (sizes.length) {
        const rows = [...sizes].sort((a, b) => a.name.localeCompare(b.name))
        const total = rows.reduce((t, r) => ({ source: t.source + r.source, shipped: t.shipped + r.shipped }), { source: 0, shipped: 0 })
        const line = (name, r) => `  ${name.padEnd(12)} ${megabytes(r.source).padStart(10)} -> ${megabytes(r.shipped).padStart(10)}`
        logger?.info(['Bundled worlds shipped downscaled (source -> shipped):', ...rows.map((r) => line(r.name, r)), line('total', total)].join('\n'))
      }
      if (skipped.length) {
        logger?.warn(['Animated images over budget, shipped unchanged:', ...skipped.sort().map((s) => `  ${s}`)].join('\n'))
      }
      await (await loader)?.close()
      loader = null
    },
  }
}
