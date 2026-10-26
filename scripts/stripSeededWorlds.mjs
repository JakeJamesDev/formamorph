// Under vitest, an app module's `?raw` import of a bundled world gets the world with every image stripped, so a
// test that runs the seeder never loads the lossless art. A test file's own `?raw` import keeps the source bytes.
import { readFileSync } from 'node:fs'
import { stripValue } from './stripWorldImages.mjs'

const WORLD_RAW = /[\\/]defaultworlds[\\/][^\\/?]+\.json\?raw$/
// Keeps the `raw` query so vite's JSON plugin leaves the module alone.
const STRIPPED = '?raw&stripped'
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

/** @returns {import('vite').Plugin} */
export function stripSeededWorlds() {
  return {
    name: 'strip-seeded-worlds',
    enforce: 'pre',
    apply: (_, { command }) => !!process.env.VITEST && command === 'serve',
    async resolveId(source, importer) {
      if (!importer || TEST_FILE.test(importer.split('?')[0]) || !WORLD_RAW.test(source)) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved) return null
      return resolved.id.split('?')[0] + STRIPPED
    },
    load(id) {
      if (!id.endsWith(STRIPPED)) return null
      const file = id.slice(0, -STRIPPED.length)
      this.addWatchFile(file)
      const text = JSON.stringify(stripValue(JSON.parse(readFileSync(file, 'utf8'))))
      return `export default ${JSON.stringify(text)}`
    },
  }
}
