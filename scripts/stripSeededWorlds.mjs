// Under vitest, every import of a bundled world, `?raw` or JSON, gets the world with its images stripped.
import { readFileSync } from 'node:fs'
import { stripValue } from './stripWorldImages.mjs'

const WORLD = /[\\/]defaultworlds[\\/][^\\/?]+\.json(\?raw)?$/
// Each suffix keeps the `raw` query so vite's JSON plugin leaves the module alone.
const AS_TEXT = { suffix: '?raw&stripped', render: (text) => `export default ${JSON.stringify(text)}` }
const AS_JSON = { suffix: '?raw&stripped-json', render: (text) => `export default JSON.parse(${JSON.stringify(text)})` }

/** @returns {import('vite').Plugin} */
export function stripSeededWorlds() {
  return {
    name: 'strip-seeded-worlds',
    enforce: 'pre',
    apply: (_, { command }) => !!process.env.VITEST && command === 'serve',
    async resolveId(source, importer) {
      const match = importer ? WORLD.exec(source) : null
      if (!match) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved) return null
      const isRaw = !!match[1]
      return resolved.id.split('?')[0] + (isRaw ? AS_TEXT : AS_JSON).suffix
    },
    load(id) {
      const mode = [AS_TEXT, AS_JSON].find(({ suffix }) => id.endsWith(suffix))
      if (!mode) return null
      const file = id.slice(0, -mode.suffix.length)
      this.addWatchFile(file)
      return mode.render(JSON.stringify(stripValue(JSON.parse(readFileSync(file, 'utf8')))))
    },
  }
}
