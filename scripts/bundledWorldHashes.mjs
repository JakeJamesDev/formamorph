// Serves each bundled world's content hash as a small module of its own, `<world>.json?raw&world-hash`, so a
// launch can tell whether a world changed without loading it. The hash covers the exact text that the same
// build's `?raw` import serves. The `raw` query keeps vite's JSON plugin away. See shipBundledWorlds.md.
import { readFileSync } from 'node:fs'
import { contentHash } from '../src/lib/contentHash.ts'
import { shipsLossless } from './shipBundledWorlds.mjs'
import { strippedWorldText } from './stripSeededWorlds.mjs'

const HASH_QUERY = '?raw&world-hash'
const WORLD_HASH = /[\\/]defaultworlds[\\/][^\\/?]+\.json\?raw&world-hash$/

/**
 * The Vite plugin. Run after `shipBundledWorlds`, whose `api.shippedText` is passed in, so a build encodes each
 * world once.
 *
 * @param {(file: string) => Promise<string>} shippedText
 * @returns {import('vite').Plugin}
 */
export function bundledWorldHashes(shippedText) {
  let building = false

  const textOf = async (file) => {
    if (building && !shipsLossless()) return shippedText(file)
    const source = readFileSync(file, 'utf8')
    return !building && process.env.VITEST ? strippedWorldText(source) : source
  }

  return {
    name: 'bundled-world-hashes',
    enforce: 'pre',
    configResolved(config) {
      building = config.command === 'build'
    },
    async load(id) {
      if (!WORLD_HASH.test(id)) return null
      const file = id.slice(0, -HASH_QUERY.length)
      this.addWatchFile(file)
      return `export default ${JSON.stringify(contentHash(await textOf(file)))}`
    },
  }
}
